// Recibe el formulario de contacto y lo reenvía por email.
// Variables de entorno (configurarlas en Vercel → Settings → Environment Variables):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  -> buzón que envía (p. ej. el de cdmon)
//   CONTACT_TO                                  -> destinatario (por defecto info@worldfast.es)
const nodemailer = require('nodemailer');

const FIELDS = {
  'your-name': 'Nombre',
  'your-email': 'Email',
  'your-subject': 'Asunto',
  telefono: 'Teléfono',
  'your-message': 'Mensaje',
  page: 'Página',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  // Campo trampa para bots (estaba en el formulario original)
  if (body['web-221']) return res.status(200).json({ ok: true });

  const name = String(body['your-name'] || '').trim();
  const email = String(body['your-email'] || '').trim();
  const message = String(body['your-message'] || '').trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const text = Object.entries(FIELDS)
    .map(([k, label]) => `${label}: ${String(body[k] || '').slice(0, 5000)}`)
    .join('\n\n');

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Web Worldfast" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || 'info@worldfast.es',
      replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
      subject: `[worldfast.es] ${String(body['your-subject'] || 'Nuevo mensaje de contacto').slice(0, 200)}`,
      text,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'send_failed' });
  }
};
