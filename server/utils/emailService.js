const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

const initializeTransporter = async () => {
  if (transporter) return transporter;

  // Debug: Log environment variables (without showing password)
  console.log('📧 Email Configuration Check:');
  console.log('  SMTP_HOST:', process.env.SMTP_HOST || 'not set');
  console.log('  SMTP_PORT:', process.env.SMTP_PORT || 'not set');
  console.log('  SMTP_USER:', process.env.SMTP_USER || 'not set');
  console.log('  SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : 'not set');
  console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || 'not set');

  // If no SMTP credentials, use Ethereal Email for testing (development only)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️  No SMTP credentials found. Using Ethereal Email for testing...');
    console.log('⚠️  For production, please configure SMTP settings in .env file');
    
    try {
      // Create test account
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      console.log('✅ Ethereal Email test account created');
      console.log('📧 Test emails will be sent to: https://ethereal.email');
      console.log('📧 Login with:', testAccount.user);
      console.log('🔑 Password:', testAccount.pass);
      
      return transporter;
    } catch (error) {
      console.error('Failed to create Ethereal test account:', error);
      throw new Error('Email service not configured and test account creation failed');
    }
  }

  // Use configured SMTP
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

/**
 * Send OTP code via email for password reset
 */
const sendOTPEmail = async (email, otpCode, userName) => {
  try {
    const mailTransporter = await initializeTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Veritelligent'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset OTP - Veritelligent',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #03a696;">Password Reset Request</h2>
          <p>Hello ${userName || 'User'},</p>
          <p>You have requested to reset your password. Use the following OTP code to proceed:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #03a696; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code will expire in 15 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">This is an automated message from Veritelligent.</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello ${userName || 'User'},
        
        You have requested to reset your password. Use the following OTP code to proceed:
        
        ${otpCode}
        
        This code will expire in 15 minutes.
        
        If you didn't request this, please ignore this email.
      `
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    
    // If using Ethereal, log the preview URL
    if (process.env.SMTP_HOST?.includes('ethereal') || !process.env.SMTP_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 Preview URL:', previewUrl);
      }
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check your SMTP_USER and SMTP_PASS in .env file. For Gmail, use an App Password, not your regular password.');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Cannot connect to email server. Please check SMTP_HOST and SMTP_PORT in .env file.');
    } else if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Email service not configured. Please add SMTP_USER and SMTP_PASS to your .env file.');
    } else {
      throw new Error(`Failed to send email: ${error.message}. Please check your email configuration.`);
    }
  }
};

/**
 * Send email verification OTP
 */
const sendEmailVerification = async (email, otpCode, userName) => {
  try {
    const mailTransporter = await initializeTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Veritelligent'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email - Veritelligent',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #03a696;">Email Verification</h2>
          <p>Hello ${userName || 'User'},</p>
          <p>Please verify your email address by entering the following OTP code:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #03a696; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code will expire in 15 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">This is an automated message from Veritelligent.</p>
        </div>
      `,
      text: `
        Email Verification
        
        Hello ${userName || 'User'},
        
        Please verify your email address by entering the following OTP code:
        
        ${otpCode}
        
        This code will expire in 15 minutes.
        
        If you didn't request this, please ignore this email.
      `
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    
    // If using Ethereal, log the preview URL
    if (process.env.SMTP_HOST?.includes('ethereal') || !process.env.SMTP_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 Preview URL:', previewUrl);
      }
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check your SMTP_USER and SMTP_PASS in .env file. For Gmail, use an App Password, not your regular password.');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Cannot connect to email server. Please check SMTP_HOST and SMTP_PORT in .env file.');
    } else if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Email service not configured. Please add SMTP_USER and SMTP_PASS to your .env file.');
    } else {
      throw new Error(`Failed to send email: ${error.message}. Please check your email configuration.`);
    }
  }
};

module.exports = {
  sendOTPEmail,
  sendEmailVerification
};



