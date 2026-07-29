/**
 * AMRC — complete website in a single Cloudflare Worker.
 *
 * GENERATED FILE — do not edit by hand.
 * Edit the pages in site/ and re-run:  node site-worker/build-single-file.mjs
 *
 * ---------------------------------------------------------------------------
 * DEPLOY (no repo, no build tools, no hosting account needed)
 *
 *   1. dash.cloudflare.com -> Workers & Pages -> Create -> Start from Hello World
 *   2. Deploy, then "Edit code", select all, paste this file over it, Deploy.
 *   3. The site is live on <name>.workers.dev straight away.
 *   4. Settings -> Domains & Routes -> add tokyocopyright.com when ready.
 *
 * CONTACT FORM — Settings -> Variables and Secrets, add ONE of:
 *   RESEND_API_KEY        send email via resend.com (verify your domain there)
 *   FORWARD_WEBHOOK_URL   POST the enquiry JSON to Slack / a CRM / Zapier
 * With neither set the form falls back to a pre-filled mailto: link, so an
 * enquiry is never silently lost.
 * ---------------------------------------------------------------------------
 */

/* ============================================================================
   EMBEDDED FILES — each one below is wrapped in a banner like:

       // ====================
       //  /members.html
       // ====================

   Search for the path to jump straight to a file. The HTML inside each
   block is raw and editable — change it here and redeploy, or edit
   site/<file> and re-run this build.

     - /404.html
     - /about.html
     - /assets/css/app.css
     - /assets/img/logo.svg
     - /assets/js/app.js
     - /contact.html
     - /favicon.svg
     - /imprint.html
     - /index.html
     - /ja/404.html
     - /ja/about.html
     - /ja/contact.html
     - /ja/imprint.html
     - /ja/index.html
     - /ja/members.html
     - /ja/privacy.html
     - /ja/public.html
     - /ja/services.html
     - /members.html
     - /privacy.html
     - /public.html
     - /robots.txt
     - /services.html
     - /sitemap.xml
   ============================================================================ */

const ASSETS = {};

