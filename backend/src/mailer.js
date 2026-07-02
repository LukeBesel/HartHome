const { config } = require('./config');

// Sends email via SMTP when configured; otherwise logs the message so
// self-hosted households can complete flows (e.g. password reset) from the
// server logs. Never throws — callers treat email as best-effort.
async function sendMail({ to, subject, text }) {
  if (!config.smtp.configured) {
    console.log(`\n[mail:demo] To: ${to}\n[mail:demo] Subject: ${subject}\n[mail:demo] ${text}\n`);
    return { sent: false, logged: true };
  }
  try {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error('[mail] send failed:', err.message);
    console.log(`[mail:fallback] To: ${to} — ${subject}\n${text}`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };
