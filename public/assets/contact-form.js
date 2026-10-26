// Sustituye a Contact Form 7: envía el formulario a /api/contact y muestra la
// respuesta con las mismas clases CSS que usaba el plugin.
// Si en Vercel están las claves de Cloudflare Turnstile, añade la verificación
// antispam encima del botón de enviar.
(function () {
  var loadedAt = Date.now();
  var TEXTS = {
    es: { ok: 'Gracias por tu mensaje. Ha sido enviado.', invalid: 'Uno o más campos tienen un error. Por favor, revísalos e inténtalo de nuevo.', required: 'Por favor, rellena este campo.', email: 'La dirección de correo electrónico no es válida.', error: 'Ha habido un error al intentar enviar tu mensaje. Por favor, inténtalo de nuevo más tarde.', captcha: 'Por favor, completa la verificación antispam.' },
    en: { ok: 'Thank you for your message. It has been sent.', invalid: 'One or more fields have an error. Please check and try again.', required: 'Please fill out this field.', email: 'Please enter an email address.', error: 'There was an error trying to send your message. Please try again later.', captcha: 'Please complete the anti-spam check.' },
    ca: { ok: 'Gràcies pel teu missatge. S\'ha enviat.', invalid: 'Un o més camps tenen un error. Revisa\'ls i torna-ho a provar.', required: 'Si us plau, omple aquest camp.', email: 'L\'adreça de correu electrònic no és vàlida.', error: 'Hi ha hagut un error en enviar el missatge. Torna-ho a provar més tard.', captcha: 'Si us plau, completa la verificació antispam.' }
  };
  var lang = (document.documentElement.lang || 'es').slice(0, 2);
  var t = TEXTS[lang] || TEXTS.es;

  function setTip(input, msg) {
    var wrap = input.closest('.wpcf7-form-control-wrap');
    var old = wrap && wrap.querySelector('.wpcf7-not-valid-tip');
    if (old) old.remove();
    input.classList.toggle('wpcf7-not-valid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && wrap) {
      var tip = document.createElement('span');
      tip.className = 'wpcf7-not-valid-tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.textContent = msg;
      wrap.appendChild(tip);
    }
  }

  function validate(form) {
    var ok = true;
    form.querySelectorAll('.wpcf7-form-control:not(.wpcf7-submit)').forEach(function (input) {
      if (input.closest('[style*="display:none"]')) return;
      var v = (input.value || '').trim();
      var msg = '';
      if (input.classList.contains('wpcf7-validates-as-required') && !v) msg = t.required;
      else if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = t.email;
      setTip(input, msg);
      if (msg) ok = false;
    });
    return ok;
  }

  function setStatus(form, status, msg) {
    form.setAttribute('data-status', status);
    form.className = form.className.replace(/\b(init|sent|failed|invalid|submitting)\b/g, '').trim() + ' ' + status;
    var out = form.querySelector('.wpcf7-response-output');
    if (out) {
      out.textContent = msg || '';
      out.setAttribute('aria-hidden', msg ? 'false' : 'true');
    }
  }

  var forms = document.querySelectorAll('form.wpcf7-form');
  var widgets = [];

  // Cloudflare Turnstile: la clave pública la da /api/contact (variable TURNSTILE_SITE_KEY)
  function setupTurnstile(siteKey) {
    window.wfTurnstileReady = function () {
      forms.forEach(function (form, i) {
        var submit = form.querySelector('.wpcf7-submit');
        var box = document.createElement('div');
        box.className = 'wf-turnstile';
        box.style.margin = '0 0 15px';
        (submit.closest('p') || submit).before(box);
        widgets[i] = window.turnstile.render(box, {
          sitekey: siteKey,
          language: lang === 'en' || lang === 'es' ? lang : 'auto'
        });
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=wfTurnstileReady';
    s.async = true;
    document.head.appendChild(s);
  }
  if (forms.length) {
    fetch('/api/contact').then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg.turnstileSiteKey) setupTurnstile(cfg.turnstileSiteKey);
    }).catch(function () {});
  }

  forms.forEach(function (form, i) {
    form.closest('.wpcf7') && form.closest('.wpcf7').classList.replace('no-js', 'js');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return setStatus(form, 'invalid', t.invalid);
      var widget = widgets[i];
      if (widget !== undefined && !window.turnstile.getResponse(widget)) return setStatus(form, 'invalid', t.captcha);
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.page = location.pathname;
      data._elapsed = Date.now() - loadedAt;
      setStatus(form, 'submitting', '');
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().then(function (res) {
          if (!r.ok || !res.ok) throw new Error(res.error || r.status);
        });
      }).then(function () {
        form.reset();
        setStatus(form, 'sent', t.ok);
      }).catch(function (err) {
        setStatus(form, err.message === 'captcha' ? 'invalid' : 'failed', err.message === 'captcha' ? t.captcha : t.error);
      }).then(function () {
        // Cada verificación sirve para un solo envío
        if (widget !== undefined) window.turnstile.reset(widget);
      });
    });
  });
})();
