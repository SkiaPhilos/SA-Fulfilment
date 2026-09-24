/**
 * Authoritative Email & SMTP Notification Service for Ship Asaan
 * Handles outbound transactional emails: OTP reset codes, merchant approval, and employee invites.
 */

import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: any = null;

function getTransporter(): any {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || 'Ship Asaan <no-reply@shipasaan.pk>';

  if (!t) {
    console.log(`[EMAIL] SMTP not configured. Simulating delivery to: ${options.to} | Subject: "${options.subject}"`);
    return true;
  }

  try {
    await t.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    console.log(`[EMAIL] Successfully sent "${options.subject}" to: ${options.to}`);
    return true;
  } catch (err: any) {
    console.error(`[EMAIL] Failed sending email to ${options.to}:`, err?.message || err);
    return false;
  }
}

/**
 * Sends Password Reset Verification Code Email
 */
export async function sendPasswordResetEmail(toEmail: string, otpCode: string): Promise<boolean> {
  const subject = 'Your Ship Asaan Password Reset Verification Code';
  const text = `Hello,\n\nYou requested a password reset for your Ship Asaan account. Your 6-digit verification code is: ${otpCode}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email or contact support.\n\nBest regards,\nShip Asaan Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">
        You requested a password reset for your <strong>Ship Asaan</strong> account.
      </p>
      <div style="background-color: #f1f5f9; padding: 18px; border-radius: 6px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0284c7;">${otpCode}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">
        This code is valid for <strong>15 minutes</strong> and can only be used once. If you did not request this password reset, please ignore this message.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
        Ship Asaan Logistics & Warehousing &bull; Authoritative Fulfillment
      </p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, text, html });
}

/**
 * Sends Merchant Account Approval Email
 */
export async function sendMerchantApprovalEmail(toEmail: string, businessName: string): Promise<boolean> {
  const subject = `Welcome to Ship Asaan! Your merchant account for ${businessName} is approved`;
  const text = `Hello,\n\nCongratulations! Your merchant account for "${businessName}" has been approved by Ship Asaan Operations. You can now log into your dashboard to configure products, schedule warehouse intakes, and dispatch orders.\n\nBest regards,\nShip Asaan Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #059669; margin-top: 0;">Merchant Account Approved!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">
        Congratulations! Your merchant account for <strong>${businessName}</strong> has been officially approved by Ship Asaan Operations.
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">
        You now have full access to:
      </p>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6;">
        <li>SKU Catalog & Barcode Management</li>
        <li>Warehouse Inbound Receiving & Putaway</li>
        <li>Bulk CSV Order Fulfillment & Courier Dispatch</li>
        <li>Real-Time Financial Wallet & Ledger</li>
      </ul>
      <div style="margin: 24px 0;">
        <a href="${process.env.APP_URL || 'https://shipasaan.pk'}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Log in to Merchant Portal</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
        Ship Asaan Logistics & Warehousing &bull; Authoritative Fulfillment
      </p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, text, html });
}

/**
 * Sends Staff Invite / Onboarding Email
 */
export async function sendEmployeeInviteEmail(toEmail: string, name: string, tempPass: string): Promise<boolean> {
  const subject = 'Your Ship Asaan Staff Account Credentials';
  const text = `Hello ${name},\n\nYou have been onboarded as a team member at Ship Asaan.\n\nTemporary Password: ${tempPass}\n\nPlease log in and update your password immediately.\n\nBest regards,\nShip Asaan Operations`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Welcome to Ship Asaan Staff Portal</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">
        Hello <strong>${name}</strong>, you have been invited to join the Ship Asaan Operations portal.
      </p>
      <div style="background-color: #f1f5f9; padding: 18px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Your Temporary Password:</strong></p>
        <p style="margin: 8px 0 0; font-family: monospace; font-size: 20px; color: #0284c7; font-weight: 700;">${tempPass}</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">
        Please log in and update your password upon your first login.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
        Ship Asaan Logistics & Warehousing &bull; Authoritative Fulfillment
      </p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, text, html });
}
