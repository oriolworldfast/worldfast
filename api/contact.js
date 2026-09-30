// Recibe el formulario de contacto y lo reenvía por email con Resend (https://resend.com).
// Variables de entorno (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY  -> API key de Resend (obligatoria)
//   CONTACT_FROM    -> remitente, de un dominio verificado en Resend
//                      (por defecto "Web Worldfast <web@worldfast.es>")
//   CONTACT_TO      -> destinatario (por defecto info@worldfast.es)

const FIELDS = {
  'your-name': 'Nombre',
  'your-email': 'Email',
  'your-subject': 'Asunto',
  telefono: 'Teléfono',
  'your-message': 'Mensaje',
  page: 'Página',
};

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = async (req, res) => {
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

  const name = String(body['your-name'] || '').trim();
  const email = String(body['your-email'] || '').trim();
  const message = String(body['your-message'] || '').trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const rows = Object.entries(FIELDS).map(([k, label]) => [label, String(body[k] || '').slice(0, 5000)]);
  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n\n');
  const html = `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="vertical-align:top;font-weight:bold">${label}</td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )
    .join('')}</table>`;
  const subject = String(body['your-subject'] || 'Nuevo mensaje de contacto').replace(/[\r\n]+/g, ' ').slice(0, 200);

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
        to: (process.env.CONTACT_TO || 'info@worldfast.es').split(',').map((s) => s.trim()),
        reply_to: email,
        subject: `[worldfast.es] ${subject}`,
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
