const nodemailer = require('nodemailer');
const env = require('../config/env');

/** Built on first use; null when SMTP isn't configured (mail is then only logged, outside production). */
let transporter;

const getTransporter = () => {
  if (transporter !== undefined) return transporter;
  const { host, port, user, pass } = env.smtp;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      })
    : null;
  return transporter;
};

const isConfigured = () => Boolean(env.smtp.host);

/**
 * Sends a plain-text email. Without SMTP, development prints it to the
 * console instead so flows like password reset can still be tested.
 */
const sendMail = async ({ to, subject, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    if (env.nodeEnv !== 'production') {
      console.log(`[mail:dev] to=${to || '(no email on file)'} subject="${subject}"\n${text}`); // eslint-disable-line no-console
    } else {
      console.warn(`[mail] SMTP not configured — "${subject}" was not sent`); // eslint-disable-line no-console
    }
    return;
  }
  await mailer.sendMail({ from: env.smtp.from, to, subject, text });
};

module.exports = { sendMail, isConfigured };