// ============================================================================
//  /404.html
// ============================================================================
ASSETS["/404.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found — AMRC</title>
<meta name="robots" content="noindex, follow">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="section text-center">
    <div class="wrap">
      <span class="kicker">Error 404</span>
      <h1>This page could not be found</h1>
      <p class="lead">
        The address may have changed, or the link that brought you here may be out of date.
      </p>
      <p class="mt-2">
        <a class="btn btn-primary" href="index.html">Back to the home page</a>
        <a class="btn btn-dark" href="contact.html">Contact us</a>
      </p>
      <p class="muted mt-3 mb-0">
        Looking to dispute a takedown notice? See the
        <a href="public.html#counter-notice">counter-notice procedure</a>.
      </p>
    </div>
  </section>
</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-bottom footer-bottom-bare">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /about.html
// ============================================================================
ASSETS["/about.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>About — AMRC</title>
<meta name="description" content="The Anime &amp; Manga Rights Council is a Chiyoda-ku based member body: how it is governed, how companies join, and the principles that constrain its enforcement.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/about.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/about.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/about.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/about.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="About — AMRC">
<meta property="og:description" content="Who we are, how we work, and the principles that shape our enforcement.">
<meta property="og:url" content="https://tokyocopyright.com/about.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/about.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html" class="is-active">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; About</div>
      <h1>About the Council</h1>
      <p>
        A member body of Japanese anime and manga companies, operating the shared
        technical infrastructure its members use to find and remove illegal copies of
        their works — anywhere in the world.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">Who we are</span>
          <h2>A shared enforcement body, not a law firm</h2>
          <p>
            The Council was founded on a simple observation: the bottleneck in
            anti-piracy is not the law, it is throughput. A single popular series can be
            re-uploaded thousands of times a week across dozens of platforms. No studio
            or publisher can keep up with that alone, and every one of them was paying
            separately to lose the same fight.
          </p>
          <p>
            So the members built one pipeline and share it. Crawlers, fingerprint matching
            and notice dispatch run continuously across the combined catalogue, and our
            people concentrate on the cases that genuinely need human judgement — ambiguous
            matches, repeat offenders, hostile hosts and pre-publication leaks.
          </p>
          <p class="mb-0">
            We work alongside our members' legal counsel; we do not replace them and we
            do not provide legal advice.
          </p>
        </div>
        <div class="split-figure">
          <h3>At a glance</h3>
          <ul class="checklist">
            <li>Secretariat in Chiyoda-ku, Tokyo</li>
            <li>Enforcement operating 24 hours a day, all year</li>
            <li>Notices issued in 30+ languages</li>
            <li>Members across animation studios, manga publishers and licensors</li>
            <li>Support in English and Japanese</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Principles</span>
        <h2>How we choose to work</h2>
        <p>These are binding on the Council, not marketing lines. They constrain what we will act on, even at a member’s request.</p>
      </div>
      <div class="grid grid-3">
        <div class="card">
          <h3>Never against fans</h3>
          <p>
            We do not sue, invoice, threaten or send demand letters to viewers, readers or
            listeners. Our work targets the distribution of infringing copies, not the
            audience.
          </p>
        </div>
        <div class="card">
          <h3>Accuracy before volume</h3>
          <p>
            A wrong takedown removes lawful speech and damages the member company. Confidence
            thresholds, allow-lists for licensees, and human review on borderline cases
            are built into the pipeline.
          </p>
        </div>
        <div class="card">
          <h3>Proportionate response</h3>
          <p>
            We start with the host or platform that can resolve the issue directly, and
            escalate to registrars, payment providers or search engines only when that
            fails.
          </p>
        </div>
        <div class="card">
          <h3>Verified rights only</h3>
          <p>
            Before a single notice is sent we confirm that the member actually holds the
            rights it claims, for the territories it claims — including which overseas
            licensee holds the simulcast.
          </p>
        </div>
        <div class="card">
          <h3>Transparent to the other side</h3>
          <p>
            Every notice identifies us, states the legal basis, and explains how to file a
            counter-notice if the recipient disagrees.
          </p>
        </div>
        <div class="card">
          <h3>Data minimisation</h3>
          <p>
            We collect the evidence needed to prove an infringement and no more. We do not
            build profiles of individual internet users.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">Membership</span>
      <h2>How a company joins</h2>
      <p>
        Most memberships begin with a piracy assessment: a prospective member gives us a
        handful of titles, and we report back on where they are currently being distributed
        illegally and at what scale. That report is yours whether or not you join.
      </p>
      <p>
        If you proceed, accession takes a few days. We ingest your catalogue and proof of
        rights, generate reference fingerprints, register your simulcast and serialisation
        calendar so that new episodes and chapters are protected from the minute they go
        live, and set up your dashboard and API credentials.
      </p>
      <p>
        From there the system runs by itself. Members receive scheduled reporting, a live
        view of detections and removals, a seat in the members’ meeting where enforcement
        policy is set, and a named contact in Tokyo for anything that needs a person.
      </p>

      <div class="notice mt-2">
        <p>
          <strong>Please note:</strong> the Council provides technical enforcement
          services to its members. We are not a law firm and nothing on this website
          constitutes legal advice. Where litigation is appropriate, we support a
          member's counsel with evidence and reporting.
        </p>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Governance</span>
        <h2>How the Council is run</h2>
        <p>
          The Council acts only on the authority its members give it, and that authority
          is written down rather than assumed.
        </p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <h3>Members' meeting</h3>
          <p>
            Every full member holds one seat and one vote, regardless of catalogue size.
            The meeting sets enforcement policy, admits new members and approves the
            budget.
          </p>
        </div>
        <div class="card">
          <h3>Secretariat</h3>
          <p>
            A standing team in Chiyoda-ku runs day-to-day enforcement within the policy
            the members have set. It cannot broaden the scope of enforcement on its own
            initiative.
          </p>
        </div>
        <div class="card">
          <h3>Rules of enforcement</h3>
          <p>
            The commitments above are written into the Council's rules. A member cannot
            instruct the secretariat to act against a fan, or to file a notice over a work
            it does not hold rights in.
          </p>
        </div>
      </div>


    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>Want to see the scale of the problem for your catalogue?</h2>
      <p>Send us a few titles and we will come back with a written assessment.</p>
      <a class="btn" href="contact.html">Request an assessment</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /assets/css/app.css
// ============================================================================
ASSETS["/assets/css/app.css"] = {
  type: "text/css; charset=utf-8",
  body: `/* ==========================================================================
   AMRC — global stylesheet
   Self-contained: no CDNs, no webfonts, no external assets.
   ========================================================================== */

:root {
  --ink: #0b1524;
  --ink-2: #12213a;
  --ink-3: #1b2f4d;
  --paper: #ffffff;
  --paper-2: #f4f6f9;
  --paper-3: #e7ecf2;
  --line: #d8e0ea;
  --body: #364559;
  --muted: #6b7c90;
  --brand: #b4152c;
  --brand-dark: #8d0f21;
  --brand-soft: #fdeef0;
  --accent: #1f6feb;
  --ok: #1a7f4b;
  --radius: 6px;
  --shadow: 0 1px 2px rgba(11, 21, 36, .06), 0 8px 24px rgba(11, 21, 36, .06);
  --wrap: 1140px;
  --sans: "Helvetica Neue", Helvetica, Arial, "Hiragino Kaku Gothic ProN",
          "Yu Gothic", Meiryo, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.7;
  color: var(--body);
  background: var(--paper);
}

img { max-width: 100%; height: auto; display: block; }

a { color: var(--brand); text-decoration: none; }
a:hover, a:focus { color: var(--brand-dark); text-decoration: underline; }

h1, h2, h3, h4 {
  margin: 0 0 .6em;
  color: var(--ink);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -.01em;
}

h1 { font-size: 2.35rem; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.2rem; }
h4 { font-size: 1rem; }
p  { margin: 0 0 1.1em; }

ul, ol { margin: 0 0 1.1em; padding-left: 1.25em; }
li { margin-bottom: .45em; }

hr { border: 0; border-top: 1px solid var(--line); margin: 2.5rem 0; }

.wrap {
  width: 100%;
  max-width: var(--wrap);
  margin: 0 auto;
  padding: 0 20px;
}

.text-center { text-align: center; }
.lead { font-size: 1.15rem; color: var(--body); }
.muted { color: var(--muted); }
.small { font-size: .875rem; }
.nowrap { white-space: nowrap; }

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip link ------------------------------------------------------------- */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--brand);
  color: #fff;
  padding: 10px 16px;
  z-index: 200;
}
.skip-link:focus { left: 0; color: #fff; }

/* Top bar --------------------------------------------------------------- */
.topbar {
  background: var(--paper);
  border-bottom: 1px solid var(--line);
  font-size: .82rem;
}
.topbar .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
}
.topbar a { color: var(--muted); }
.topbar a:hover { color: var(--brand); }
.topbar-contact { display: flex; flex-wrap: wrap; gap: 18px; }
.topbar-langs { display: flex; gap: 10px; align-items: center; }
.lang-pill {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  letter-spacing: .06em;
  font-size: .72rem;
  text-transform: uppercase;
}
.lang-pill.is-active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}
.lang-pill:hover { text-decoration: none; }

/* Masthead / navigation -------------------------------------------------- */
.masthead {
  background: var(--ink);
  position: sticky;
  top: 0;
  z-index: 100;
}
.masthead .wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  gap: 16px;
}
.brand { display: flex; align-items: center; gap: 12px; }
.brand:hover { text-decoration: none; }
.brand-mark { width: 38px; height: 38px; flex: 0 0 38px; }
.brand-name {
  color: #fff;
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: .01em;
  line-height: 1.1;
}
.brand-tag {
  display: block;
  color: #8fa3bd;
  font-size: .66rem;
  font-weight: 400;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.nav-toggle {
  display: none;
  background: none;
  border: 1px solid #33465f;
  border-radius: var(--radius);
  padding: 8px 10px;
  cursor: pointer;
}
.nav-toggle span {
  display: block;
  width: 20px;
  height: 2px;
  background: #fff;
  margin: 4px 0;
}

.nav { display: flex; align-items: center; gap: 4px; }
.nav a {
  display: block;
  padding: 10px 14px;
  color: #cdd8e6;
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .1em;
  text-transform: uppercase;
  border-radius: var(--radius);
}
.nav a:hover { background: var(--ink-3); color: #fff; text-decoration: none; }
.nav a.is-active { color: #fff; background: var(--brand); }
.nav .nav-cta {
  margin-left: 8px;
  background: #fff;
  color: var(--ink);
}
.nav .nav-cta:hover { background: var(--paper-3); color: var(--ink); }

/* Hero ------------------------------------------------------------------- */
.hero {
  position: relative;
  background: linear-gradient(150deg, #0b1524 0%, #14283f 55%, #1d3a5c 100%);
  color: #e8eef6;
  padding: 84px 0 76px;
  overflow: hidden;
}
.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, .035) 1px, transparent 1px);
  background-size: 46px 46px;
  pointer-events: none;
}
.hero .wrap { position: relative; z-index: 1; max-width: 900px; }
.hero .eyebrow {
  display: inline-block;
  margin-bottom: 18px;
  padding: 5px 14px;
  border: 1px solid rgba(255, 255, 255, .28);
  border-radius: 999px;
  font-size: .72rem;
  font-weight: 600;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #c9d8ea;
}
.hero h1 { color: #fff; font-size: 3rem; margin-bottom: .35em; }
.hero .rule {
  width: 68px;
  height: 4px;
  background: var(--brand);
  margin: 0 auto 26px;
  border-radius: 2px;
}
.hero p { font-size: 1.2rem; color: #c3d1e2; max-width: 720px; margin-inline: auto; }
.hero-actions { margin-top: 30px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

/* Page banner (inner pages) ---------------------------------------------- */
.page-head {
  background: linear-gradient(150deg, #0b1524 0%, #162b45 100%);
  color: #d6e1ee;
  padding: 54px 0 48px;
}
.page-head h1 { color: #fff; margin-bottom: .3em; }
.page-head p { margin: 0; color: #b6c6da; max-width: 760px; }
.crumbs {
  font-size: .78rem;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #7e93ad;
  margin-bottom: 14px;
}
.crumbs a { color: #9fb3cb; }

/* Buttons ---------------------------------------------------------------- */
.btn {
  display: inline-block;
  padding: 13px 26px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-size: .84rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.btn:hover, .btn:focus { text-decoration: none; }
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover { background: var(--brand-dark); color: #fff; }
.btn-ghost { border-color: rgba(255, 255, 255, .45); color: #fff; background: transparent; }
.btn-ghost:hover { background: rgba(255, 255, 255, .12); color: #fff; }
.btn-dark { background: var(--ink); color: #fff; }
.btn-dark:hover { background: var(--ink-3); color: #fff; }

/* Sections --------------------------------------------------------------- */
.section { padding: 72px 0; }
.section-tight { padding: 52px 0; }
.section-grey { background: var(--paper-2); border-block: 1px solid var(--line); }
.section-ink { background: var(--ink); color: #c6d3e3; }
.section-ink h2, .section-ink h3 { color: #fff; }

.section-title { max-width: 760px; margin: 0 auto 46px; text-align: center; }
.kicker,
.section-title .kicker {
  display: block;
  margin-bottom: 10px;
  font-size: .74rem;
  font-weight: 700;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: var(--brand);
}
.section-title p { margin: 0; color: var(--muted); font-size: 1.05rem; }

/* Statement band --------------------------------------------------------- */
.statement { padding: 62px 0; }
.statement h2 {
  max-width: 940px;
  margin: 0 auto;
  font-size: 1.6rem;
  font-weight: 400;
  line-height: 1.55;
  text-align: center;
  color: var(--ink-2);
}
.statement strong { font-weight: 700; color: var(--ink); }

/* Stats ------------------------------------------------------------------ */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.stat { text-align: center; padding: 8px 6px; }
.stat small {
  display: block;
  min-height: 20px;
  font-size: .74rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}
.stat .figure {
  font-size: 2.3rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
  margin: 2px 0 4px;
}
.stat .label { font-size: .92rem; color: var(--body); }
.section-ink .stat .figure { color: #fff; }
.section-ink .stat .label { color: #b8c7da; }
.section-ink .stat small { color: #8296ae; }

/* Card grid -------------------------------------------------------------- */
.grid { display: grid; gap: 24px; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px 26px;
  box-shadow: var(--shadow);
}
.card h3 { margin-bottom: .5em; }
.card p:last-child, .card ul:last-child { margin-bottom: 0; }
.card .icon {
  width: 44px;
  height: 44px;
  margin-bottom: 16px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 1.15rem;
  font-weight: 700;
}
.card-flat { box-shadow: none; background: transparent; }

/* Cards sitting on the dark band. */
.section-ink .card { background: var(--ink-2); border-color: #263a54; }

/* A honeypot field: off-screen for people, still filled in by bots.
   Kept as a class rather than an inline style so the CSP can stay style-src 'self'. */
.field-trap { position: absolute; left: -9999px; }

.split-top { align-items: start; }
.footer-bottom-bare { margin-top: 0; border-top: 0; }

/* Member roster — typographic, no logos ---------------------------------- */
.roster-group + .roster-group { margin-top: 46px; }
.roster-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ink);
}
.roster-head h3 {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.roster-head .count {
  font-size: .78rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--muted);
}

.roster {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.roster li {
  margin: 0;
  padding: 24px 14px;
  min-height: 104px;
  background: var(--paper);
  display: grid;
  place-content: center;
  text-align: center;
}
.roster .name {
  display: block;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ink);
  letter-spacing: -.005em;
}
.roster .meta {
  display: block;
  margin-top: 7px;
  font-size: .7rem;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Unfilled slot — greyed so an unedited roster is obviously a placeholder.
   Remove the is-empty class (or delete the row) as each real member is added. */
.roster li.is-empty { background: var(--paper-2); }
.roster li.is-empty .name { color: #a9b6c6; font-weight: 600; }
.roster li.is-empty .meta { color: #b8c3d0; }

@media (max-width: 1000px) { .roster { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px)  { .roster { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 380px)  { .roster { grid-template-columns: 1fr; } }

/* Member roster (card variant, retained) --------------------------------- */
.member-card { text-align: center; }
.member-card h3 { font-size: 1rem; margin-bottom: .35em; }
.member-logo {
  display: grid;
  place-items: center;
  height: 68px;
  margin-bottom: 16px;
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  background: var(--paper-2);
  color: var(--muted);
  font-size: 1rem;
  letter-spacing: .08em;
}
/* Swap .member-logo for an <img class="member-logo-img"> once real logos exist. */
.member-logo-img {
  height: 68px;
  width: 100%;
  margin-bottom: 16px;
  object-fit: contain;
}

/* Numbered process ------------------------------------------------------- */
.steps { counter-reset: step; display: grid; gap: 22px; grid-template-columns: repeat(4, 1fr); }
.step {
  position: relative;
  padding: 26px 22px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-top: 3px solid var(--brand);
  border-radius: var(--radius);
}
.step::before {
  counter-increment: step;
  content: "0" counter(step);
  display: block;
  margin-bottom: 10px;
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .16em;
  color: var(--brand);
}
.step h3 { font-size: 1.05rem; }
.step p { margin: 0; font-size: .95rem; }

/* Feature list ----------------------------------------------------------- */
.checklist { list-style: none; padding: 0; margin: 0; }
.checklist li {
  position: relative;
  padding-left: 30px;
  margin-bottom: .8em;
}
.checklist li::before {
  content: "";
  position: absolute;
  left: 0;
  top: .5em;
  width: 16px;
  height: 8px;
  border-left: 2px solid var(--brand);
  border-bottom: 2px solid var(--brand);
  transform: rotate(-45deg);
}

/* Split media ------------------------------------------------------------ */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}
.split-figure {
  background: linear-gradient(150deg, #14283f, #24445f);
  border-radius: var(--radius);
  padding: 34px;
  color: #dbe6f2;
  box-shadow: var(--shadow);
}
.split-figure h3 { color: #fff; }
.split-figure .checklist li::before { border-color: #7fb2ff; }

/* Table ------------------------------------------------------------------ */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table.data {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  background: var(--paper);
  font-size: .95rem;
}
table.data th, table.data td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
table.data thead th {
  background: var(--ink);
  color: #fff;
  font-size: .76rem;
  letter-spacing: .1em;
  text-transform: uppercase;
}
table.data tbody tr:nth-child(even) { background: var(--paper-2); }

/* Definition rows (imprint / contact details) ---------------------------- */
.deflist { display: grid; grid-template-columns: 200px 1fr; gap: 0; margin: 0; }
.deflist dt {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
  color: var(--ink);
  font-size: .9rem;
}
.deflist dd {
  margin: 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

/* Notice / callout ------------------------------------------------------- */
.notice {
  border-left: 4px solid var(--brand);
  background: var(--brand-soft);
  padding: 18px 22px;
  border-radius: 0 var(--radius) var(--radius) 0;
}
.notice p:last-child { margin-bottom: 0; }
.notice-info { border-left-color: var(--accent); background: #eef4ff; }

/* Forms ------------------------------------------------------------------ */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.field { display: flex; flex-direction: column; }
.field-full { grid-column: 1 / -1; }
.field label {
  margin-bottom: 6px;
  font-size: .84rem;
  font-weight: 700;
  color: var(--ink);
}
.field .req { color: var(--brand); }
.field .hint { margin-top: 6px; font-size: .8rem; color: var(--muted); }
.field input, .field select, .field textarea {
  font: inherit;
  font-size: .95rem;
  color: var(--ink);
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  width: 100%;
}
.field textarea { min-height: 150px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(31, 111, 235, .15);
}
.field-check {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  grid-column: 1 / -1;
}
.field-check input { width: auto; margin-top: 5px; }
.field-check label { font-weight: 400; font-size: .9rem; color: var(--body); }

.form-status {
  display: none;
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: var(--radius);
  font-size: .95rem;
}
.form-status.is-visible { display: block; }
.form-status.is-ok { background: #e9f6ee; border: 1px solid #b6dfc6; color: var(--ok); }
.form-status.is-error { background: var(--brand-soft); border: 1px solid #f0c2ca; color: var(--brand-dark); }

/* FAQ -------------------------------------------------------------------- */
.faq details {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  margin-bottom: 12px;
  padding: 0 20px;
}
.faq summary {
  cursor: pointer;
  padding: 16px 0;
  font-weight: 700;
  color: var(--ink);
  list-style: none;
}
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; float: right; color: var(--brand); font-size: 1.2rem; line-height: 1; }
.faq details[open] summary::after { content: "\\2013"; }
.faq details > p { margin: 0 0 16px; }

/* CTA strip -------------------------------------------------------------- */
.cta {
  background: var(--brand);
  color: #fff;
  padding: 54px 0;
  text-align: center;
}
.cta h2 { color: #fff; }
.cta p { color: #ffe2e6; max-width: 640px; margin: 0 auto 24px; }
.cta .btn { background: #fff; color: var(--brand); }
.cta .btn:hover { background: var(--ink); color: #fff; }

/* Footer ----------------------------------------------------------------- */
.footer {
  background: var(--ink);
  color: #9db0c7;
  padding: 54px 0 0;
  font-size: .92rem;
}
.footer h4 {
  color: #fff;
  font-size: .78rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.footer a { color: #b9c8db; }
.footer a:hover { color: #fff; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.4fr; gap: 32px; }
.footer ul { list-style: none; padding: 0; margin: 0; }
.footer li { margin-bottom: .5em; }
.footer .brand-name { font-size: 1.05rem; }
.footer-bottom {
  margin-top: 40px;
  border-top: 1px solid #22344c;
  padding: 20px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  justify-content: space-between;
  font-size: .84rem;
  color: #7f93ac;
}
.footer-bottom ul { display: flex; flex-wrap: wrap; gap: 18px; }

/* Utilities -------------------------------------------------------------- */
.mt-0 { margin-top: 0; }
.mb-0 { margin-bottom: 0; }
.mt-2 { margin-top: 1.5rem; }
.mt-3 { margin-top: 2.25rem; }
.prose { max-width: 820px; }
.prose h2 { margin-top: 2.2rem; }
.prose h3 { margin-top: 1.6rem; }

/* Responsive ------------------------------------------------------------- */
@media (max-width: 960px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .steps { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: repeat(2, 1fr); }
  .split { grid-template-columns: 1fr; gap: 30px; }
}

@media (max-width: 800px) {
  .nav-toggle { display: block; }
  .masthead .wrap { flex-wrap: wrap; }
  .nav {
    display: none;
    order: 3;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding-bottom: 12px;
  }
  .nav.is-open { display: flex; }
  .nav a { padding: 12px 4px; border-bottom: 1px solid #1e3149; border-radius: 0; }
  .nav .nav-cta { margin: 12px 0 0; text-align: center; border-radius: var(--radius); }
  .topbar .wrap { justify-content: center; }
}

@media (max-width: 720px) {
  h1 { font-size: 1.9rem; }
  .hero { padding: 60px 0 54px; }
  .hero h1 { font-size: 2.1rem; }
  .hero p { font-size: 1.05rem; }
  .section { padding: 52px 0; }
  .stats { grid-template-columns: repeat(2, 1fr); gap: 28px 16px; }
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .deflist { grid-template-columns: 1fr; }
  .deflist dt { border-bottom: 0; padding-bottom: 0; }
  .statement h2 { font-size: 1.25rem; text-align: left; }
}

@media (max-width: 480px) {
  .steps { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .stat .figure { font-size: 1.8rem; }
}

@media print {
  .masthead, .topbar, .cta, .nav-toggle, .footer { display: none; }
  body { color: #000; }
}
`
};

// ============================================================================
//  /assets/img/logo.svg
// ============================================================================
ASSETS["/assets/img/logo.svg"] = {
  type: "image/svg+xml",
  body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Anime &amp; Manga Rights Council">
  <defs>
    <linearGradient id="amrcBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16294170"/>
      <stop offset="0" stop-color="#162941"/>
      <stop offset="1" stop-color="#0b1524"/>
    </linearGradient>
  </defs>

  <!-- Plate -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#amrcBg)"/>

  <!-- Monogram A, drawn as paths so it never depends on a font being present.
       The counter is cut with evenodd rather than overpainted, so the mark
       stays correct on any background. -->
  <path fill="#ffffff" fill-rule="evenodd"
        d="M32 11 L49 47 L40.2 47 L36.7 39.4 L27.3 39.4 L23.8 47 L15 47 Z
           M32 24.2 L28.6 32.4 L35.4 32.4 Z"/>

  <!-- Rule: the council's line under the mark -->
  <rect x="19" y="51" width="26" height="4" rx="2" fill="#d51e38"/>
</svg>
`
};

// ============================================================================
//  /assets/js/app.js
// ============================================================================
ASSETS["/assets/js/app.js"] = {
  type: "text/javascript; charset=utf-8",
  body: `/* AMRC — small progressive-enhancement layer. No dependencies. */
(function () {
  'use strict';

  /* --- Mobile navigation ------------------------------------------------ */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* --- Current year in the footer --------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* --- Contact form ------------------------------------------------------
     Posts JSON to the endpoint in data-endpoint (contact.php on cPanel/WHM,
     /api/contact on Cloudflare Workers). If no backend is reachable we fall
     back to a pre-filled mailto: so the enquiry is never lost.            */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusBox = document.getElementById('form-status');
  var submitBtn = form.querySelector('button[type="submit"]');
  var mailbox = form.getAttribute('data-mailbox') || 'legal@tokyocopyright.com';

  function setStatus(message, kind) {
    if (!statusBox) return;
    statusBox.innerHTML = message;
    statusBox.className = 'form-status is-visible ' + (kind === 'ok' ? 'is-ok' : 'is-error');
    statusBox.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
  }

  function mailtoFallback(data) {
    var subject = '[' + (data.subject || 'Enquiry') + '] ' + (data.company || data.name || '');
    var body = [
      'Name: ' + (data.name || ''),
      'Company: ' + (data.company || ''),
      'Email: ' + (data.email || ''),
      'Phone: ' + (data.phone || ''),
      'Rights type: ' + (data.rights || ''),
      '',
      data.message || ''
    ].join('\\n');
    return 'mailto:' + mailbox +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    /* Honeypot: silently accept and drop obvious bots. */
    if (form.elements.website && form.elements.website.value) {
      setStatus('Thank you — your enquiry has been received.', 'ok');
      form.reset();
      return;
    }

    var data = {};
    Array.from(new FormData(form)).forEach(function (pair) {
      data[pair[0]] = typeof pair[1] === 'string' ? pair[1].trim() : pair[1];
    });

    if (!data.name || !data.email || !data.message) {
      setStatus('Please complete the name, email and message fields.', 'error');
      return;
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(data.email)) {
      setStatus('That email address does not look valid.', 'error');
      return;
    }
    if (form.elements.consent && !form.elements.consent.checked) {
      setStatus('Please confirm the privacy consent checkbox before sending.', 'error');
      return;
    }

    var endpoint = form.getAttribute('data-endpoint');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';
    }

    function restore() {
      if (!submitBtn) return;
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.label || 'Send enquiry';
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().catch(function () { return { ok: true }; });
      })
      .then(function (res) {
        if (res && res.ok === false) throw new Error(res.error || 'rejected');
        setStatus(
          'Thank you — your enquiry has been received. The secretariat replies to ' +
          'enquiries within one business day (JST).',
          'ok'
        );
        form.reset();
      })
      .catch(function () {
        setStatus(
          'The contact service is unavailable right now. ' +
          '<a href="' + mailtoFallback(data) + '">Click here to send the same message by email</a> ' +
          'or write to <a href="mailto:' + mailbox + '">' + mailbox + '</a>.',
          'error'
        );
      })
      .then(restore, restore);
  });
})();
`
};

// ============================================================================
//  /contact.html
// ============================================================================
ASSETS["/contact.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contact — AMRC</title>
<meta name="description" content="Contact the Anime &amp; Manga Rights Council in Chiyoda-ku, Tokyo. Membership enquiries, takedown notices, counter-notices and press: legal@tokyocopyright.com, +81 3-3230-6016.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/contact.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/contact.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/contact.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/contact.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Contact — AMRC">
<meta property="og:description" content="Membership enquiries, notices, counter-notices and press contacts.">
<meta property="og:url" content="https://tokyocopyright.com/contact.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/contact.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html" class="is-active">Contact</a>
      <a href="imprint.html">Imprint</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Contact</div>
      <h1>Contact us</h1>
      <p>
        Membership enquiries, piracy reports, notice disputes and press — all reach us at
        the address below. Enquiries in English or Japanese are equally welcome.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split split-top">

        <div>
          <span class="kicker">Send a message</span>
          <h2>Enquiry form</h2>
          <p>
            Tell us what you need protected, or what you need resolved. We reply to
            membership enquiries within one business day (JST).
          </p>

          <form id="contact-form"
                method="post"
                action="contact.php"
                data-endpoint="contact.php"
                data-mailbox="legal@tokyocopyright.com"
                novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="f-name">Name <span class="req">*</span></label>
                <input id="f-name" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="f-company">Company / organisation</label>
                <input id="f-company" name="company" type="text" autocomplete="organization">
              </div>
              <div class="field">
                <label for="f-email">Email <span class="req">*</span></label>
                <input id="f-email" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="f-phone">Phone</label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel">
              </div>
              <div class="field">
                <label for="f-subject">Reason for contact</label>
                <select id="f-subject" name="subject">
                  <option>Membership enquiry</option>
                  <option>Piracy assessment request</option>
                  <option>Report piracy of our work</option>
                  <option>Counter-notice / dispute a removal</option>
                  <option>Platform or hosting provider</option>
                  <option>Press or research</option>
                  <option>Other</option>
                </select>
              </div>
              <div class="field">
                <label for="f-rights">Type of content</label>
                <select id="f-rights" name="rights">
                  <option>Anime — broadcast or simulcast</option>
                  <option>Anime — film or OVA</option>
                  <option>Manga or serialised comics</option>
                  <option>Light novels or publishing</option>
                  <option>Music, soundtracks or drama CDs</option>
                  <option>Merchandise or official art</option>
                  <option>Not applicable</option>
                </select>
              </div>
              <div class="field field-full">
                <label for="f-message">Message <span class="req">*</span></label>
                <textarea id="f-message" name="message" required
                  placeholder="Titles concerned, URLs you have already found, and what you would like us to do."></textarea>
                <span class="hint">Please do not include passwords, screener credentials or other secrets in this form.</span>
              </div>

              <!-- Honeypot: hidden from people, tempting to bots. -->
              <div class="field field-trap" aria-hidden="true">
                <label for="f-website">Leave this field empty</label>
                <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
              </div>

              <div class="field-check">
                <input id="f-consent" name="consent" type="checkbox" value="yes" required>
                <label for="f-consent">
                  I agree that the Council may store and use the details above in order
                  to respond to this enquiry, as described in the
                  <a href="privacy.html">privacy policy</a>. <span class="req">*</span>
                </label>
              </div>
            </div>

            <p class="mt-2">
              <button class="btn btn-primary" type="submit">Send enquiry</button>
            </p>
            <div id="form-status" class="form-status"></div>
            <noscript>
              <div class="notice mt-2">
                <p>
                  This form needs JavaScript to submit. Please email
                  <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
                  instead — we read that mailbox continuously.
                </p>
              </div>
            </noscript>
          </form>
        </div>

        <div>
          <div class="card">
            <span class="kicker">Secretariat</span>
            <h3>Anime &amp; Manga Rights Council</h3>
            <dl class="deflist">
              <dt>Address</dt>
              <dd>
                4-6-10 Hitotsubashi<br>
                Chiyoda-ku, Tokyo 101-8050<br>
                Japan
              </dd>
              <dt>Email</dt>
              <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
              <dt>Telephone</dt>
              <dd><a href="tel:+81332306016">+81 3-3230-6016</a><br>
                  <span class="small muted">Domestic: 03-3230-6016</span></dd>
              <dt>Hours</dt>
              <dd>Mon–Fri, 09:00–18:00 JST<br>
                  <span class="small muted">Enforcement systems operate 24/7</span></dd>
              <dt>Languages</dt>
              <dd>English, 日本語</dd>
            </dl>
          </div>

          <div class="card mt-2">
            <h3>Which address to use</h3>
            <ul class="checklist mb-0">
              <li><strong>Membership &amp; assessments</strong> — the form, or the address above.</li>
              <li><strong>Disputing a removal</strong> — email with the subject <em>"Counter-notice"</em>; see <a href="public.html#counter-notice">the procedure</a>.</li>
              <li><strong>Platforms &amp; hosts</strong> — email with the subject <em>"Platform channel"</em> to set up direct reporting.</li>
              <li><strong>Press &amp; research</strong> — email with the subject <em>"Press"</em>.</li>
            </ul>
          </div>

          <div class="notice notice-info mt-2">
            <p class="mb-0">
              <strong>Reporting piracy of a member work?</strong> Include the title, the
              member company if you know it, and any URLs you have already found — it lets
              us act on the first reply rather than the third.
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Getting here</span>
        <h2>Chiyoda-ku, Tokyo</h2>
        <p>
          Our office is in the Hitotsubashi district of Chiyoda-ku, central Tokyo.
          Visits are by appointment only — please arrange one in advance by email.
        </p>
      </div>
      <p class="text-center mb-0">
        <a class="btn btn-dark"
           href="https://www.google.com/maps/search/?api=1&amp;query=4-6-10+Hitotsubashi+Chiyoda-ku+Tokyo+101-8050"
           target="_blank" rel="noopener noreferrer">Open in maps</a>
      </p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "url": "https://tokyocopyright.com/contact.html",
  "mainEntity": {
    "@type": "Organization",
    "name": "Anime & Manga Rights Council",
    "email": "legal@tokyocopyright.com",
    "telephone": "+81-3-3230-6016",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "4-6-10 Hitotsubashi",
      "addressLocality": "Chiyoda-ku",
      "addressRegion": "Tokyo",
      "postalCode": "101-8050",
      "addressCountry": "JP"
    }
  }
}
</script>
</body>
</html>
`
};

