import nodemailer from 'nodemailer';

type MailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const smtpHost = process.env.ETHEREAL_SMTP_HOST;
const smtpPort = Number(process.env.ETHEREAL_SMTP_PORT || 587);
const smtpUser = process.env.ETHEREAL_SMTP_USER;
const smtpPassword = process.env.ETHEREAL_SMTP_PASSWORD;

if (!smtpHost) {
  throw new Error('ETHEREAL_SMTP_HOST environment variable is not set');
}

if (!smtpUser) {
  throw new Error('ETHEREAL_SMTP_USER environment variable is not set');
}

if (!smtpPassword) {
  throw new Error('ETHEREAL_SMTP_PASSWORD environment variable is not set');
}

export const mailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

export async function sendEmail(options: MailOptions) {
  const info = await mailTransporter.sendMail(options);

  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log(`Ethereal preview URL: ${previewUrl}`);
  }

  return info;
}