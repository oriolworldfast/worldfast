// Recibe el formulario de contacto y lo reenvía por email con Resend (https://resend.com).
// Variables de entorno (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY  -> API key de Resend (obligatoria)
//   CONTACT_FROM    -> remitente, de un dominio verificado en Resend
//                      (por defecto "Web Worldfast <web@worldfast.es>")
//   CONTACT_TO      -> destinatario (por defecto info@worldfast.es)
//   CONTACT_TO_CBAM -> destinatario del formulario de la sección CBAM
//                      (por defecto cbam@worldfast.es)
//   TURNSTILE_SITE_KEY   -> clave de sitio de Cloudflare Turnstile (opcional)
//   TURNSTILE_SECRET_KEY -> clave secreta de Cloudflare Turnstile (opcional)
//                      Con las dos claves, el formulario muestra la verificación
//                      antispam de Cloudflare y aquí se comprueba cada envío.
//
// Antispam: los envíos hechos en menos de MIN_SECONDS desde que se carga la página
// se descartan sin enviar nada. Los que parecen publicidad (ver spamCheck) se envían
// igualmente, pero con "[SPAM?]" al principio del asunto para filtrarlos en Gmail.

const FIELDS = {
  'your-name': 'Nombre',
  'your-email': 'Email',
  'your-subject': 'Asunto',
  telefono: 'Teléfono',
  'your-message': 'Mensaje',
  page: 'Página',
};

const MIN_SECONDS = 3;
const SPAM_THRESHOLD = 3;

// Expresiones típicas de los mensajes de publicidad (SEO, captación de clientes, IA...).
// Cada una que aparezca suma 1 punto.
const SPAM_PATTERNS = [
  /\bleads\b|lead gen/i,
  /\bSEO\b|backlinks?|guest post|posicionamiento/i,
  /first page of google|google ranking|primera p[aá]gina de google/i,
  /web ?design|website (re)?design|redesign|dise[ñn]o web/i,
  /digital marketing|marketing digital|social media|redes sociales|marketing/i,
  /\bAI\b/,
  /artificial intelligence|inteligencia artificial|chat ?bot/i,
  /free trial|days free|credit card|no obligation|prueba gratuita/i,
  /appointments?|book(ed)? a call|schedule a call/i,
  /your contact form|filled (in|out) your/i,
  /unsubscribe|opt[ -]?out|reply (with )?["']?(stop|no|remove)/i,
  /\btraffic\b|\bROI\b|captaci[oó]n de clientes/i,
  /crypto|bitcoin|casino|viagra|cialis|\bloans?\b|virtual assistant|outsourc/i,
];

const EN_WORDS = /\b(the|and|you|your|we|our|is|are|for|with|that|this|to|of|it|if)\b/gi;
const ES_WORDS = /\b(el|la|los|las|de|que|y|en|para|con|por|un|una|es|del|se|al)\b/gi;

// Devuelve los motivos por los que el mensaje parece spam y su puntuación total.
function spamCheck({ message, subject, page, elapsed }) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };
  const text = `${subject}\n${message}`;

  if (!Number.isFinite(elapsed)) add(3, 'enviado sin pasar por la web');
  for (const re of SPAM_PATTERNS) {
    const m = text.match(re);
    if (m) add(1, `«${m[0]}»`);
  }
  if (/https?:\/\/|www\./i.test(message)) add(1, 'contiene enlaces');
  if (/[\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) add(3, 'alfabeto cirílico o asiático');
  if (!/^\/en(\/|$)/.test(page)) {
    const en = (message.match(EN_WORDS) || []).length;
    const es = (message.match(ES_WORDS) || []).length;
    if (en >= 5 && en > es) add(1, 'en inglés desde una página en español');
  }
  return { score, reasons };
}

// Comprueba el token de Cloudflare Turnstile. Devuelve true, false o null si
// Cloudflare no responde (en ese caso el mensaje se envía marcado como [SPAM?]).
async function verifyTurnstile(token, req) {
  if (!token) return false;
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip || undefined }),
    });
    const data = await r.json();
    if (!data.success) console.log('Turnstile rechazado', data['error-codes']);
    return !!data.success;
  } catch (err) {
    console.error('Turnstile no responde', err);
    return null;
  }
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = async (req, res) => {
  // El formulario pide aquí la clave pública de Turnstile para mostrar la verificación
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid' });
    }
  }
  // Campo trampa para bots (estaba en el formulario original)
  if (body['web-221']) return res.status(200).json({ ok: true });
  // Nadie rellena el formulario en menos de MIN_SECONDS: es un bot
  const elapsed = body._elapsed === undefined || body._elapsed === '' ? NaN : Number(body._elapsed);
  if (elapsed < MIN_SECONDS * 1000) {
    console.log('Descartado por rapidez', elapsed);
    return res.status(200).json({ ok: true });
  }

  const name = String(body['your-name'] || '').trim();
  const email = String(body['your-email'] || '').trim();
  const message = String(body['your-message'] || '').trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  let captchaDown = false;
  if (process.env.TURNSTILE_SECRET_KEY) {
    const verified = await verifyTurnstile(String(body['cf-turnstile-response'] || ''), req);
    if (verified === false) return res.status(400).json({ ok: false, error: 'captcha' });
    captchaDown = verified === null;
  }

  const rows = Object.entries(FIELDS).map(([k, label]) => [label, String(body[k] || '').slice(0, 5000)]);
  const page = String(body.page || '');
  const isCbam = /^\/(?:en\/)?cbam(?:\/|$)/.test(page);
  const to = isCbam
    ? process.env.CONTACT_TO_CBAM || 'cbam@worldfast.es'
    : process.env.CONTACT_TO || 'info@worldfast.es';
  const subject = String(body['your-subject'] || 'Nuevo mensaje de contacto').replace(/[\r\n]+/g, ' ').slice(0, 200);

  const spam = spamCheck({ message, subject, page, elapsed });
  if (captchaDown) {
    spam.score += SPAM_THRESHOLD;
    spam.reasons.push('Cloudflare no ha podido verificarlo');
  }
  const isSpam = spam.score >= SPAM_THRESHOLD;
  if (isSpam) {
    console.log('Marcado como [SPAM?]', spam.score, spam.reasons.join(', '));
    rows.push(['Antispam', `Posible spam (${spam.score} puntos): ${spam.reasons.join(', ')}`]);
  }

  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n\n');
  const html = `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="vertical-align:top;font-weight:bold">${label}</td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )
    .join('')}</table>`;

  if (!process.env.RESEND_API_KEY) {
    console.error('Falta la variable de entorno RESEND_API_KEY');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'Web Worldfast <web@worldfast.es>',
        to: to.split(',').map((s) => s.trim()),
        reply_to: email,
        subject: `${isSpam ? '[SPAM?] ' : ''}[worldfast.es] ${subject}`,
        text,
        html,
      }),
    });
    if (!r.ok) {
      console.error('Resend', r.status, await r.text());
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