// ============================================================================
//  /favicon.svg
// ============================================================================
ASSETS["/favicon.svg"] = {
  type: "image/svg+xml",
  body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Anime &amp; Manga Rights Council">
  <defs>
    <linearGradient id="amrcBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16294170"/>
      <stop offset="0" stop-color="#162941"/>
      <stop offset="1" stop-color="#0b1524"/>
    </linearGradient>
  </defs>

  <!-- Plate -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#amrcBg)"/>

  <!-- Monogram A, drawn as paths so it never depends on a font being present.
       The counter is cut with evenodd rather than overpainted, so the mark
       stays correct on any background. -->
  <path fill="#ffffff" fill-rule="evenodd"
        d="M32 11 L49 47 L40.2 47 L36.7 39.4 L27.3 39.4 L23.8 47 L15 47 Z
           M32 24.2 L28.6 32.4 L35.4 32.4 Z"/>

  <!-- Rule: the council's line under the mark -->
  <rect x="19" y="51" width="26" height="4" rx="2" fill="#d51e38"/>
</svg>
`
};

// ============================================================================
//  /imprint.html
// ============================================================================
ASSETS["/imprint.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Imprint — AMRC</title>
<meta name="description" content="Legal notice and site information for the Anime &amp; Manga Rights Council, 4-6-10 Hitotsubashi, Chiyoda-ku, Tokyo 101-8050, Japan.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/imprint.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/imprint.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/imprint.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/imprint.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Imprint — AMRC">
<meta property="og:url" content="https://tokyocopyright.com/imprint.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/imprint.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Imprint</div>
      <h1>Imprint</h1>
      <p>Legal notice and information about the operator of this website.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <h2 class="mt-0">Site operator</h2>
      <dl class="deflist">
        <dt>Company</dt>
        <dd>Anime &amp; Manga Rights Council (AMRC)<br>
          <span class="small muted">アニメ・マンガ権利協議会</span></dd>
        <dt>Registered address</dt>
        <dd>
          4-6-10 Hitotsubashi<br>
          Chiyoda-ku, Tokyo 101-8050<br>
          Japan
        </dd>
        <dt>Email</dt>
        <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
        <dt>Telephone</dt>
        <dd><a href="tel:+81332306016">+81 3-3230-6016</a> (domestic 03-3230-6016)</dd>
        <dt>Business</dt>
        <dd>Collective anti-piracy and content protection on behalf of member companies</dd>
        <dt>Representative director</dt>
        <dd>Akihito Fukuhara</dd>
        <dt>Representative</dt>
        <dd>Ken Ishikawa</dd>
        <dt>Responsible for content</dt>
        <dd>Ken Ishikawa, at the address above</dd>
      </dl>


      <h2>Disclaimer</h2>

      <h3>Content of this site</h3>
      <p>
        The content of this website is provided for general information about our services.
        We take care to keep it accurate and current, but we give no guarantee that it is
        complete, accurate or up to date at any given moment. Nothing on this site is legal
        advice, and nothing on it forms a contract or a binding offer of services.
      </p>

      <h3>External links</h3>
      <p>
        Where this site links to external websites, those sites are outside our control. We
        check links at the time they are added, but we are not responsible for the content
        of any external site. If you believe a link from this site leads to unlawful
        content, please tell us and we will remove it.
      </p>

      <h3>Copyright in this site</h3>
      <p>
        The text, layout, graphics and code of this website are protected by copyright and
        belong to the Anime &amp; Manga Rights Council unless stated otherwise. Reproduction, adaptation or
        distribution beyond what copyright law permits requires our prior written consent.
        Personal, non-commercial use is permitted.
      </p>

      <h3>Trade marks</h3>
      <p>
        Product names, company names and marks referred to on this site belong to their
        respective owners and are used for identification purposes only. Their use does not
        imply any endorsement or affiliation.
      </p>

      <h2>Notices to us</h2>
      <p>
        Formal notices, including notices about content on this website, should be sent to
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> or by post to
        the registered address above. If you wish to dispute a takedown notice we have sent,
        follow the procedure set out on our
        <a href="public.html#counter-notice">public information page</a>.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle personal data is described in our
        <a href="privacy.html">privacy policy</a>.
      </p>

      <p class="small muted mt-3">Last updated: <span data-year>2026</span></p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /index.html
// ============================================================================
ASSETS["/index.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AMRC — Anime &amp; Manga Rights Council</title>
<meta name="description" content="The Anime &amp; Manga Rights Council is a member body of Japanese anime and manga companies acting together against the illegal distribution of their works worldwide.">
<meta name="keywords" content="anime anti piracy, manga anti piracy, scanlation, aggregator sites, content protection, takedown, DMCA, copyright enforcement, Japan, Tokyo">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/index.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="AMRC — Anime &amp; Manga Rights Council">
<meta property="og:description" content="Japanese anime and manga companies acting together against illegal distribution of their works, worldwide.">
<meta property="og:url" content="https://tokyocopyright.com/">
<meta property="og:image" content="https://tokyocopyright.com/assets/img/logo.svg">
<meta name="twitter:card" content="summary">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/index.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html" class="is-active">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="hero">
    <div class="wrap text-center">
      <span class="eyebrow">Established in Tokyo · Operating worldwide</span>
      <h1>Piracy ends where we begin.</h1>
      <div class="rule"></div>
      <p>
        The Anime &amp; Manga Rights Council is a member body of Japanese anime and manga
        companies. We locate illegal copies of our members' works across the open web,
        streaming portals, aggregator sites, file hosts, social platforms and messaging
        networks — and we get them removed, at scale, around the clock.
      </p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="members.html">Our members</a>
        <a class="btn btn-ghost" href="services.html">See how it works</a>
      </div>
    </div>
  </section>

  <section class="statement">
    <div class="wrap">
      <h2>
        Anime and manga are among the most pirated content in the world, and no single
        studio or publisher can meet that scale alone. Our members meet it
        <strong>together</strong> — pooling detection, evidence and enforcement across
        one shared platform, without ever suing a single fan.
      </h2>
    </div>
  </section>

  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>we never file</small>
          <div class="figure">None</div>
          <div class="label">Lawsuits against fans</div>
        </div>
        <div class="stat">
          <small>enforcement runs</small>
          <div class="figure">24/7</div>
          <div class="label">Every day of the year</div>
        </div>
        <div class="stat">
          <small>reviewed by a person</small>
          <div class="figure">Every</div>
          <div class="label">Borderline match</div>
        </div>
        <div class="stat">
          <small>we answer within</small>
          <div class="figure">1 day</div>
          <div class="label">Counter-notices, JST</div>
        </div>
      </div>
      <!-- These four are policies the Council sets for itself, so they are true by
           definition rather than by measurement. Swap in performance figures
           (titles protected, copies removed, removal rate) once you have data you
           can evidence — an unverifiable performance claim is the first thing an
           opposing lawyer or journalist will test. -->
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">What we do</span>
        <h2>One platform, every distribution channel</h2>
        <p>
          Pirated material does not stay in one place. Our crawlers and fingerprint
          matching follow it wherever it travels, and our notice pipeline reaches the
          parties who can actually take it down.
        </p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <div class="icon">01</div>
          <h3>Continuous monitoring</h3>
          <p>
            Search engines, streaming and cyberlocker sites, torrent indexes, IPTV
            portals, social video, cloud drives and closed messaging channels are swept
            continuously — new releases from the moment of publication.
          </p>
        </div>
        <div class="card">
          <div class="icon">02</div>
          <h3>Content fingerprinting</h3>
          <p>
            Video, audio and page-image fingerprints identify a member's work even when it
            has been re-encoded, cropped, mirrored, hardsubbed over, slowed down or
            re-uploaded under an unrelated title.
          </p>
        </div>
        <div class="card">
          <div class="icon">03</div>
          <h3>Automated takedown</h3>
          <p>
            Verified matches trigger properly formed notices to hosts, platforms, CDNs,
            registrars and search engines under the applicable law of each jurisdiction —
            in the correct language, day and night.
          </p>
        </div>
        <div class="card">
          <div class="icon">04</div>
          <h3>Search de-indexing</h3>
          <p>
            Infringing URLs are removed from search results so that pirated copies stop
            outranking the official release on the first page.
          </p>
        </div>
        <div class="card">
          <div class="icon">05</div>
          <h3>Simulcast protection</h3>
          <p>
            New episodes and theatrical premieres are monitored in real time from the
            moment they air, with a rapid-response window measured in minutes, not days.
          </p>
        </div>
        <div class="card">
          <div class="icon">06</div>
          <h3>Evidence &amp; reporting</h3>
          <p>
            Every notice, response and re-upload is logged with timestamps and preserved
            evidence — usable for reporting, negotiation, or escalation to counsel.
          </p>
        </div>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="services.html">Full service overview</a>
      </p>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">The process</span>
        <h2>From upload to removal</h2>
      </div>
      <div class="steps">
        <div class="step">
          <h3>Accession</h3>
          <p>A joining member lodges its catalogue and proof of rights. We build reference fingerprints and register the simulcast calendar.</p>
        </div>
        <div class="step">
          <h3>Detection</h3>
          <p>Crawlers and matching engines locate copies and near-copies across every monitored channel.</p>
        </div>
        <div class="step">
          <h3>Verification</h3>
          <p>Matches are scored and checked so that legitimate, licensed and fair-use material is never targeted.</p>
        </div>
        <div class="step">
          <h3>Removal</h3>
          <p>Notices go out automatically, re-uploads are caught, and results land in the member's dashboard.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">Why companies join</span>
          <h2>Enforcement that protects the fandom, not just the catalogue</h2>
          <p>
            Anime and manga are carried by their fans. Enforcement aimed at viewers and
            readers damages the very works it is meant to defend, so our members have bound
            the Council to a different model: we act against the infrastructure that
            distributes illegal copies, never against the audience.
          </p>
          <ul class="checklist">
            <li>No lawsuits, no cease-and-desist letters and no damages claims against fans — ever.</li>
            <li>No mass surveillance of private users; we index public and semi-public distribution only.</li>
            <li>Human review before any borderline notice leaves our system.</li>
            <li>A documented counter-notice route for anyone who believes a removal was wrong.</li>
          </ul>
          <p class="mb-0"><a href="public.html">Read our public commitments →</a></p>
        </div>
        <div class="split-figure">
          <h3>What membership gives you</h3>
          <p>
            Companies join when in-house teams can no longer keep pace with the volume of
            re-uploads — and because acting collectively carries weight that a single
            studio's notices do not.
          </p>
          <ul class="checklist">
            <li>Millions of notices processed per year</li>
            <li>Coverage in 30+ languages and scripts</li>
            <li>24/7 automated operation, JST-based support</li>
            <li>Direct trusted-flagger channels with major platforms</li>
            <li>API and dashboard access for your own team</li>
            <li>Shared intelligence on repeat-infringing networks</li>
            <li>One voice in dealings with the major platforms</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-ink">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Coverage</span>
        <h2>What we protect</h2>
      </div>
      <div class="grid grid-4">
        <div class="card card-flat">
          <h3>Broadcast &amp; simulcast anime</h3>
          <p class="small mb-0">Weekly episodes, unauthorised subs and dubs, embed portals and IPTV restreams.</p>
        </div>
        <div class="card card-flat">
          <h3>Manga &amp; serialisation</h3>
          <p class="small mb-0">Raw scans, scanlation mirrors, aggregator sites and pre-publication leaks.</p>
        </div>
        <div class="card card-flat">
          <h3>Features &amp; OVAs</h3>
          <p class="small mb-0">Theatrical releases, home video rips, box sets and screener leaks.</p>
        </div>
        <div class="card card-flat">
          <h3>Music &amp; audio works</h3>
          <p class="small mb-0">Opening and ending themes, soundtracks, drama CDs and unreleased material.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>Considering membership?</h2>
      <p>
        Send us a title and we will report back on where it is currently being
        distributed illegally, and what joining the Council would cover — with no
        obligation.
      </p>
      <a class="btn" href="contact.html">Request a piracy assessment</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Anime & Manga Rights Council",
  "url": "https://tokyocopyright.com",
  "logo": "https://tokyocopyright.com/assets/img/logo.svg",
  "email": "legal@tokyocopyright.com",
  "telephone": "+81-3-3230-6016",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "4-6-10 Hitotsubashi",
    "addressLocality": "Chiyoda-ku",
    "addressRegion": "Tokyo",
    "postalCode": "101-8050",
    "addressCountry": "JP"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "legal@tokyocopyright.com",
    "telephone": "+81-3-3230-6016",
    "availableLanguage": ["en", "ja"]
  }
}
</script>
</body>
</html>
`
};

