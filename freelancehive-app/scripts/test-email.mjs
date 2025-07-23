import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testEmail() {
  console.log('Testing email configuration...\n');
  
  // Parse EMAIL_SERVER
  const emailServer = process.env.EMAIL_SERVER;
  if (!emailServer) {
    console.error('❌ EMAIL_SERVER not configured in .env');
    process.exit(1);
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport(emailServer);
    
    // Verify configuration
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    // Send test email
    console.log('📧 Sending test email...');
    const testEmail = process.argv[2] || 'test@example.com';
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'test@example.com',
      to: testEmail,
      subject: 'GSTHive Email Test',
      text: 'This is a test email from GSTHive.\n\nIf you received this email, your email configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">GSTHive Email Test</h2>
          <p>This is a test email from <strong>GSTHive</strong>.</p>
          <p>If you received this email, your email configuration is working correctly! ✅</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This test email was sent from the GSTHive application using Amazon SES.
          </p>
        </div>
      `,
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('   To:', testEmail);
    console.log('   Message ID:', info.messageId);
    console.log('\n📋 Configuration Summary:');
    console.log('   - SMTP Host: email-smtp.us-east-1.amazonaws.com');
    console.log('   - SMTP Port: 587');
    console.log('   - From Address:', process.env.EMAIL_FROM);
    console.log('\n🎉 Email configuration is working correctly!');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. Your Amazon SES account is verified');
    console.error('2. The sender email (no-reply@gsthive.com) is verified in SES');
    console.error('3. Your AWS region is correct (currently using us-east-1)');
    console.error('4. You are not in SES sandbox mode (or recipient is verified)');
    process.exit(1);
  }
}

testEmail().catch(console.error);