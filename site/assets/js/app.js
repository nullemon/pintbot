/* Tokyo Copyright — small progressive-enhancement layer. No dependencies. */
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
    ].join('\n');
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
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
          'Thank you — your enquiry has been received. Our team replies to rights ' +
          'holder enquiries within one business day (JST).',
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
