"""Intentionally insecure synthetic target: local test network only, fake data only."""

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response

app = FastAPI(docs_url=None, redoc_url=None)
REQUESTS: list[str] = []


@app.middleware("http")
async def record_request(request: Request, call_next):
    REQUESTS.append(request.url.path)
    response = await call_next(request)
    response.headers["Server"] = "SyntheticServer/1.2"
    return response


@app.get("/")
def home():
    return HTMLResponse("""<html><title>Example Research Target</title><body>
    <h1>Synthetic owned test environment</h1>
    <a href='/directory/'>Media directory</a><a href='/bad-headers'>Headers</a>
    <a href='/cors-test'>CORS</a><a href='/debug'>Debug</a>
    <a href='/redirect?next=https://bountyscope.invalid/'>Redirect indicator</a>
    <a href='http://out-of-scope.test/forbidden'>Third party (must never request)</a>
    <a href='/delete/account'>Dangerous action (must never request)</a>
    <a href='/excluded/private'>Explicit exclusion</a>
    <script src='/assets/app.js'></script><img src='/uploads/users/123/avatar.jpg'>
    </body></html>""")


@app.get("/directory/")
@app.get("/uploads/")
@app.get("/uploads/users/")
def directory():
    links = "".join(
        f"<tr><td><a href='image_{i}.jpg'>image_{i}.jpg</a></td><td>1 KB</td></tr>"
        for i in range(42)
    )
    return HTMLResponse(
        f"<html><title>Index of /uploads/</title><h1>Index of /uploads/</h1><a href='../'>Parent Directory</a><table>{links}</table></html>"
    )


@app.get("/bad-headers")
def bad_headers():
    response = HTMLResponse("<html><title>Cookie demonstration</title>Fake session only</html>")
    response.set_cookie(
        "session_id", "synthetic-not-a-real-secret", secure=False, httponly=False, samesite="none"
    )
    return response


@app.get("/cors-test")
def cors(request: Request):
    return Response(
        '{"message":"synthetic public information only"}',
        media_type="application/json",
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        },
    )


@app.get("/debug")
def debug():
    return PlainTextResponse(
        'Traceback (most recent call last):\n File "/srv/example/app.py", line 42\nValueError: Synthetic debug exception\npassword=FAKE_TEST_PASSWORD',
        status_code=500,
    )


@app.get("/.env")
def environment():
    return PlainTextResponse(
        "APP_ENV=testing\nDATABASE_URL=postgresql://fake:fake@db/synthetic\nAPI_KEY=FAKE_TEST_KEY_DO_NOT_USE\n"
    )


@app.get("/.git/HEAD")
def git_head():
    return PlainTextResponse("ref: refs/heads/synthetic-test\n")


@app.get("/robots.txt")
def robots():
    return PlainTextResponse(
        "User-agent: *\nDisallow: /admin/\nSitemap: http://example.test:8080/sitemap.xml\n"
    )


@app.get("/sitemap.xml")
def sitemap():
    return Response(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://example.test:8080/directory/</loc></url><url><loc>http://out-of-scope.test/from-sitemap</loc></url></urlset>',
        media_type="application/xml",
    )


@app.get("/assets/app.js")
def javascript():
    return Response(
        'fetch("/api/v1/public"); const upload="/uploads/users/";\n//# sourceMappingURL=app.js.map',
        media_type="application/javascript",
    )


@app.api_route("/assets/app.js.map", methods=["GET", "HEAD"])
def source_map():
    return Response(
        '{"version":3,"sources":["synthetic.ts"],"mappings":""}', media_type="application/json"
    )


@app.get("/redirect")
def redirect(next: str = "/"):
    return RedirectResponse(next)


@app.get("/api/v1/public")
def public_api():
    return {"fixture": True, "message": "No real user data"}


@app.get("/_test/requests")
def requests():
    return REQUESTS[-2000:]
