const nodemailer = require('nodemailer');
const https = require('https');

const sendViaResend = (to, subject, html) => {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            from: process.env.EMAIL_FROM || 'OsianHub <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html
        });

        const options = {
            hostname: 'api.resend.com',
            port: 443,
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(responseBody));
                } else {
                    reject(new Error(`Resend API Error: ${res.statusCode} - ${responseBody}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(body);
        req.end();
    });
};

const createTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email credentials not set. Email sending will be skipped.');
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 5000, // 5 seconds
        greetingTimeout: 5000,   // 5 seconds
        socketTimeout: 5000,     // 5 seconds
    });
};

const transporter = createTransporter();

const sendEmail = async (to, subject, html) => {
    // 1. Send via Resend API (HTTPS port 443) if API Key is configured (Best for Render Free Tier)
    if (process.env.RESEND_API_KEY) {
        try {
            const result = await sendViaResend(to, subject, html);
            console.log(`✉️ [Resend Email Sent] To: ${to} | ID: ${result.id}`);
            return;
        } catch (resendError) {
            console.error('❌ Resend API sending error:', resendError.message);
            // If Resend fails, try fallback to SMTP if configured
        }
    }

    // 2. Fallback to Nodemailer SMTP
    if (!transporter) {
        console.log(`[Email skipped] To: ${to} | Subject: ${subject}`);
        return;
    }
    await transporter.sendMail({
        from: `"OsianHub" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

// ──────────────────────────────────────────────
//  Email Templates
// ──────────────────────────────────────────────

const sendOTP = async (email, otp) => {
    const subject = 'Your OsianHub OTP Verification Code';
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;padding:30px;">
      <h2 style="color:#5b4fcf;">OsianHub - Email Verification</h2>
      <p>Thank you for registering! Please use the OTP below to verify your email address:</p>
      <div style="background:#f4f2ff;border-radius:6px;padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:32px;font-weight:bold;color:#5b4fcf;letter-spacing:8px;">${otp}</span>
      </div>
      <p style="color:#666;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="color:#aaa;font-size:12px;">If you did not register for OsianHub, please ignore this email.</p>
    </div>`;
    await sendEmail(email, subject, html);
};

const sendWelcomeEmail = async (email, name) => {
    const subject = 'Welcome to OsianHub! 🎉';
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;padding:30px;">
      <h2 style="color:#5b4fcf;">Welcome to OsianHub, ${name}!</h2>
      <p>Your account has been verified successfully. You're now part of India's largest inter-college quiz championship!</p>
      <a href="${process.env.FRONTEND_URL || 'https://pankajxg.github.io/OsianHub'}/frontend/auth/login.html"
         style="display:inline-block;background:#5b4fcf;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
        Login to OsianHub
      </a>
      <p style="color:#666;">Good luck and happy quizzing!</p>
    </div>`;
    await sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, name, resetLink) => {
    const subject = 'Reset Your OsianHub Password';
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;padding:30px;">
      <h2 style="color:#5b4fcf;">Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <a href="${resetLink}"
         style="display:inline-block;background:#5b4fcf;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
        Reset Password
      </a>
      <p style="color:#666;">This link expires in <strong>15 minutes</strong>. If you didn't request this, please ignore this email.</p>
    </div>`;
    await sendEmail(email, subject, html);
};

const sendPasswordResetOtpEmail = async (email, name, otp) => {
    const subject = 'Your OsianHub Password Reset OTP';
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;padding:30px;">
      <h2 style="color:#5b4fcf;">Password Reset OTP</h2>
      <p>Hi ${name}, use the OTP below to reset your password:</p>
      <div style="background:#f4f2ff;border-radius:6px;padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:32px;font-weight:bold;color:#5b4fcf;letter-spacing:8px;">${otp}</span>
      </div>
      <p style="color:#666;">This OTP expires in <strong>10 minutes</strong>.</p>
    </div>`;
    await sendEmail(email, subject, html);
};

const sendResultNotification = async (email, name, subject, message, resultLink) => {
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;padding:30px;">
      <h2 style="color:#5b4fcf;">OsianHub Notification</h2>
      <p>Hi ${name},</p>
      <p>${message}</p>
      ${resultLink ? `<a href="${resultLink}" style="display:inline-block;background:#5b4fcf;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">View Result</a>` : ''}
    </div>`;
    await sendEmail(email, subject || 'OsianHub Notification', html);
};

module.exports = {
    sendOTP,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendPasswordResetOtpEmail,
    sendResultNotification,
};
