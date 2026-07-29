/**
 * AMRC — Cloudflare Worker.
 *
 * Serves the static site from the ASSETS binding and handles the contact form
 * at POST /api/contact (and /contact.php, so the same HTML works on cPanel and
 * on Workers without editing the form).
 *
 * Email delivery:
 *   - Set the RESEND_API_KEY secret to send through Resend, or
 *   - set FORWARD_WEBHOOK_URL to POST the enquiry JSON somewhere (Slack, a CRM,
 *     a Zapier/Make hook, your own endpoint).
 * With neither configured the endpoint returns 501 and the page falls back to a
 * pre-filled mailto: link, so an enquiry is never silently lost.
 */

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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/contact' || pathname === '/contact.php') {
      return handleContact(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
