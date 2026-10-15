from types import SimpleNamespace

import pytest

from app.recon import (
    discover_html,
    discover_javascript,
    parent_directories,
    parse_robots,
    parse_sitemap,
)

BASE = "https://example.com/dir/page"


def page(body: str | bytes, url: str = BASE) -> SimpleNamespace:
    return SimpleNamespace(url=url, body=body)


def test_html_resolves_resources_and_preserves_discovery_sources():
    hints = discover_html(
        page("""
        <base href="/assets/">
        <a href="../about?z=2&amp;a=1#intro">About</a>
        <link href="app.css" rel="stylesheet">
        <script src="app.js"></script>
        <img src="logo.png"><iframe src="/embed"></iframe>
        <script>fetch('/api/users')</script>
    """)
    )

    assert ("https://example.com/about?a=1&z=2", "html:a") in hints
    assert ("https://example.com/assets/app.css", "html:link") in hints
    assert ("https://example.com/assets/app.js", "html:script") in hints
    assert ("https://example.com/assets/logo.png", "html:img") in hints
    assert ("https://example.com/embed", "html:iframe") in hints
    assert ("https://example.com/api/users", "javascript") in hints


def test_get_forms_discover_actions_without_input_values_and_skip_post():
    hints = discover_html(
        page("""
        <form action="/search?mode=public">
            <input name="q" value="secret"><input type="hidden" name="token" value="private">
        </form>
        <form action="/filter" method="GET"><input name="topic" value="sensitive"></form>
        <form method="get"><input name="q" value="sensitive"></form>
        <form action="/write" method="POST"><input name="q" value="secret"></form>
    """)
    )

    assert hints == [
        ("https://example.com/search?mode=public", "html:form"),
        ("https://example.com/filter", "html:form"),
        (BASE, "html:form"),
    ]


@pytest.mark.parametrize(
    "reference",
    [
        "javascript:alert(1)",
        "data:text/html,hello",
        "mailto:person@example.com",
        "https://user:secret@example.com/api",
        "https://example.com:99999/api",
        "https://[broken/api",
        "//example.com:bad/api",
        "https://exa\nmple.com/api",
        "https://example.com\\evil/api",
        "#fragment",
    ],
)
def test_html_skips_malformed_or_non_http_references(reference):
    assert discover_html(page(f'<a href="{reference}">link</a>')) == []


@pytest.mark.parametrize(
    "bad_base",
    [
        "file:///tmp/page.html",
        "https://example.com:bad/",
        "https://[broken/",
    ],
)
def test_html_and_parent_discovery_handle_invalid_page_urls(bad_base):
    assert discover_html(page('<a href="/api">link</a>', bad_base)) == []
    assert parent_directories(bad_base) == []


def test_html_skips_destructive_paths_and_handles_malformed_bytes():
    hints = discover_html(
        page(b"""\xff<a href="/ok"><a href="/delete/account">
        <form action="/logout"><a href="/%64elete/account">""")
    )

    assert hints == [("https://example.com/ok", "html:a")]
    assert isinstance(discover_html(page(b"<![bad]><a href='/ok'>")), list)


def test_javascript_discovers_api_absolute_and_escaped_urls_and_source_map():
    hints = discover_javascript(
        r"""
        fetch('/api/users');
        const external = 'https://api.example.com/v1/items?b=2&a=1';
        const escaped = "https:\/\/example.com\/api\/escaped";
        import './chunk.js';
        //# sourceMappingURL=app.js.map
    """,
        "https://example.com/assets/app.js",
    )

    assert ("https://example.com/api/users", "javascript") in hints
    assert ("https://api.example.com/v1/items?a=1&b=2", "javascript") in hints
    assert ("https://example.com/api/escaped", "javascript") in hints
    assert ("https://example.com/assets/chunk.js", "javascript") in hints
    assert ("https://example.com/assets/app.js.map", "javascript:sourcemap") in hints


def test_javascript_skips_templates_regex_noise_and_unsafe_refs():
    assert (
        discover_javascript(
            r"""
        const template = `/api/${user}`;
        const regex = '/api/(.*)';
        const expression = '/^api$/';
        fetch('/delete/account');
        const invalid = "https://user:secret@example.com/api";
        //# sourceMappingURL=data:application/json;base64,e30=
    """,
            BASE,
        )
        == []
    )


def test_robots_handles_groups_comments_relative_sitemaps_and_unsafe_paths():
    assert parse_robots(
        """
        User-agent: *
        Disallow: /admin # discovery hint
        Allow: /public
        Disallow:
        Disallow: /*.json$
        Disallow: /delete/account
        Sitemap: /maps/index.xml
        User-agent: OtherBot
        Disallow: /other
        Sitemap: https://example.com/maps/extra.xml
    """,
        "https://example.com/robots.txt",
    ) == [
        ("https://example.com/admin", "robots:disallow"),
        ("https://example.com/public", "robots:allow"),
        ("https://example.com/maps/index.xml", "robots:sitemap"),
        ("https://example.com/other", "robots:disallow"),
        ("https://example.com/maps/extra.xml", "robots:sitemap"),
    ]


def test_sitemap_handles_namespaces_indexes_and_canonical_urls():
    xml = """<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>/maps/pages.xml</loc></sitemap>
        <sitemap><loc>https://example.com/list?z=2&amp;a=1#fragment</loc></sitemap>
        <sitemap><loc>javascript:alert(1)</loc></sitemap>
        <sitemap><loc>/delete/account</loc></sitemap>
    </sitemapindex>"""

    assert parse_sitemap(xml, "https://example.com/sitemap.xml") == [
        ("https://example.com/maps/pages.xml", "sitemap"),
        ("https://example.com/list?a=1&z=2", "sitemap"),
    ]


@pytest.mark.parametrize(
    "xml",
    [
        '<!DOCTYPE urlset SYSTEM "https://example.com/external.dtd"><urlset/>',
        '<!DOCTYPE urlset [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
        "<urlset><url><loc>&xxe;</loc></url></urlset>",
        '<!DOCTYPE urlset [<!ENTITY x "https://example.com/private">]>'
        "<urlset><url><loc>&x;</loc></url></urlset>",
        "<urlset><url><loc>https://example.com/partial</loc></url>",
        b"\xff\xfe\x00<urlset>",
    ],
)
def test_sitemap_rejects_dtd_entities_and_malformed_xml(xml):
    assert parse_sitemap(xml, BASE) == []


def test_discovery_is_bounded_and_deduplicates():
    anchors = '<a href="/same">same</a>' * 10
    anchors += "".join(f'<a href="/item/{index}">item</a>' for index in range(1100))
    hints = discover_html(page(anchors))

    assert len(hints) == 1000
    assert hints.count(("https://example.com/same", "html:a")) == 1
    assert parse_sitemap("<urlset>" + "<url/>" * 10001 + "</urlset>", BASE) == []
    assert len(parent_directories("https://example.com/" + "x/" * 100 + "file")) == 32


def test_parent_directories_remove_queries_and_skip_unsafe_parents():
    assert parent_directories("https://example.com/a/b/file?q=1#part") == [
        "https://example.com/a/b/",
        "https://example.com/a/",
        "https://example.com/",
    ]
    assert parent_directories("https://example.com/a/b/") == [
        "https://example.com/a/",
        "https://example.com/",
    ]
    assert parent_directories("https://example.com/delete/account") == [
        "https://example.com/",
    ]
    assert parent_directories("https://example.com/") == []