// ============================================================================
//  /ja/404.html
// ============================================================================
ASSETS["/ja/404.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページが見つかりません — AMRC</title>
<meta name="description" content="お探しのページは見つかりませんでした。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/404.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/404.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/404.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/404.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="ページが見つかりません — AMRC">
<meta property="og:description" content="お探しのページは見つかりませんでした。">
<meta property="og:url" content="https://tokyocopyright.com/ja/404.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../404.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="section text-center">
    <div class="wrap">
      <span class="kicker">エラー 404</span>
      <h1>ページが見つかりませんでした</h1>
      <p class="lead">
        アドレスが変更されたか、リンクが古くなっている可能性があります。
      </p>
      <p class="mt-2">
        <a class="btn btn-primary" href="index.html">ホームに戻る</a>
        <a class="btn btn-dark" href="contact.html">お問い合わせ</a>
      </p>
      <p class="muted mt-3 mb-0">
        削除要請に異議をお持ちの方は、
        <a href="public.html#counter-notice">異議申立ての手順</a>をご覧ください。
      </p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/about.html
// ============================================================================
ASSETS["/ja/about.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>協議会について — AMRC</title>
<meta name="description" content="アニメ・マンガ権利協議会の成り立ち、活動の原則、運営体制、および加入の手続きについてご説明します。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/about.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/about.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/about.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/about.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="協議会について — AMRC">
<meta property="og:description" content="アニメ・マンガ権利協議会の成り立ち、活動の原則、運営体制、および加入の手続きについてご説明します。">
<meta property="og:url" content="https://tokyocopyright.com/ja/about.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../about.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html" class="is-active">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; 協議会について</div>
      <h1>協議会について</h1>
      <p>日本のアニメ・マンガ関連企業による会員制団体として、会員社が共同で利用する技術基盤を運営しています。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">私たちについて</span>
          <h2>法律事務所ではなく、共同の権利行使機関です</h2>
          <p>
            協議会は、ひとつの認識から生まれました。海賊版対策における制約は法制度ではなく、
            処理能力にあるということです。人気作品は一週間のうちに、数十のプラットフォームで
            数千回も再投稿されます。この量に単独で対応できる企業はなく、
            各社が個別に費用を負担しながら、同じ戦いに敗れ続けていました。
          </p>
          <p>
            そこで会員社は、ひとつの処理基盤を構築し、共同で利用することにしました。
            クローラー、フィンガープリント照合、通知送信は全作品を横断して稼働し続け、
            担当者は人の判断を要する案件——判定が分かれるもの、常習的な侵害者、
            要請に応じない事業者、掲載前の流出——に専念します。
          </p>
          <p class="mb-0">
            協議会は会員社の顧問弁護士と連携して活動します。これに代わるものではなく、
            法的助言を行うものでもありません。
          </p>
        </div>
        <div class="split-figure">
          <h3>概要</h3>
          <ul class="checklist">
            <li>事務局：東京都千代田区</li>
            <li>年中無休・24時間体制での権利行使</li>
            <li>30以上の言語で通知を送信</li>
            <li>会員社：アニメ制作会社、マンガ出版社、ライセンサー</li>
            <li>対応言語：日本語・英語</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">活動の原則</span>
        <h2>私たちが定めている制約</h2>
        <p>以下は宣伝文句ではなく、協議会を拘束する規則です。会員社の要請であっても、これを超えて行動することはありません。</p>
      </div>
      <div class="grid grid-3">
        <div class="card">
          <h3>ファンを対象としない</h3>
          <p>
            視聴者・読者・聴取者に対する提訴、請求、警告、督促は行いません。
            対象とするのは違法な複製の流通であり、受け手ではありません。
          </p>
        </div>
        <div class="card">
          <h3>量より正確性</h3>
          <p>
            誤った削除は正当な表現を奪い、会員社の信用を損ないます。
            照合の確度基準、ライセンシーの除外リスト、判断が分かれる案件の人による確認を、
            処理過程に組み込んでいます。
          </p>
        </div>
        <div class="card">
          <h3>段階的な対応</h3>
          <p>
            まず直接対処できるホスティング事業者・プラットフォームに要請し、
            応じられない場合に限り、レジストラ、決済事業者、検索エンジンへ段階を上げます。
          </p>
        </div>
        <div class="card">
          <h3>権利の確認を前提に</h3>
          <p>
            通知を一件でも送る前に、会員社が主張する権利を、主張する地域について実際に
            保有しているかを確認します。海外ライセンシーによる同時配信の権利関係も含みます。
          </p>
        </div>
        <div class="card">
          <h3>相手方への透明性</h3>
          <p>
            すべての通知に、送信者、依頼元、対象作品、法的根拠を明記し、
            異議がある場合の申立方法を案内しています。
          </p>
        </div>
        <div class="card">
          <h3>データの最小化</h3>
          <p>
            侵害の立証に必要な証拠のみを記録し、それ以上は収集しません。
            個人の利用者のプロファイルを作成することはありません。
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">加入について</span>
      <h2>加入までの流れ</h2>
      <p>
        多くの場合、まず侵害状況の調査から始まります。加入をご検討の企業から数作品をお預かりし、
        現在どこで、どの程度の規模で違法に流通しているかをご報告します。
        この報告書は、加入されるかどうかにかかわらずお渡しします。
      </p>
      <p>
        お進みいただく場合、加入手続きは数日で完了します。作品リストと権利の証明をお預かりし、
        照合用フィンガープリントを生成し、同時配信・連載のスケジュールを登録します。
        これにより、最新話や新章は公開の瞬間から保護対象となります。あわせて、
        ダッシュボードとAPIの認証情報を発行します。
      </p>
      <p>
        以後、システムは自動で稼働します。会員社には定期報告、検出・削除状況のリアルタイム表示、
        権利行使方針を決定する会員総会での議決権、そして人の対応が必要な場合の
        東京の専任担当者が提供されます。
      </p>

      <div class="notice mt-2">
        <p>
          <strong>ご留意ください：</strong>協議会は会員社に対し技術的な権利行使業務を提供します。
          法律事務所ではなく、本サイトの記載は法的助言を構成するものではありません。
          訴訟が適切な場合には、会員社の代理人に対し証拠と報告を提供して支援します。
        </p>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">運営体制</span>
        <h2>協議会の運営</h2>
        <p>協議会は会員社から与えられた権限の範囲でのみ活動します。その権限は、明文化されています。</p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <h3>会員総会</h3>
          <p>
            正会員は保有作品の規模にかかわらず、一社一議決権を有します。
            総会は権利行使方針を定め、新規会員を承認し、予算を議決します。
          </p>
        </div>
        <div class="card">
          <h3>事務局</h3>
          <p>
            千代田区の常設チームが、総会の定めた方針の範囲内で日々の権利行使を担います。
            事務局の判断で対象範囲を広げることはできません。
          </p>
        </div>
        <div class="card">
          <h3>権利行使規程</h3>
          <p>
            前掲の原則は協議会の規程に明記されています。会員社が事務局に対し、
            ファンへの措置や、権利を有しない作品についての通知を指示することはできません。
          </p>
        </div>
      </div>

    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>作品の被害状況をご確認になりますか</h2>
      <p>数作品をお知らせいただければ、調査のうえ書面でご報告します。</p>
      <a class="btn" href="contact.html">調査を依頼する</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/contact.html
// ============================================================================
ASSETS["/ja/contact.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>お問い合わせ — AMRC</title>
<meta name="description" content="アニメ・マンガ権利協議会へのお問い合わせ。加入のご相談、侵害の報告、異議申立て、取材：legal@tokyocopyright.com / 03-3230-6016">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/contact.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/contact.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/contact.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/contact.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="お問い合わせ — AMRC">
<meta property="og:description" content="アニメ・マンガ権利協議会へのお問い合わせ。加入のご相談、侵害の報告、異議申立て、取材：legal@tokyocopyright.com / 03-3230-6016">
<meta property="og:url" content="https://tokyocopyright.com/ja/contact.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../contact.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html" class="is-active">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; お問い合わせ</div>
      <h1>お問い合わせ</h1>
      <p>加入のご相談、侵害の報告、通知に関する異議申立て、取材のいずれも、以下の窓口で承ります。日本語・英語のどちらでもお受けしています。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split split-top">

        <div>
          <span class="kicker">お問い合わせフォーム</span>
          <h2>ご用件をお聞かせください</h2>
          <p>
            保護をご希望の内容、または解決をご希望の事項をお知らせください。
            加入に関するお問い合わせには、1営業日以内（日本時間）にご返信します。
          </p>

          <form id="contact-form"
                method="post"
                action="../contact.php"
                data-endpoint="../contact.php"
                data-mailbox="legal@tokyocopyright.com"
                novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="f-name">お名前 <span class="req">*</span></label>
                <input id="f-name" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="f-company">会社・団体名</label>
                <input id="f-company" name="company" type="text" autocomplete="organization">
              </div>
              <div class="field">
                <label for="f-email">メールアドレス <span class="req">*</span></label>
                <input id="f-email" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="f-phone">電話番号</label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel">
              </div>
              <div class="field">
                <label for="f-subject">お問い合わせ区分</label>
                <select id="f-subject" name="subject">
                  <option>加入について</option>
                  <option>侵害状況の調査依頼</option>
                  <option>自社作品の侵害報告</option>
                  <option>異議申立て・削除への不服</option>
                  <option>プラットフォーム／ホスティング事業者</option>
                  <option>取材・研究</option>
                  <option>その他</option>
                </select>
              </div>
              <div class="field">
                <label for="f-rights">作品の種別</label>
                <select id="f-rights" name="rights">
                  <option>アニメ — 放送・同時配信</option>
                  <option>アニメ — 劇場作品・OVA</option>
                  <option>マンガ・連載作品</option>
                  <option>ライトノベル・出版物</option>
                  <option>音楽・サウンドトラック・ドラマCD</option>
                  <option>商品・公式イラスト</option>
                  <option>該当なし</option>
                </select>
              </div>
              <div class="field field-full">
                <label for="f-message">お問い合わせ内容 <span class="req">*</span></label>
                <textarea id="f-message" name="message" required
                  placeholder="対象作品、すでに把握されているURL、ご希望の対応内容をご記入ください。"></textarea>
                <span class="hint">パスワードや試写用の認証情報など、秘匿すべき情報は記入しないでください。</span>
              </div>

              <div class="field field-trap" aria-hidden="true">
                <label for="f-website">この欄は空欄のままにしてください</label>
                <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
              </div>

              <div class="field-check">
                <input id="f-consent" name="consent" type="checkbox" value="yes" required>
                <label for="f-consent">
                  本お問い合わせへの回答のため、当協議会が上記の情報を保管・利用することに同意します
                  （<a href="privacy.html">プライバシーポリシー</a>）。<span class="req">*</span>
                </label>
              </div>
            </div>

            <p class="mt-2">
              <button class="btn btn-primary" type="submit">送信する</button>
            </p>
            <div id="form-status" class="form-status"></div>
            <noscript>
              <div class="notice mt-2">
                <p>
                  このフォームの送信にはJavaScriptが必要です。
                  <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
                  まで直接メールでご連絡ください。
                </p>
              </div>
            </noscript>
          </form>
        </div>

        <div>
          <div class="card">
            <span class="kicker">事務局</span>
            <h3>アニメ・マンガ権利協議会</h3>
            <dl class="deflist">
              <dt>所在地</dt>
              <dd>
                〒101-8050<br>
                東京都千代田区一ツ橋4-6-10
              </dd>
              <dt>メール</dt>
              <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
              <dt>電話</dt>
              <dd><a href="tel:+81332306016">03-3230-6016</a><br>
                  <span class="small muted">海外から：+81 3-3230-6016</span></dd>
              <dt>受付時間</dt>
              <dd>平日 9:00–18:00（日本時間）<br>
                  <span class="small muted">監視システムは24時間稼働しています</span></dd>
              <dt>対応言語</dt>
              <dd>日本語・English</dd>
            </dl>
          </div>

          <div class="card mt-2">
            <h3>ご用件別の窓口</h3>
            <ul class="checklist mb-0">
              <li><strong>加入・調査依頼</strong> — 本フォーム、または上記アドレスへ。</li>
              <li><strong>削除への不服</strong> — 件名を<em>「異議申立て」</em>としてメールを。手順は<a href="public.html#counter-notice">こちら</a>。</li>
              <li><strong>プラットフォーム事業者</strong> — 件名を<em>「プラットフォーム連携」</em>として、直接報告の設定をご相談ください。</li>
              <li><strong>取材・研究</strong> — 件名を<em>「取材」</em>としてご連絡ください。</li>
            </ul>
          </div>

          <div class="notice notice-info mt-2">
            <p class="mb-0">
              <strong>会員社作品の侵害を報告される場合</strong>は、作品名、分かる範囲での権利者、
              すでに把握されているURLをお知らせください。初回のご返信で対応に着手できます。
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">所在地</span>
        <h2>東京都千代田区</h2>
        <p>
          事務局は千代田区一ツ橋にあります。ご来訪は事前予約制です。
          あらかじめメールにてご連絡ください。
        </p>
      </div>
      <p class="text-center mb-0">
        <a class="btn btn-dark"
           href="https://www.google.com/maps/search/?api=1&amp;query=東京都千代田区一ツ橋4-6-10"
           target="_blank" rel="noopener noreferrer">地図で見る</a>
      </p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/imprint.html
// ============================================================================
ASSETS["/ja/imprint.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>運営者情報 — AMRC</title>
<meta name="description" content="アニメ・マンガ権利協議会の運営者情報、免責事項、著作権表示。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/imprint.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/imprint.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/imprint.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/imprint.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="運営者情報 — AMRC">
<meta property="og:description" content="アニメ・マンガ権利協議会の運営者情報、免責事項、著作権表示。">
<meta property="og:url" content="https://tokyocopyright.com/ja/imprint.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../imprint.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; 運営者情報</div>
      <h1>運営者情報</h1>
      <p>本サイトの運営者に関する情報および法的表示です。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <h2 class="mt-0">運営者</h2>
      <dl class="deflist">
        <dt>名称</dt>
        <dd>アニメ・マンガ権利協議会（AMRC）<br>
          <span class="small muted">Anime &amp; Manga Rights Council</span></dd>
        <dt>所在地</dt>
        <dd>
          〒101-8050<br>
          東京都千代田区一ツ橋4-6-10
        </dd>
        <dt>メール</dt>
        <dd><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></dd>
        <dt>電話</dt>
        <dd><a href="tel:+81332306016">03-3230-6016</a></dd>
        <dt>代表取締役</dt>
        <dd>Akihito Fukuhara</dd>
        <dt>代表者</dt>
        <dd>Ken Ishikawa</dd>
        <dt>事業内容</dt>
        <dd>会員社を代理する著作権保護および海賊版対策業務</dd>
        <dt>本サイトの管理責任者</dt>
        <dd>Ken Ishikawa（上記所在地）</dd>
      </dl>


      <h2>免責事項</h2>

      <h3>掲載内容について</h3>
      <p>
        本サイトの内容は、当協議会の活動に関する一般的な情報提供を目的としています。
        正確かつ最新の状態を保つよう努めていますが、内容の完全性、正確性、
        最新性を保証するものではありません。本サイトの記載は法的助言を構成せず、
        契約の申込みまたは業務提供の確定的な申出を構成するものでもありません。
      </p>

      <h3>外部リンクについて</h3>
      <p>
        本サイトから外部サイトへリンクしている場合、当該サイトは当協議会の管理下にありません。
        掲載時に確認は行っていますが、外部サイトの内容について責任を負いかねます。
        本サイトからのリンク先に違法な内容があるとお気づきの場合は、ご連絡いただければ削除します。
      </p>

      <h3>本サイトの著作権</h3>
      <p>
        本サイトの文章、レイアウト、図版、コードは著作権により保護されており、
        特段の記載がない限りアニメ・マンガ権利協議会に帰属します。
        著作権法上認められる範囲を超える複製、翻案、頒布には、事前の書面による許諾が必要です。
        私的かつ非商業的な利用は認められます。
      </p>

      <h3>商標について</h3>
      <p>
        本サイトに記載の製品名、会社名、標章は各権利者に帰属し、識別のためにのみ使用しています。
        使用は、推奨または提携関係を意味するものではありません。
      </p>

      <h2>当協議会への通知</h2>
      <p>
        本サイトの掲載内容に関するものを含む正式なご通知は、
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        または上記所在地宛にご送付ください。当協議会が送信した削除要請に異議がある場合は、
        <a href="public.html#counter-notice">一般の皆様へ</a>のページに記載の手順に従ってください。
      </p>

      <h2>個人情報の取扱い</h2>
      <p>
        個人情報の取扱いについては<a href="privacy.html">プライバシーポリシー</a>をご覧ください。
      </p>

      <p class="small muted mt-3">最終更新：<span data-year>2026</span>年</p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/index.html
// ============================================================================
ASSETS["/ja/index.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AMRC — アニメ・マンガ権利協議会</title>
<meta name="description" content="アニメ・マンガ権利協議会（AMRC）は、日本のアニメ・マンガ関連企業による会員制団体です。会員社の作品の違法流通に対し、世界規模で共同対処しています。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/index.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/index.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/index.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/index.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="AMRC — アニメ・マンガ権利協議会">
<meta property="og:description" content="アニメ・マンガ権利協議会（AMRC）は、日本のアニメ・マンガ関連企業による会員制団体です。会員社の作品の違法流通に対し、世界規模で共同対処しています。">
<meta property="og:url" content="https://tokyocopyright.com/ja/index.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../index.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html" class="is-active">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="hero">
    <div class="wrap text-center">
      <span class="eyebrow">東京発・世界規模で活動</span>
      <h1>海賊版は、ここで終わる。</h1>
      <div class="rule"></div>
      <p>
        アニメ・マンガ権利協議会（AMRC）は、日本のアニメ・マンガ関連企業による会員制団体です。
        会員社の作品の違法な複製を、一般のウェブサイト、配信ポータル、まとめサイト、ファイルホスト、
        SNS、メッセージングサービスに至るまで検出し、24時間体制で削除しています。
      </p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="members.html">会員社一覧</a>
        <a class="btn btn-ghost" href="services.html">活動内容を見る</a>
      </div>
    </div>
  </section>

  <section class="statement">
    <div class="wrap">
      <h2>
        アニメとマンガは、世界で最も海賊版の被害を受けているコンテンツのひとつです。
        その規模は、一社単独で対応できるものではありません。会員社は
        <strong>共同で</strong>これに向き合い、検出・証拠保全・権利行使を一つの基盤に集約しています。
        ファン個人を提訴することは、一切ありません。
      </h2>
    </div>
  </section>

  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>一切行いません</small>
          <div class="figure">なし</div>
          <div class="label">ファンへの法的措置</div>
        </div>
        <div class="stat">
          <small>稼働体制</small>
          <div class="figure">24/7</div>
          <div class="label">年中無休で監視</div>
        </div>
        <div class="stat">
          <small>担当者が確認</small>
          <div class="figure">全件</div>
          <div class="label">判断の分かれる案件</div>
        </div>
        <div class="stat">
          <small>回答の目安</small>
          <div class="figure">1営業日</div>
          <div class="label">異議申立てへの回答</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">活動内容</span>
        <h2>あらゆる流通経路を、一つの基盤で</h2>
        <p>
          違法な複製は一箇所に留まりません。クローラーとフィンガープリント照合が拡散を追跡し、
          実際に削除を実行できる事業者へ通知を届けます。
        </p>
      </div>

      <div class="grid grid-3">
        <div class="card">
          <div class="icon">01</div>
          <h3>継続的なモニタリング</h3>
          <p>
            検索エンジン、配信・アップローダーサイト、トレントインデックス、IPTVポータル、
            SNS動画、クラウドストレージ、非公開のメッセージチャンネルまでを継続的に巡回します。
            新作は公開直後から対象となります。
          </p>
        </div>
        <div class="card">
          <div class="icon">02</div>
          <h3>コンテンツ・フィンガープリント</h3>
          <p>
            映像・音声・誌面画像の特徴量照合により、再エンコード、トリミング、左右反転、
            字幕の焼き込み、再生速度の変更、無関係なタイトルでの再投稿を経ても、
            会員社の作品を特定します。
          </p>
        </div>
        <div class="card">
          <div class="icon">03</div>
          <h3>削除要請の送信</h3>
          <p>
            照合・検証を経た案件について、ホスティング事業者、プラットフォーム、CDN、
            レジストラ、検索エンジンに対し、各国の適用法令に基づく削除要請を、
            相手方の言語で昼夜を問わず送信します。
          </p>
        </div>
        <div class="card">
          <div class="icon">04</div>
          <h3>検索結果からの削除</h3>
          <p>
            侵害URLを検索結果から削除し、海賊版が正規配信より上位に表示される状態を解消します。
          </p>
        </div>
        <div class="card">
          <div class="icon">05</div>
          <h3>同時配信の保護</h3>
          <p>
            最新話の配信や劇場公開については、放映開始の瞬間からリアルタイムで監視し、
            数日ではなく数分単位での対応を目標としています。
          </p>
        </div>
        <div class="card">
          <div class="icon">06</div>
          <h3>証拠保全と報告</h3>
          <p>
            すべての通知・回答・再投稿を、日時とともに記録・保全します。
            報告、交渉、代理人への引き継ぎのいずれにも利用できる形式で保管します。
          </p>
        </div>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="services.html">活動内容の詳細</a>
      </p>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">対応の流れ</span>
        <h2>投稿の検出から削除まで</h2>
      </div>
      <div class="steps">
        <div class="step">
          <h3>加入</h3>
          <p>加入時に作品リストと権利の証明をご提出いただき、照合用フィンガープリントと配信スケジュールを登録します。</p>
        </div>
        <div class="step">
          <h3>検出</h3>
          <p>クローラーと照合エンジンが、監視対象のあらゆる経路から複製・類似コンテンツを検出します。</p>
        </div>
        <div class="step">
          <h3>検証</h3>
          <p>検出結果を評価・確認し、正規配信、ライセンス許諾済みの利用、法令上認められる利用を対象外とします。</p>
        </div>
        <div class="step">
          <h3>削除</h3>
          <p>通知を自動送信し、再投稿を捕捉します。結果は会員社のダッシュボードに反映されます。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <span class="kicker">加入の理由</span>
          <h2>作品だけでなく、ファンも守る権利行使</h2>
          <p>
            アニメとマンガは、ファンによって支えられています。視聴者や読者に向けた権利行使は、
            守るべき作品そのものを傷つけます。そのため会員社は、協議会に対し明確な制約を課しています。
            私たちが対処するのは違法な複製を流通させる仕組みであり、ファンではありません。
          </p>
          <ul class="checklist">
            <li>ファンに対する提訴、警告書の送付、損害賠償請求は一切行いません。</li>
            <li>個人利用者の監視は行いません。公開・半公開の流通のみを対象とします。</li>
            <li>判断の分かれる案件は、送信前に必ず担当者が確認します。</li>
            <li>削除が誤りと思われる場合のため、異議申立ての窓口を明示しています。</li>
          </ul>
          <p class="mb-0"><a href="public.html">私たちの約束を読む →</a></p>
        </div>
        <div class="split-figure">
          <h3>会員社が得られるもの</h3>
          <p>
            社内体制では再投稿の量に対応しきれなくなったとき、そして単独の通知にはない重みを
            共同での行動が持つために、各社は協議会に加入します。
          </p>
          <ul class="checklist">
            <li>年間を通じた大量の通知処理</li>
            <li>30以上の言語・文字体系に対応</li>
            <li>24時間365日の自動運用と、日本時間でのサポート</li>
            <li>主要プラットフォームとの信頼済み報告経路の利用</li>
            <li>自社システムと連携できるAPI・ダッシュボード</li>
            <li>常習的な侵害ネットワークに関する情報の共有</li>
            <li>プラットフォームとの交渉における統一した窓口</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-ink">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">対象範囲</span>
        <h2>保護の対象</h2>
      </div>
      <div class="grid grid-4">
        <div class="card card-flat">
          <h3>放送・同時配信アニメ</h3>
          <p class="small mb-0">毎話の配信、無許諾の字幕・吹替、埋め込みポータル、IPTVによる再配信。</p>
        </div>
        <div class="card card-flat">
          <h3>マンガ・連載作品</h3>
          <p class="small mb-0">生スキャン、無断翻訳版のミラー、まとめサイト、掲載前の流出。</p>
        </div>
        <div class="card card-flat">
          <h3>劇場作品・OVA</h3>
          <p class="small mb-0">劇場公開作品、パッケージのリッピング、BOX商品、試写用素材の流出。</p>
        </div>
        <div class="card card-flat">
          <h3>音楽・音声作品</h3>
          <p class="small mb-0">主題歌、サウンドトラック、ドラマCD、未発表音源。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討中ですか</h2>
      <p>
        作品名をお知らせいただければ、現在どこで違法に流通しているかを調査し、
        加入によって何が対象となるかをご報告します。費用や義務は発生しません。
      </p>
      <a class="btn" href="contact.html">侵害状況の調査を依頼する</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/members.html
// ============================================================================
ASSETS["/ja/members.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>会員社 — AMRC</title>
<meta name="description" content="アニメ・マンガ権利協議会を構成するアニメ制作会社、マンガ出版社、ライセンサーの一覧です。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/members.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/members.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/members.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/members.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="会員社 — AMRC">
<meta property="og:description" content="アニメ・マンガ権利協議会を構成するアニメ制作会社、マンガ出版社、ライセンサーの一覧です。">
<meta property="og:url" content="https://tokyocopyright.com/ja/members.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../members.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html" class="is-active">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; 会員社</div>
      <h1>会員社</h1>
      <p>協議会は、以下のアニメ制作会社・マンガ出版社・ライセンサーを代理して活動します。各社は特定の作品について権利行使を委任しています。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">

      <div class="section-title mt-3">
        <span class="kicker">会員構成</span>
        <h2>協議会が代理する企業</h2>
        <p>
          正会員は保有作品を協議会に委任し、会員総会に議席を有し、権利行使規程に拘束されます。
        </p>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>マンガ出版社</h3>
          <span class="count">&mdash; 社</span>
        </div>
        <ul class="roster">
          <!-- 出版社をここに追加してください（一社一行）:
               <li><span class="name">株式会社◯◯</span><span class="meta">2024年より</span></li>
               .meta は省略可能です。 -->
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
        </ul>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>アニメ制作会社</h3>
          <span class="count">&mdash; 社</span>
        </div>
        <ul class="roster">
          <!-- 制作会社をここに追加してください。形式は上記と同じです。 -->
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
          <li class="is-empty"><span class="name">会員社名</span><span class="meta">20XX年より</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap prose">
      <span class="kicker">掲載の意味</span>
      <h2>会員であることが示す範囲</h2>
      <p>
        この一覧は、プラットフォームやホスティング事業者が、当協議会からの通知が正当な権限に
        基づくものかを確認するための情報です。そのため、何を示すものかを明確にしておきます。
      </p>
      <ul class="checklist">
        <li>掲載各社は、委任した作品について協議会を代理人として指名しています。それ以上の権限はありません。</li>
        <li>会員となることで著作権が移転することはありません。各作品の権利は権利者に帰属したままです。</li>
        <li>会員社のライセンシーおよび正規配信経路は除外リストに登録され、対象となることはありません。</li>
        <li>協議会は会員社以外を代理せず、業界全体を代表するものでもありません。</li>
        <li>掲載の社名および標章は各社に帰属し、許諾を得て表示しています。</li>
      </ul>

      <div class="notice notice-info">
        <p class="mb-0">
          通知の正当性を確認されるプラットフォームの担当者様は、通知に記載の参照番号を添えて
          <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
          までご連絡ください。当該作品についての委任状況をご回答します。
        </p>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討の企業様へ</h2>
      <p>
        貴社作品の現在の違法流通状況を調査し、加入によって何が対象となるかをご説明します。
        費用や義務は発生しません。
      </p>
      <a class="btn" href="contact.html">加入について問い合わせる</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/privacy.html
// ============================================================================
ASSETS["/ja/privacy.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>プライバシーポリシー — AMRC</title>
<meta name="description" content="アニメ・マンガ権利協議会における個人情報の取得、利用、保管、保護の方針。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/privacy.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/privacy.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/privacy.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/privacy.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="プライバシーポリシー — AMRC">
<meta property="og:description" content="アニメ・マンガ権利協議会における個人情報の取得、利用、保管、保護の方針。">
<meta property="og:url" content="https://tokyocopyright.com/ja/privacy.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../privacy.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; プライバシーポリシー</div>
      <h1>プライバシーポリシー</h1>
      <p>本サイトおよび当協議会の業務における個人情報の取扱いについてご説明します。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <h2>1. 事業者</h2>
      <p>
        アニメ・マンガ権利協議会（〒101-8050 東京都千代田区一ツ橋4-6-10）が、
        本サイトを通じて取得する個人情報について責任を負います。本ポリシーまたは
        個人情報に関するお問い合わせは、
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        または <a href="tel:+81332306016">03-3230-6016</a> までご連絡ください。
      </p>

      <h2>2. 取得する情報</h2>

      <h3>2.1 本サイトのご利用時</h3>
      <p>
        ページの要求時に、ホスティング事業者が標準的なサーバーログを記録します。
        要求元のIPアドレス、日時、要求されたページ、参照元ページ、
        ブラウザおよびOSの情報が含まれます。これはサイトの提供と、
        不正利用・技術的障害の検知に必要なものです。ログは短期間の保存後に削除されます。
      </p>

      <h3>2.2 お問い合わせフォームのご利用時</h3>
      <p>
        ご入力いただいたお名前、会社・団体名、メールアドレス、電話番号（ご記入の場合）、
        お問い合わせ区分、内容を取得します。これらはご回答および、
        その後の取引関係の管理のためにのみ利用します。取引に至らなかった場合、
        必要がなくなった時点で削除します。
      </p>

      <h3>2.3 権利行使業務において</h3>
      <p>
        侵害コンテンツの検出および対応にあたり、公開されている掲載情報について証拠を記録します。
        URL、ファイル識別情報、ページの内容、日時、および表示されている投稿者名が含まれ、
        これらは個人情報に該当し得ます。当協議会は、個々の視聴者を特定しようとせず、
        通信事業者から契約者情報を取得せず、利用者の行動プロファイルを作成しません。
      </p>

      <h3>2.4 クッキーおよびアクセス解析</h3>
      <p>
        本サイトは広告クッキーおよび第三者によるトラッキングクッキーを使用していません。
        アクセス解析を利用する場合は、プライバシーに配慮した方式とし、
        サイトを跨いだ追跡は行いません。同意が必要な場合は、
        必須でないクッキーの設定前に同意を取得します。
      </p>

      <h2>3. 利用目的</h2>
      <ul>
        <li>お問い合わせへの回答のため。</li>
        <li>契約の履行、または契約締結に向けた準備のため。</li>
        <li>サイトの安全な運営および著作権の保護という、当協議会および会員社の正当な利益のため。</li>
        <li>記録保存および適法な請求への対応を含む、法令上の義務の履行のため。</li>
        <li>ご同意をいただいた場合、その際にお示しした目的のため。</li>
      </ul>

      <h2>4. 第三者提供</h2>
      <p>個人情報を販売することはありません。必要な範囲でのみ提供します。</p>
      <ul>
        <li>サイトのホスティング、メール送信、データ保管を行う委託先（契約に基づき、当協議会の指示の範囲で）</li>
        <li>個別の権利行使を依頼した会員社</li>
        <li>削除要請の性質上、対象物および通知者を特定する必要がある範囲で、プラットフォームおよびホスティング事業者</li>
        <li>必要な場合、当協議会の専門家（弁護士等）</li>
        <li>法令に基づき求められる場合、行政機関または裁判所</li>
      </ul>

      <h2>5. 国外移転</h2>
      <p>
        当協議会の業務は世界を対象とするため、他国のプラットフォームやホスティング事業者へ
        通知を送信する際などに、情報が日本国外へ移転されることがあります。
        個人情報を含む移転については、適用法令が認める適切な保護措置に基づいて行います。
      </p>

      <h2>6. 保存期間</h2>
      <p>
        お問い合わせの記録は、回答に必要な期間および合理的な期間経過後まで保存します。
        会員社に関する記録は、関係の継続期間および日本の商法・税法上必要とされる期間保存します。
        権利行使の証拠は、通知を裏付け、または防御するために必要となり得る期間保存します。
        サーバーログは短期間で削除します。
      </p>

      <h2>7. ご本人の権利</h2>
      <p>
        適用される法令に従い、保有する個人情報の有無の確認、開示、訂正、削除、
        利用停止・利用への異議、および同意の撤回を求めることができます。
        同意の撤回は、それ以前に行われた取扱いの適法性に影響しません。
      </p>
      <p>
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        までご連絡ください。1か月以内に回答します。ご本人であることの確認を
        させていただく場合があります。回答にご納得いただけない場合は、
        個人情報保護委員会またはお住まいの国の監督機関に申し立てることができます。
      </p>

      <h2>8. 安全管理</h2>
      <p>
        リスクに応じた技術的・組織的な安全管理措置を講じています。通信の暗号化、
        必要最小限のアクセス権限、重要システムへのアクセス記録、定期的な見直しを含みます。
        完全に安全なシステムは存在しませんが、保有する情報を必要な範囲に留めるよう努めています。
      </p>

      <h2>9. お子様について</h2>
      <p>
        本サイトは事業者および権利者の方を対象としています。
        お子様から意図的に個人情報を取得することはありません。
      </p>

      <h2>10. 本ポリシーの変更</h2>
      <p>
        業務内容または法令の変更に応じて、本ポリシーを改定することがあります。
        最新版は常に本ページに掲載します。重要な変更については本ページでお知らせします。
      </p>

      <h2>11. お問い合わせ先</h2>
      <p>
        アニメ・マンガ権利協議会<br>
        〒101-8050 東京都千代田区一ツ橋4-6-10<br>
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> ·
        <a href="tel:+81332306016">03-3230-6016</a>
      </p>

      <p class="small muted mt-3">最終更新：<span data-year>2026</span>年</p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/public.html
// ============================================================================
ASSETS["/ja/public.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>一般の皆様へ — AMRC</title>
<meta name="description" content="プラットフォーム事業者、ホスティング事業者、投稿者の皆様へ。当協議会の通知の内容、対応方法、異議申立ての手順をご案内します。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/public.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/public.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/public.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/public.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="一般の皆様へ — AMRC">
<meta property="og:description" content="プラットフォーム事業者、ホスティング事業者、投稿者の皆様へ。当協議会の通知の内容、対応方法、異議申立ての手順をご案内します。">
<meta property="og:url" content="https://tokyocopyright.com/ja/public.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../public.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html">活動内容</a>
      <a href="public.html" class="is-active">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; 一般の皆様へ</div>
      <h1>一般の皆様へ</h1>
      <p>プラットフォーム運営者、ホスティング事業者、サイト管理者、投稿者の皆様、および当協議会の通知を受け取られた方、活動内容をお知りになりたい方に向けたご案内です。</p>
    </div>
  </section>

  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>一切ありません</small>
          <div class="figure">0件</div>
          <div class="label">ファンへの法的請求</div>
        </div>
        <div class="stat">
          <small>担当者が確認</small>
          <div class="figure">全件</div>
          <div class="label">判断の分かれる案件</div>
        </div>
        <div class="stat">
          <small>誤りが判明した場合</small>
          <div class="figure">撤回</div>
          <div class="label">直ちに取り下げます</div>
        </div>
        <div class="stat">
          <small>回答の目安</small>
          <div class="figure">1営業日</div>
          <div class="label">異議申立てへの回答</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <span class="kicker">私たちの約束</span>
      <h2>行うこと、行わないこと</h2>
      <p>
        海賊版対策は、何も悪いことをしていない方を含め、現実の人々に影響します。
        そのため、私たちが自らに課している制約を公開しています。
      </p>
      <ul class="checklist">
        <li><strong>ファンを対象としません。</strong>視聴者・読者・聴取者に対する提訴、和解金の請求、督促、警告書の送付は行いません。</li>
        <li><strong>正当な利用を対象としません。</strong>批評、論評、パロディ、報道、教育目的その他法令上認められる利用は、権利行使の対象外です。</li>
        <li><strong>権利を確認してから行動します。</strong>会員社が主張する権利を保有していることを確認するまで、通知は送信しません。</li>
        <li><strong>差出人を明示します。</strong>すべての通知に、送信者、依頼元、対象作品、法的根拠を記載しています。</li>
        <li><strong>誤りを認めます。</strong>削除が誤りであったと示された場合、速やかに、争わずに是正します。</li>
        <li><strong>データを最小限にします。</strong>侵害の立証に必要な記録のみを保持し、個人のプロファイルは作成しません。</li>
      </ul>

      <hr>

      <span class="kicker">事業者の皆様へ</span>
      <h2>当協議会から通知を受け取られた場合</h2>
      <p>
        当協議会の通知は自動生成されますが、一件ごとに検証されています。通知には、
        対象作品の特定情報、侵害しているURLまたはファイル、依頼元の会員社、法的根拠、
        連絡先、および固有の参照番号が記載されています。
      </p>
      <p>
        最も早い解決方法は、記載のURLに対処し、参照番号を添えて通知記載のアドレスへご返信いただくことです。
        通知の内容に誤りがあるとお考えの場合は、その旨をお知らせください。
        誤った通知が実行されるより、撤回する方を望みます。
      </p>
      <p>
        利用者投稿の多いサービスを運営されている場合、メールに代えて直接または自動での報告経路を
        設定することも可能です。件名を「プラットフォーム連携」として
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> までご連絡ください。
      </p>

      <hr>

      <h2 id="counter-notice">異議申立ての手順</h2>
      <p>
        当協議会の通知によりコンテンツが削除され、その削除が誤りであるとお考えの場合——
        権利を保有している、許諾を得ている、または法令上認められる利用である場合——
        異議を申し立てることができます。削除を行ったプラットフォームを通じてでも、
        当協議会へ直接でも構いません。
      </p>
      <p>
        当協議会へ申し立てる場合は、件名を<strong>「異議申立て」</strong>として
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> 宛に、
        以下をご記載のうえご連絡ください。
      </p>
      <ol>
        <li>通知に記載された参照番号（お分かりになる場合）</li>
        <li>削除された対象の正確なURLまたは識別情報</li>
        <li>お名前、およびご連絡可能な住所・メールアドレス</li>
        <li>削除が誤りであるとお考えの理由（権利の保有、許諾の有無、認められる利用である旨など）</li>
        <li>これを裏付ける資料（許諾契約、契約書、リリース等）</li>
      </ol>
      <p>
        1営業日以内（日本時間）の回答、および5営業日以内の解決を目標としています。
        通知が誤りであったと判断した場合は、これを撤回し、プラットフォームに復旧を要請します。
        見解が異なる場合は、その理由を書面でお伝えします。プラットフォームまたは
        ご自身の法律顧問を通じて、さらに手続を進めていただくことができます。
      </p>

      <div class="notice notice-info">
        <p>
          異議申立てには法的な効果が生じる場合があり、プラットフォームによっては
          連絡先が権利者に開示されることがあります。本記載は法的助言ではありません。
          ご不明な点は、お住まいの地域の弁護士にご相談ください。
        </p>
      </div>

      <hr>

      <span class="kicker">権利者の皆様へ</span>
      <h2>ご自身の作品の被害を報告する</h2>
      <p>
        権利者の方で、ご自身の作品が違法に流通しているのを見つけられた場合は、
        <a href="contact.html">お問い合わせフォーム</a>または
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> までご連絡ください。
        作品名、権利を保有していることの証明、すでに把握されているURLをお知らせいただけると助かります。
      </p>
      <p>
        当協議会が代理できるのは会員社に限られますが、取り得る選択肢をお伝えし、
        当協議会の対象外の事案については適切な窓口をご案内します。
        加入により対応可能となるかどうかも、あわせてお答えします。
      </p>

      <hr>

      <span class="kicker">報道・研究の皆様へ</span>
      <h2>取材・研究のお問い合わせ</h2>
      <p>
        オンライン海賊版、プラットフォームの責任、通知実務について取材・研究をされている
        記者・研究者の方は、<a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>
        までご連絡ください。手法および集計値については通常お話しできますが、
        会員社の個別情報および案件の詳細は非公開です。
      </p>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>その他のお問い合わせ</h2>
      <p>通知、異議申立て、プラットフォーム連携、取材——いずれも同じ窓口で承ります。</p>
      <a class="btn" href="contact.html">お問い合わせ</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /ja/services.html
// ============================================================================
ASSETS["/ja/services.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>活動内容 — AMRC</title>
<meta name="description" content="モニタリング、フィンガープリント照合、削除要請、検索結果からの削除、同時配信の保護、証拠保全と報告。会員社のために協議会が行う業務です。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/ja/services.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/services.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/services.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/services.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="活動内容 — AMRC">
<meta property="og:description" content="モニタリング、フィンガープリント照合、削除要請、検索結果からの削除、同時配信の保護、証拠保全と報告。会員社のために協議会が行う業務です。">
<meta property="og:url" content="https://tokyocopyright.com/ja/services.html">
<meta property="og:locale" content="ja_JP">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">本文へスキップ</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">03-3230-6016</a></span>
      <span class="muted nowrap">東京都千代田区 — 平日 9:00–18:00</span>
    </div>
    <div class="topbar-langs">
      <a class="lang-pill" href="../services.html" title="English">EN</a>
      <span class="lang-pill is-active">日本語</span>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">アニメ・マンガ権利協議会</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="メニューを開閉">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="メインナビゲーション">
      <a href="index.html">ホーム</a>
      <a href="about.html">協議会について</a>
      <a href="members.html">会員社</a>
      <a href="services.html" class="is-active">活動内容</a>
      <a href="public.html">一般の皆様へ</a>
      <a href="contact.html">お問い合わせ</a>
      <a href="contact.html" class="nav-cta">侵害の報告</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">ホーム</a> &nbsp;/&nbsp; 活動内容</div>
      <h1>活動内容</h1>
      <p>協議会が会員社のために行う業務です。個別の対応を積み重ねるのではなく、検出・検証・削除・報告を一続きの処理として継続的に運用しています。</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">主な業務</span>
        <h2>会員社の作品を守るために必要なすべて</h2>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="icon">M</div>
          <h3>継続的なモニタリング</h3>
          <p>違法な複製が実際に流通する経路を、それぞれの更新頻度に合わせて巡回します。</p>
          <ul class="checklist">
            <li>配信・埋め込みポータル、IPTVおよび再配信サービス</li>
            <li>アップローダー、ファイルホスト、公開設定のクラウドストレージ</li>
            <li>トレントインデックス、DHT、Usenetインデクサ</li>
            <li>SNS動画、ショート動画プラットフォーム、掲示板</li>
            <li>公開メッセージチャンネル、リンクまとめサイト</li>
            <li>作品名による検索結果</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">F</div>
          <h3>コンテンツ・フィンガープリント</h3>
          <p>ファイル名による照合は容易に回避されます。内容そのものを照合するため、改変後も特定できます。</p>
          <ul class="checklist">
            <li>再エンコードやトリミングに耐える映像の知覚ハッシュ</li>
            <li>楽曲、吹替、オーディオ作品の音声フィンガープリント</li>
            <li>出版物・マンガ向けの画像およびテキスト類似度判定</li>
            <li>左右反転、速度変更、レターボックス、字幕焼き込みの検出</li>
            <li>切り抜き・まとめ動画に対する部分一致判定</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">T</div>
          <h3>削除要請と通知管理</h3>
          <p>検証済みの案件について、実際に対処できる相手方へ、適用される法令に基づいて通知します。</p>
          <ul class="checklist">
            <li>米国所在のサービス・検索エンジンへのDMCA通知</li>
            <li>日本法、EU法その他各国制度に基づく通知</li>
            <li>信頼済み報告者制度を通じたプラットフォームへの直接申告</li>
            <li>ホスティング事業者、CDN、レジストラ、決済事業者への段階的対応</li>
            <li>再投稿の自動再通知</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">D</div>
          <h3>検索結果からの削除</h3>
          <p>ファイルを削除しても、海賊版サイトが正規配信より上位に残れば対策は半分です。検索面にも並行して対応します。</p>
          <ul class="checklist">
            <li>主要検索エンジンに対する侵害URLの削除申請</li>
            <li>作品名・ブランド名の検索結果の監視</li>
            <li>ドメイン変更とミラーサイト網の追跡</li>
            <li>正規ページの表示順位回復状況の報告</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">L</div>
          <h3>同時配信・公開前の保護</h3>
          <p>最も価値の高い時間帯は、最も短い時間帯でもあります。専用の即応体制で対応します。</p>
          <ul class="checklist">
            <li>同時配信期間中のリアルタイム監視</li>
            <li>検出から数分単位での対応を目標</li>
            <li>対応形式に応じた電子透かしによる流出元の特定</li>
            <li>放映・掲載開始前の事前巡回</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">R</div>
          <h3>証拠保全・報告・API</h3>
          <p>処理の全過程を記録し、立証と次の判断に使える形で保管します。</p>
          <ul class="checklist">
            <li>日時を記録した証拠一式と取得時の保全データ</li>
            <li>検出・通知・削除結果のダッシュボード表示</li>
            <li>経営層およびライセンサー向けの定期報告</li>
            <li>自社システムと連携するREST APIおよびWebhook</li>
            <li>常習的侵害者・非協力的事業者に関する情報</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">会員種別</span>
        <h2>提供内容の区分</h2>
        <p>目安です。実際の対象範囲は、作品数、公開頻度、対象地域に応じて個別に設定します。</p>
      </div>

      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col">準会員</th>
              <th scope="col">正会員</th>
              <th scope="col">同時配信対応</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">監視頻度</th>
              <td>1日1回</td>
              <td>常時</td>
              <td>常時＋リアルタイム対応</td>
            </tr>
            <tr>
              <th scope="row">照合方式</th>
              <td>映像・音声</td>
              <td>映像・音声・画像・テキスト</td>
              <td>全方式＋部分一致</td>
            </tr>
            <tr>
              <th scope="row">検索結果の削除</th>
              <td>対象</td>
              <td>対象</td>
              <td>対象＋キーワード監視</td>
            </tr>
            <tr>
              <th scope="row">対応目標</th>
              <td>24時間以内</td>
              <td>2時間以内</td>
              <td>配信期間中は数分単位</td>
            </tr>
            <tr>
              <th scope="row">報告</th>
              <td>月次</td>
              <td>週次＋ダッシュボード</td>
              <td>リアルタイム表示・API・Webhook</td>
            </tr>
            <tr>
              <th scope="row">サポート</th>
              <td>メール</td>
              <td>専任担当者</td>
              <td>専任担当者＋緊急連絡体制</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="contact.html">ご要望を相談する</a>
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">よくあるご質問</span>
      <h2>お問い合わせの多い点</h2>
      <div class="faq mt-2">
        <details>
          <summary>実際にどのくらいで削除されますか</summary>
          <p>
            相手方によります。信頼済み報告者制度のある大手プラットフォームでは数時間、
            小規模な事業者ではより時間を要し、一部は通知に応じません。
            応じない場合は上位のプロバイダ、レジストラ、決済事業者へ段階を上げます。
            報告では平均値ではなく、実際の分布をお示しします。
          </p>
        </details>
        <details>
          <summary>削除しても再投稿された場合は</summary>
          <p>
            再投稿は想定内であり、自動で処理されます。作品のフィンガープリントを登録済みであれば、
            新たな複製は次回の巡回で検出され、改めて申請いただくことなく再通知されます。
            繰り返す投稿者は常習的侵害者として記録します。
          </p>
        </details>
        <details>
          <summary>正当なコンテンツを誤って削除する可能性は</summary>
          <p>
            可能性をゼロにはできないため、そうならない設計にしています。ライセンシーおよび
            提携先のURLは除外リストに登録し、照合の確度基準は厳しめに設定し、
            判断が分かれる案件は人が確認し、批評・論評その他の正当な利用は対象外としています。
            影響を受けた方は異議を申し立てられます。手順は
            <a href="public.html#counter-notice">一般の皆様へ</a>のページに記載しています。
          </p>
        </details>
        <details>
          <summary>個々の視聴者に対して措置を取りますか</summary>
          <p>
            行いません。ファンに対する提訴、請求、警告書の送付は一切なく、
            協議会の規程上、会員社がそれを指示することもできません。
            権利行使の対象は違法な複製の流通です。
          </p>
        </details>
        <details>
          <summary>対象地域はどこまでですか</summary>
          <p>
            検出は全世界を対象とします。通知は相手方に適用される制度——米国所在のサービスには
            DMCA、必要に応じて日本およびEUの手続、その他の地域ではプラットフォームの規約——
            に従って送信します。通知は30以上の言語で対応しています。
          </p>
        </details>
        <details>
          <summary>加入にあたって必要なものは</summary>
          <p>
            作品リスト、権利を保有していることの証明、同時配信・連載のスケジュール、
            および除外リストに登録するための正規配信URL（海外ライセンシーを含む）です。
            参照用の素材があれば照合精度が上がりますが、必須ではありません。
          </p>
        </details>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>加入をご検討中ですか</h2>
      <p>保護をご希望の作品をお知らせいただければ、対象範囲をご提案します。</p>
      <a class="btn" href="contact.html">事務局に問い合わせる</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="../assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          アニメ・マンガ権利協議会は、日本のアニメ・マンガ関連企業による会員制団体です。
          会員社の作品の違法流通に、共同で対処しています。
        </p>
      </div>
      <div>
        <h4>協議会</h4>
        <ul>
          <li><a href="about.html">協議会について</a></li>
          <li><a href="members.html">会員社</a></li>
          <li><a href="services.html">活動内容</a></li>
          <li><a href="public.html">一般の皆様へ</a></li>
          <li><a href="contact.html">お問い合わせ</a></li>
        </ul>
      </div>
      <div>
        <h4>規約・法務</h4>
        <ul>
          <li><a href="imprint.html">運営者情報</a></li>
          <li><a href="privacy.html">プライバシーポリシー</a></li>
          <li><a href="public.html#counter-notice">異議申立て</a></li>
        </ul>
      </div>
      <div>
        <h4>連絡先</h4>
        <ul>
          <li>〒101-8050</li>
          <li>東京都千代田区一ツ橋4-6-10</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">03-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> アニメ・マンガ権利協議会</div>
      <ul>
        <li><a href="imprint.html">運営者情報</a></li>
        <li><a href="privacy.html">プライバシー</a></li>
        <li><a href="contact.html">侵害の報告</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="../assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /members.html
// ============================================================================
ASSETS["/members.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Members — AMRC</title>
<meta name="description" content="The anime studios, manga publishers and licensors that make up the Anime &amp; Manga Rights Council, and the rights each has entrusted to it.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/members.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/members.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/members.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/members.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Members — AMRC">
<meta property="og:description" content="The companies that make up the Council.">
<meta property="og:url" content="https://tokyocopyright.com/members.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/members.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html" class="is-active">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Members</div>
      <h1>Our members</h1>
      <p>
        The Council acts on behalf of the anime studios, manga publishers and licensors
        listed below. Each has entrusted specified works to us for enforcement.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">

      <div class="section-title mt-3">
        <span class="kicker">Membership</span>
        <h2>Companies represented by the Council</h2>
        <p>
          A full member entrusts its catalogue to the Council, holds a seat in the
          members' meeting, and is bound by the rules of enforcement.
        </p>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>Manga publishers</h3>
          <span class="count">&mdash; members</span>
        </div>
        <ul class="roster">
          <!-- ============================================================
               PASTE MANGA PUBLISHERS HERE — one line each:

               <li><span class="name">Company Name</span><span class="meta">Since 2024</span></li>

               The .meta line is optional; drop it for a name-only plate.
               ============================================================ -->
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
        </ul>
      </div>

      <div class="roster-group">
        <div class="roster-head">
          <h3>Animation studios</h3>
          <span class="count">&mdash; members</span>
        </div>
        <ul class="roster">
          <!-- ============================================================
               PASTE ANIMATION STUDIOS HERE — same pattern as above.
               ============================================================ -->
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
          <li class="is-empty"><span class="name">Member name</span><span class="meta">Since 20XX</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap prose">
      <span class="kicker">Scope</span>
      <h2>What membership does and does not mean</h2>
      <p>
        Publishing this roster is how platforms and hosting providers verify that a notice
        from us is authorised. So it is worth being precise about what it asserts.
      </p>
      <ul class="checklist">
        <li>Each company listed has appointed the Council to act for it on the works it has entrusted — no more.</li>
        <li>Membership does not transfer copyright. Every work remains the property of its rights holder.</li>
        <li>A member's licensees and official distribution channels are allow-listed, never targeted.</li>
        <li>The Council does not act for non-members, and does not claim to represent the industry as a whole.</li>
        <li>Company names and marks shown here belong to their respective owners and appear with permission.</li>
      </ul>

      <div class="notice notice-info">
        <p class="mb-0">
          Platforms verifying a notice can write to
          <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> quoting the
          notice reference, and we will confirm the member's authorisation for the work
          concerned.
        </p>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>Interested in joining the Council?</h2>
      <p>
        We will assess how your titles are currently being distributed illegally and set
        out what membership would cover — with no obligation.
      </p>
      <a class="btn" href="contact.html">Enquire about membership</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /privacy.html
// ============================================================================
ASSETS["/privacy.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — AMRC</title>
<meta name="description" content="How the Anime &amp; Manga Rights Council collects, uses, stores and protects personal data on this website and in the course of its enforcement work.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/privacy.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/privacy.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/privacy.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/privacy.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Privacy Policy — AMRC">
<meta property="og:url" content="https://tokyocopyright.com/privacy.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/privacy.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Privacy policy</div>
      <h1>Privacy policy</h1>
      <p>How we handle personal data on this website and in the course of our work.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <h2>1. Who is responsible</h2>
      <p>
        The Anime &amp; Manga Rights Council, 4-6-10 Hitotsubashi, Chiyoda-ku, Tokyo 101-8050, Japan, is
        responsible for the personal data processed through this website. You can reach us
        at <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> or
        <a href="tel:+81332306016">+81 3-3230-6016</a> for any question about this policy or
        about your data.
      </p>

      <h2>2. What we collect</h2>

      <h3>2.1 When you visit this website</h3>
      <p>
        Our hosting provider records standard server log data when a page is requested: the
        IP address of the request, the date and time, the page requested, the referring page
        where one is sent, and the browser and operating system reported by your browser.
        This is needed to deliver the site and to detect abuse or technical faults. Logs are
        kept for a short period and then deleted.
      </p>

      <h3>2.2 When you use the contact form</h3>
      <p>
        We process the details you enter: your name, organisation, email address, telephone
        number where given, the category of your enquiry, and the content of your message.
        We use them only to answer you and to manage the resulting business relationship. If
        an enquiry does not lead to a relationship, we delete the correspondence once it is
        no longer needed.
      </p>

      <h3>2.3 In the course of our services</h3>
      <p>
        When we detect and act against infringing material, we record evidence about
        publicly accessible listings: URLs, file identifiers, page content, timestamps and
        the publicly displayed account name of an uploader where one is shown. This can
        constitute personal data. We do not attempt to identify individual viewers, we do
        not obtain subscriber data from internet providers, and we do not build behavioural
        profiles of internet users.
      </p>

      <h3>2.4 Cookies and analytics</h3>
      <p>
        This website sets no advertising cookies and no third-party tracking cookies. If
        analytics are used, they will be privacy-respecting and configured without
        cross-site tracking; where consent is required, it will be requested before any
        non-essential cookie is set.
      </p>

      <h2>3. Why we may process your data</h2>
      <ul>
        <li>To respond to an enquiry you have sent us.</li>
        <li>To perform a contract with you, or to take steps at your request before entering into one.</li>
        <li>To pursue our legitimate interests and those of our members in operating the site securely and in enforcing copyright.</li>
        <li>To comply with legal obligations, including record-keeping and responding to lawful requests.</li>
        <li>Where you have given consent, for the specific purpose described at the time.</li>
      </ul>

      <h2>4. Who we share it with</h2>
      <p>
        We do not sell personal data. We share it only where necessary:
      </p>
      <ul>
        <li>with service providers who host our website, send our email and store our data, under contract and on our instructions;</li>
        <li>with the member company on whose behalf a specific enforcement action is taken;</li>
        <li>with platforms and hosting providers, to the extent a takedown notice necessarily identifies the material and the notifier;</li>
        <li>with our professional advisers, where needed;</li>
        <li>with authorities or courts where we are legally required to do so.</li>
      </ul>

      <h2>5. International transfers</h2>
      <p>
        Because our work is worldwide, data may be transferred outside Japan — most often
        when a notice is sent to a platform or host in another country. Where a transfer
        involves personal data, we make it on the basis of an appropriate safeguard
        recognised by the applicable law.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        Enquiry correspondence is kept for as long as needed to answer it and for a
        reasonable period afterwards. Member records are kept for the duration of the
        relationship and for the retention period required by Japanese commercial and tax
        law. Enforcement evidence is kept for as long as it may be needed to defend or
        substantiate a notice. Server logs are kept briefly and then deleted.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Subject to the law that applies to you, you can ask us to confirm what personal data
        we hold about you, to give you a copy, to correct it if it is inaccurate, to delete
        it, to restrict or object to its use, and to withdraw a consent you have given.
        Withdrawing consent does not affect processing carried out beforehand.
      </p>
      <p>
        Write to <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>. We
        respond within one month, and we may need to verify your identity first. If you are
        not satisfied with our answer, you may complain to the Personal Information
        Protection Commission of Japan or to the supervisory authority in your own country.
      </p>

      <h2>8. Security</h2>
      <p>
        We apply technical and organisational measures appropriate to the risk: encryption
        in transit, access control on a need-to-know basis, logging of access to sensitive
        systems, and regular review. No system is perfectly secure, but we work to keep the
        data we hold proportionate to what we actually need.
      </p>

      <h2>9. Children</h2>
      <p>
        This website is directed at businesses, member companies and rights holders. We do not knowingly
        collect personal data from children.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy as our services or the law change. The current version is
        always published on this page; significant changes will be highlighted here.
      </p>

      <h2>11. Contact</h2>
      <p>
        Anime &amp; Manga Rights Council<br>
        4-6-10 Hitotsubashi, Chiyoda-ku, Tokyo 101-8050, Japan<br>
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> ·
        <a href="tel:+81332306016">+81 3-3230-6016</a>
      </p>

      <p class="small muted mt-3">Last updated: <span data-year>2026</span></p>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /public.html
// ============================================================================
ASSETS["/public.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Public Information — AMRC</title>
<meta name="description" content="Information for platforms, hosts, uploaders and the public: what our notices mean, how to respond, and how to file a counter-notice.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/public.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/public.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/public.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/public.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Public Information — AMRC">
<meta property="og:description" content="What our notices mean, how to respond, and how to file a counter-notice.">
<meta property="og:url" content="https://tokyocopyright.com/public.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/public.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html">Services</a>
      <a href="public.html" class="is-active">Public</a>
      <a href="contact.html">Contact</a>
      <a href="imprint.html">Imprint</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Public</div>
      <h1>Public information</h1>
      <p>
        This page is for platform operators, hosting providers, site owners, uploaders
        and anyone else who has received a notice from the Council — or simply wants to
        know how we operate.
      </p>
    </div>
  </section>

  <section class="section-tight section-grey">
    <div class="wrap">
      <div class="stats">
        <div class="stat">
          <small>we never file</small>
          <div class="figure">0</div>
          <div class="label">Claims against fans</div>
        </div>
        <div class="stat">
          <small>reviewed by a person</small>
          <div class="figure">100%</div>
          <div class="label">Of borderline matches</div>
        </div>
        <div class="stat">
          <small>always</small>
          <div class="figure">Withdrawn</div>
          <div class="label">If shown to be mistaken</div>
        </div>
        <div class="stat">
          <small>&nbsp;</small>
          <div class="figure">1 day</div>
          <div class="label">Target reply to counter-notices</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">

      <span class="kicker">Our commitments</span>
      <h2>What we will and will not do</h2>
      <p>
        Anti-piracy enforcement affects real people, including people who have done
        nothing wrong. We publish the limits we work within so that they can be held
        against us.
      </p>
      <ul class="checklist">
        <li><strong>We never pursue fans.</strong> No lawsuits, no settlement demands, no invoices, no threatening letters to viewers, readers or listeners.</li>
        <li><strong>We do not target lawful use.</strong> Reviews, criticism, commentary, parody, news reporting, education and other transformative or permitted uses are excluded from enforcement.</li>
        <li><strong>We verify rights first.</strong> No notice is sent on behalf of a client until we have confirmed they hold the rights they claim.</li>
        <li><strong>We identify ourselves.</strong> Every notice states who sent it, on whose behalf, the work concerned and the legal basis.</li>
        <li><strong>We accept being wrong.</strong> Mistaken removals are corrected quickly and without argument once shown to be mistaken.</li>
        <li><strong>We minimise data.</strong> We record what is needed to evidence an infringement, and we do not build profiles of individual internet users.</li>
      </ul>

      <hr>

      <span class="kicker">For platforms &amp; hosts</span>
      <h2>If you have received a notice from us</h2>
      <p>
        Our notices are machine-generated but individually verified. Each one contains the
        identification of the protected work, the specific infringing URL or file, the
        rights holder we act for, the legal basis, our contact details and a unique
        reference number.
      </p>
      <p>
        The fastest way to resolve a notice is to act on the identified URL and reply to
        the notice address quoting the reference. If a notice looks wrong to you, say so —
        we would rather withdraw an incorrect notice than have it actioned.
      </p>
      <p>
        If you operate a service with a high volume of user uploads, we are happy to
        arrange a direct or automated reporting channel instead of email. Write to
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> with
        "Platform channel" in the subject line.
      </p>

      <hr>

      <h2 id="counter-notice">Filing a counter-notice</h2>
      <p>
        If content of yours was removed because of one of our notices and you believe the
        removal was wrong — because you hold the rights, because you are licensed, or
        because your use is permitted by law — you can dispute it. You may do so through
        the platform that removed the content, and you may also write to us directly.
      </p>
      <p>To dispute a notice with us, email
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a> with the
        subject line <strong>"Counter-notice"</strong> and include:
      </p>
      <ol>
        <li>The reference number shown in the notice, if you have it.</li>
        <li>The exact URL or identifier of the material that was removed.</li>
        <li>Your name and an address and email at which you can be contacted.</li>
        <li>The reason you believe the removal was mistaken — for example, that you own or license the work, or that your use is permitted.</li>
        <li>Any evidence supporting that, such as a licence, a contract or a release.</li>
      </ol>
      <p>
        We aim to respond within one business day (JST) and to resolve disputes within
        five. If we agree the notice was wrong, we withdraw it and ask the platform to
        restore the content. If we disagree, we will tell you why in writing, so that you
        can take the matter further with the platform or with your own legal advisers.
      </p>

      <div class="notice notice-info">
        <p>
          Filing a counter-notice may have legal consequences and, on some platforms, may
          disclose your contact details to the rights holder. Nothing here is legal advice
          — if you are unsure, consult a qualified lawyer in your jurisdiction.
        </p>
      </div>

      <hr>

      <span class="kicker">For rights holders</span>
      <h2>Reporting piracy of your own work</h2>
      <p>
        If you are a rights holder and have found your work distributed illegally, use our
        <a href="contact.html">contact form</a> or write to
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>. Include the
        title, evidence that you hold the rights, and any URLs you have already found.
      </p>
      <p>
        We can only act for our member companies, but we will tell you what your options
        are and, where a matter falls outside what we do, point you toward the right route
        — including whether joining the Council would cover it.
      </p>

      <hr>

      <span class="kicker">For researchers &amp; press</span>
      <h2>Press &amp; academic enquiries</h2>
      <p>
        Journalists and researchers working on online piracy, platform liability or notice
        practice can reach us at
        <a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a>. We can
        usually discuss methodology and aggregate figures; client identities and case
        details are confidential.
      </p>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>Still have a question?</h2>
      <p>Notices, disputes, platform channels or press — one address reaches the right desk.</p>
      <a class="btn" href="contact.html">Get in touch</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /robots.txt
// ============================================================================
ASSETS["/robots.txt"] = {
  type: "text/plain; charset=utf-8",
  body: `User-agent: *
Allow: /
Disallow: /contact.php

Sitemap: https://tokyocopyright.com/sitemap.xml
`
};

// ============================================================================
//  /services.html
// ============================================================================
ASSETS["/services.html"] = {
  type: "text/html; charset=utf-8",
  body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Services — AMRC</title>
<meta name="description" content="Monitoring, content fingerprinting, automated takedown notices, search de-indexing, simulcast protection and evidence reporting, carried out for Council members.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://tokyocopyright.com/services.html">
<link rel="alternate" hreflang="en" href="https://tokyocopyright.com/services.html">
<link rel="alternate" hreflang="ja" href="https://tokyocopyright.com/ja/services.html">
<link rel="alternate" hreflang="x-default" href="https://tokyocopyright.com/services.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AMRC">
<meta property="og:title" content="Services — AMRC">
<meta property="og:description" content="End-to-end anti-piracy for member companies: detection, verification, takedown, de-indexing and reporting.">
<meta property="og:url" content="https://tokyocopyright.com/services.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<div class="topbar">
  <div class="wrap">
    <div class="topbar-contact">
      <span><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></span>
      <span class="nowrap"><a href="tel:+81332306016">+81 3-3230-6016</a></span>
      <span class="muted nowrap">Chiyoda-ku, Tokyo — JST (UTC+9)</span>
    </div>
    <div class="topbar-langs">
      <span class="lang-pill is-active">EN</span>
      <a class="lang-pill" href="ja/services.html" title="日本語版">日本語</a>
    </div>
  </div>
</div>

<header class="masthead">
  <div class="wrap">
    <a class="brand" href="index.html">
      <img class="brand-mark" src="assets/img/logo.svg" alt="" width="38" height="38">
      <span class="brand-name">AMRC
        <span class="brand-tag">Anime &amp; Manga Rights Council</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="members.html">Members</a>
      <a href="services.html" class="is-active">Services</a>
      <a href="public.html">Public</a>
      <a href="contact.html">Contact</a>
      <a href="contact.html" class="nav-cta">Report piracy</a>
    </nav>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <div class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; Services</div>
      <h1>Services</h1>
      <p>
        What the Council does for its members: detection, verification, removal and
        reporting, operated as one continuous pipeline rather than a series of manual
        campaigns.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Core services</span>
        <h2>Everything needed to keep a member catalogue clean</h2>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="icon">M</div>
          <h3>Continuous monitoring</h3>
          <p>
            We sweep the channels where pirated copies actually circulate, on a schedule
            tuned to how quickly each one turns over:
          </p>
          <ul class="checklist">
            <li>Streaming and embed portals, IPTV and restreaming services</li>
            <li>Cyberlockers, file hosts and public cloud drives</li>
            <li>Torrent indexes, DHT swarms and Usenet indexers</li>
            <li>Social video, short-form platforms and user forums</li>
            <li>Public messaging channels and link aggregators</li>
            <li>Search engine results for your title keywords</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">F</div>
          <h3>Content fingerprinting</h3>
          <p>
            Filename matching is trivially defeated. We match on the content itself, so a
            copy stays identifiable after it has been altered:
          </p>
          <ul class="checklist">
            <li>Perceptual video hashing that survives re-encoding and cropping</li>
            <li>Audio fingerprints for music, dubs and audiobooks</li>
            <li>Image and text similarity for publishing and manga</li>
            <li>Detection of mirrored, sped-up, letterboxed and overlaid copies</li>
            <li>Partial-match detection for clips and compilations</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">T</div>
          <h3>Takedown &amp; notice management</h3>
          <p>
            Verified matches become properly formed notices, addressed to the party that
            can act, under the law that applies to them:
          </p>
          <ul class="checklist">
            <li>DMCA notices to US-hosted services and search engines</li>
            <li>Notices under Japanese, EU and other national regimes as applicable</li>
            <li>Platform-native reporting via trusted-flagger channels</li>
            <li>Escalation to hosts, CDNs, registrars and payment providers</li>
            <li>Automatic re-notice when content is re-uploaded</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">D</div>
          <h3>Search de-indexing</h3>
          <p>
            Removing the file is only half the job if the pirate page still outranks your
            own release. We work the search layer in parallel:
          </p>
          <ul class="checklist">
            <li>Removal requests for infringing URLs from major search engines</li>
            <li>Monitoring of brand and title keyword results</li>
            <li>Tracking of domain-hopping and mirror networks</li>
            <li>Reporting on the visibility recovered for legitimate pages</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">L</div>
          <h3>Simulcast &amp; pre-release protection</h3>
          <p>
            The highest-value window is the shortest. Weekly simulcasts, theatrical
            premieres, chapter drops and screeners get a dedicated rapid-response track:
          </p>
          <ul class="checklist">
            <li>Real-time monitoring across the simulcast window</li>
            <li>Target response measured in minutes from detection</li>
            <li>Watermark tracing to identify the leak source where supported</li>
            <li>Pre-release sweeps ahead of a scheduled airing or chapter release</li>
          </ul>
        </div>

        <div class="card">
          <div class="icon">R</div>
          <h3>Evidence, reporting &amp; API</h3>
          <p>
            Everything the pipeline does is recorded, so you can prove it and act on it:
          </p>
          <ul class="checklist">
            <li>Timestamped evidence packages with preserved captures</li>
            <li>Live dashboard of detections, notices and removal outcomes</li>
            <li>Scheduled reporting for management and licensors</li>
            <li>REST API and webhooks for your own systems</li>
            <li>Repeat-infringer and hostile-host intelligence</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-grey">
    <div class="wrap">
      <div class="section-title">
        <span class="kicker">Coverage</span>
        <h2>Service levels</h2>
        <p>Indicative tiers. Each member’s cover is scoped to catalogue size, release cadence and territories.</p>
      </div>

      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col">Associate</th>
              <th scope="col">Full member</th>
              <th scope="col">Simulcast tier</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Monitoring frequency</th>
              <td>Daily sweeps</td>
              <td>Continuous</td>
              <td>Continuous + real-time simulcast mode</td>
            </tr>
            <tr>
              <th scope="row">Fingerprint matching</th>
              <td>Video &amp; audio</td>
              <td>Video, audio, image &amp; text</td>
              <td>Full stack + partial-match clips</td>
            </tr>
            <tr>
              <th scope="row">Search de-indexing</th>
              <td>Included</td>
              <td>Included</td>
              <td>Included + keyword monitoring</td>
            </tr>
            <tr>
              <th scope="row">Response target</th>
              <td>Within 24 hours</td>
              <td>Within 2 hours</td>
              <td>Minutes, during simulcast windows</td>
            </tr>
            <tr>
              <th scope="row">Reporting</th>
              <td>Monthly</td>
              <td>Weekly + dashboard</td>
              <td>Live dashboard, API &amp; webhooks</td>
            </tr>
            <tr>
              <th scope="row">Support</th>
              <td>Email</td>
              <td>Named contact</td>
              <td>Named contact + on-call escalation</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-center mt-3 mb-0">
        <a class="btn btn-dark" href="contact.html">Discuss your requirements</a>
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap prose">
      <span class="kicker">Questions</span>
      <h2>Common questions</h2>
      <div class="faq mt-2">
        <details>
          <summary>How quickly does content actually come down?</summary>
          <p>
            It depends on the recipient. Major platforms with trusted-flagger channels
            typically act within hours; smaller hosts take longer, and a minority ignore
            notices entirely — those get escalated to their upstream provider, registrar or
            payment processor. Our reporting shows the real distribution rather than a
            headline average.
          </p>
        </details>
        <details>
          <summary>What happens when a pirate simply re-uploads?</summary>
          <p>
            Re-uploads are expected and handled automatically. Once a work is fingerprinted,
            a new copy is detected on the next sweep and re-noticed without anyone having to
            file a fresh request. Persistent re-uploaders are tracked as repeat infringers.
          </p>
        </details>
        <details>
          <summary>Could you remove something that is legitimate?</summary>
          <p>
            The risk is never zero, so we design against it: licensee and partner URLs are
            allow-listed, confidence thresholds are set conservatively, borderline matches
            go to human review, and reviews, criticism and other transformative uses are
            excluded. Anyone affected can file a counter-notice — the route is described on
            our <a href="public.html#counter-notice">public information page</a>.
          </p>
        </details>
        <details>
          <summary>Do you take action against individual viewers?</summary>
          <p>
            No. We do not sue, invoice or send demand letters to fans, and the Council’s
            rules do not permit a member to direct us to. Our enforcement is aimed at the
            distribution of infringing copies.
          </p>
        </details>
        <details>
          <summary>Which territories do you cover?</summary>
          <p>
            Detection is worldwide. Notices are issued under whichever regime applies to the
            recipient — DMCA for US-hosted services, Japanese and EU procedures where
            relevant, and platform policy elsewhere. We issue notices in over 30 languages.
          </p>
        </details>
        <details>
          <summary>What do you need from us to start?</summary>
          <p>
            A catalogue list, evidence that you hold the rights, your simulcast or
            serialisation schedule, and the URLs of your licensed distribution — including
            your overseas licensees — so we can allow-list them. Reference files or
            screeners improve fingerprint quality but are not always required.
          </p>
        </details>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>Interested in joining?</h2>
      <p>Tell us what you need protected and we will scope what membership would cover.</p>
      <a class="btn" href="contact.html">Contact our team</a>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html">
          <img class="brand-mark" src="assets/img/logo.svg" alt="" width="34" height="34">
          <span class="brand-name">AMRC</span>
        </a>
        <p class="mt-2">
          The Anime &amp; Manga Rights Council is a member body of Japanese anime and
          manga companies, acting together against the illegal distribution of their
          works worldwide.
        </p>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About us</a></li>
          <li><a href="members.html">Our members</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="public.html">Public information</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="imprint.html">Imprint</a></li>
          <li><a href="privacy.html">Privacy policy</a></li>
          <li><a href="public.html#counter-notice">Counter-notice</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>4-6-10 Hitotsubashi</li>
          <li>Chiyoda-ku, Tokyo 101-8050</li>
          <li>Japan</li>
          <li><a href="mailto:legal@tokyocopyright.com">legal@tokyocopyright.com</a></li>
          <li><a href="tel:+81332306016">+81 3-3230-6016</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; <span data-year>2026</span> Anime &amp; Manga Rights Council. All rights reserved.</div>
      <ul>
        <li><a href="imprint.html">Imprint</a></li>
        <li><a href="privacy.html">Privacy</a></li>
        <li><a href="contact.html">Report piracy</a></li>
      </ul>
    </div>
  </div>
</footer>

<script src="assets/js/app.js" defer></script>
</body>
</html>
`
};

// ============================================================================
//  /sitemap.xml
// ============================================================================
ASSETS["/sitemap.xml"] = {
  type: "application/xml; charset=utf-8",
  body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tokyocopyright.com/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/about.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/members.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/services.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/public.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/contact.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/imprint.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/privacy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/index.html</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/about.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/members.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/services.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/public.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/contact.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/imprint.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://tokyocopyright.com/ja/privacy.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`
};

const MAIL_TO = 'legal@tokyocopyright.com';
const MAIL_FROM = 'AMRC Website <website@tokyocopyright.com>';
const MAX_BODY = 20000;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
    "form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS },
  });

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/[\r\0]/g, '').trim().slice(0, max) : '';

/* --- Contact form ---------------------------------------------------------- */

function buildMessage(f) {
  return [
    'A new enquiry was submitted on the AMRC website.',
    '',
    `Name:         ${f.name}`,
    `Company:      ${f.company || '—'}`,
    `Email:        ${f.email}`,
    `Phone:        ${f.phone || '—'}`,
    `Reason:       ${f.subject || '—'}`,
    `Content type: ${f.rights || '—'}`,
    '',
    '--- Message ---',
    f.message,
  ].join('\n');
}

async function sendViaResend(env, f) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || MAIL_FROM,
      to: [env.MAIL_TO || MAIL_TO],
      reply_to: f.email,
      subject: `[AMRC] ${f.subject || 'Website enquiry'} — ${f.company || f.name}`,
      text: buildMessage(f),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

async function forwardToWebhook(env, f) {
  const res = await fetch(env.FORWARD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'tokyocopyright.com', text: buildMessage(f), fields: f }),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

async function handleContact(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: 'Message too large.' }, 413);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = Object.fromEntries(new URLSearchParams(raw));
  }
  if (!data || typeof data !== 'object') {
    return json({ ok: false, error: 'Malformed request.' }, 400);
  }

  /* Honeypot — accept and drop. */
  if (clean(data.website, 100)) return json({ ok: true });

  const f = {
    name: clean(data.name, 120),
    company: clean(data.company, 160),
    email: clean(data.email, 200),
    phone: clean(data.phone, 60),
    subject: clean(data.subject, 80),
    rights: clean(data.rights, 80),
    message: clean(data.message, 8000),
    consent: clean(data.consent, 10),
  };

  if (!f.name || !f.email || !f.message) {
    return json({ ok: false, error: 'Please complete the name, email and message fields.' }, 422);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) {
    return json({ ok: false, error: 'That email address does not look valid.' }, 422);
  }
  if (!f.consent) {
    return json({ ok: false, error: 'Please confirm the privacy consent checkbox.' }, 422);
  }
  if (f.message.length < 10) {
    return json({ ok: false, error: 'Please add a little more detail to your message.' }, 422);
  }

  try {
    if (env.RESEND_API_KEY) {
      await sendViaResend(env, f);
    } else if (env.FORWARD_WEBHOOK_URL) {
      await forwardToWebhook(env, f);
    } else {
      return json(
        { ok: false, error: 'Contact delivery is not configured on this deployment.' },
        501
      );
    }
  } catch (err) {
    console.error('contact delivery failed:', err && err.message);
    return json({ ok: false, error: 'The message could not be sent.' }, 502);
  }

  return json({ ok: true });
}

/* --- Static pages ---------------------------------------------------------- */

function serve(pathname, request) {
  /* "/" -> the home page. */
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  /* Trailing slash: /about/ -> /about, /ja/ -> /ja */
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  let asset = ASSETS[pathname];

  /* Extensionless: /about -> /about.html */
  if (!asset && !pathname.includes('.')) asset = ASSETS[pathname + '.html'];

  /* Directory index: /ja -> /ja/index.html */
  if (!asset && !pathname.includes('.')) asset = ASSETS[pathname + '/index.html'];

  const status = asset ? 200 : 404;
  if (!asset) asset = ASSETS['/404.html'];
  if (!asset) return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });

  const cache = asset.type.startsWith('text/html')
    ? 'public, max-age=0, must-revalidate'
    : 'public, max-age=604800';

  const headers = {
    'Content-Type': asset.type,
    'Cache-Control': cache,
    ...SECURITY_HEADERS,
  };

  /* HEAD requests must not carry a body. */
  const body = request.method === 'HEAD' ? null : asset.body;
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/contact' || pathname === '/contact.php') {
      return handleContact(request, env);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', ...SECURITY_HEADERS },
      });
    }

    return serve(pathname, request);
  },
};
