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

  async sendInstructorAssignedEmail(toEmail, firstname, { trainingName, startDate, sessionUrl }) {
    const when = startDate ? new Date(startDate).toLocaleString() : undefined;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: `You've been assigned to teach ${trainingName}`,
      html: `
        <p>Hi ${firstname},</p>
        <p>You've been assigned to deliver <strong>${trainingName}</strong>${when ? ` on <strong>${when}</strong>` : ''}.</p>
        <p><a href="${sessionUrl}">View the session and respond</a></p>
      `,
    });
  }

  async sendRecordChangedNotification(managerEmails, { actor, action, entityType, entityId, label }) {
    if (!managerEmails || managerEmails.length === 0) {
      return;
    }

    const ACTION_VERBS = { update: 'updated', delete: 'deleted', cancel: 'cancelled' };
    const verb = ACTION_VERBS[action] || action;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: managerEmails.join(','),
      subject: `${entityType} ${verb} by ${actor.firstname} ${actor.lastname}`,
      html: `
        <p><strong>${actor.firstname} ${actor.lastname}</strong> (${actor.email}) just ${verb} a ${entityType.toLowerCase()}${label ? `: <strong>${label}</strong>` : ''}.</p>
        <ul>
          <li><strong>Entity:</strong> ${entityType} #${entityId}</li>
          <li><strong>Action:</strong> ${verb}</li>
        </ul>
      `,
    });
  }
}

export { EmailService };
