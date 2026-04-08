const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your corporate SMTP settings
  auth: {
    user: 'digital.solutions@brickslimited.com', // Replace with your sender email
    pass: 'your-app-password-here' // Replace with your Gmail App Password
  }
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: '"BRICKS Digital Portal" <digital.solutions@brickslimited.com>',
      to,
      subject,
      html: htmlContent
    });
    console.log("📧 Email Sent: " + info.messageId);
  } catch (err) {
    console.error("❌ Email Error:", err);
  }
};

module.exports = sendEmail;