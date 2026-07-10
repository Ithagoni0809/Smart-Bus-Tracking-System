/**
 * utils/email.js
 * ─────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS:
 *   Sends transactional emails for:
 *   - Email verification when a user registers
 *   - Password reset links when a user forgets their password
 *
 *   Uses Nodemailer with Gmail SMTP (easy for development).
 *   For production, swap EMAIL_HOST/PORT for SendGrid or Mailgun.
 * ─────────────────────────────────────────────────────────────
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// ── Create reusable transporter ─────────────────────────────────────────────
// A "transporter" is a pre-configured email sender object.
// We create it once and reuse it for every email we send.
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,       // e.g., smtp.gmail.com
    port: parseInt(process.env.EMAIL_PORT), // e.g., 587
    secure: process.env.EMAIL_PORT === '465', // true only for port 465 (SSL)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // In development with Gmail, sometimes TLS needs to be relaxed
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

// ── Email Templates ─────────────────────────────────────────────────────────
// Simple HTML email templates. In production, use a templating engine like Handlebars.

const emailTemplates = {
  // Template for email verification
  verification: (name, verificationUrl) => ({
    subject: '✅ Verify Your Email - Smart Bus Tracking',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B3F7A; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🚌 Smart Bus Tracking</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B3F7A;">Hello, ${name}!</h2>
          <p style="color: #555; font-size: 16px;">
            Thank you for registering. Please verify your email address by clicking the button below.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #2E86AB; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #888; font-size: 14px;">
            This link expires in <strong>24 hours</strong>.
            If you did not create an account, please ignore this email.
          </p>
          <p style="color: #888; font-size: 12px;">
            Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
        </div>
      </div>
    `,
    text: `Hello ${name},\n\nVerify your email: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  }),

  // Template for password reset
  passwordReset: (name, resetUrl) => ({
    subject: '🔐 Reset Your Password - Smart Bus Tracking',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B3F7A; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🚌 Smart Bus Tracking</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B3F7A;">Password Reset Request</h2>
          <p style="color: #555; font-size: 16px;">
            Hello <strong>${name}</strong>, we received a request to reset your password.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #F5A623; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px;">
              Reset My Password
            </a>
          </div>
          <p style="color: #888; font-size: 14px;">
            This link expires in <strong>10 minutes</strong>.
            If you did not request a password reset, please ignore this email — your password remains unchanged.
          </p>
          <p style="color: #888; font-size: 12px;">
            Or copy this link: <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      </div>
    `,
    text: `Hello ${name},\n\nReset your password: ${resetUrl}\n\nThis link expires in 10 minutes.`,
  }),

  // Template for password changed notification
  passwordChanged: (name) => ({
    subject: '🔒 Password Changed - Smart Bus Tracking',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 30px;">
          <h2>Hello ${name},</h2>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, contact support immediately.</p>
        </div>
      </div>
    `,
    text: `Hello ${name}, your password has been changed. If you didn't do this, contact support.`,
  }),
};

// ── Main send function ──────────────────────────────────────────────────────
/**
 * sendEmail — sends an email using one of the templates above.
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.template - Template key: 'verification' | 'passwordReset' | 'passwordChanged'
 * @param {Array}  options.templateData - Arguments passed to the template function
 */
const sendEmail = async ({ to, template, templateData }) => {
  try {
    const transporter = createTransporter();

    // Get the template content by calling the template function with its data
    const { subject, html, text } = emailTemplates[template](...templateData);

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,  // HTML version (shown by email clients that support it)
      text,  // Plain text fallback (shown by old email clients)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`📧 Email sent to ${to} — MessageID: ${info.messageId}`);
    return info;

  } catch (error) {
    // Log the error but don't crash the server
    // Email sending is supplementary — don't block the user if it fails
    logger.error(`📧 Email send failed to ${to}: ${error.message}`);
    throw error; // Re-throw so the controller can decide what to do
  }
};

module.exports = sendEmail;
