import nodemailer from 'nodemailer';

class EmailService {
  transporter: any;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendAccountApprovedEmail(toEmail, firstname) {
    const loginUrl = `${process.env.CLIENT_URL}/login`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: 'Your account has been approved',
      html: `
        <p>Hi ${firstname},</p>
        <p>Your account has been verified and approved by a manager. You can now sign in.</p>
        <p><a href="${loginUrl}">Click here to log in</a></p>
      `,
    });
  }

  async sendAccountRejectedEmail(toEmail, firstname) {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: 'Your account request was declined',
      html: `<p>Hi ${firstname},</p><p>Your account request was not approved. Please contact your administrator for details.</p>`,
    });
  }

    async sendNewSignupNotification(managerEmails, newUser) {
    if (!managerEmails || managerEmails.length === 0) {
      
      return;
    }

    const approvalsUrl = `${process.env.CLIENT_URL}/admin/pending-approvals`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: managerEmails.join(','),
      subject: `New ${newUser.roleName} signup pending approval`,
      html: `
        <p>A new account request needs your review:</p>
        <ul>
          <li><strong>Name:</strong> ${newUser.firstname} ${newUser.lastname}</li>
          <li><strong>Email:</strong> ${newUser.email}</li>
          <li><strong>Requested role:</strong> ${newUser.roleName}</li>
        </ul>
        <p><a href="${approvalsUrl}">Review pending approvals</a></p>
      `,
    });
  }
}

export { EmailService };
