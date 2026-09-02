import path from 'path';
import ejs from 'ejs';
import nodemailer from 'nodemailer';

const TEMPLATES_DIR = path.join(__dirname, 'emailTemplates');
const LOGO_PATH = path.join(TEMPLATES_DIR, 'assets', 'logo.png');

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

  
  
  
  
  private async renderEmail(templateName: string, subject: string, locals: Record<string, any>): Promise<string> {
    const content = await ejs.renderFile(path.join(TEMPLATES_DIR, `${templateName}.ejs`), locals);
    return ejs.renderFile(path.join(TEMPLATES_DIR, 'layout.ejs'), { ...locals, subject, content });
  }

  private logoAttachment() {
    return [{ filename: 'logo.png', path: LOGO_PATH, cid: 'logo' }];
  }

  async sendAccountApprovedEmail(toEmail, firstname) {
    const loginUrl = `${process.env.CLIENT_URL}/login`;
    const subject = 'Your account has been approved';

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject,
      html: await this.renderEmail('accountApproved', subject, {
        firstname,
        loginUrl,
        preheader: 'Your account is approved - you can log in now.',
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendAccountRejectedEmail(toEmail, firstname) {
    const subject = 'Your account request was declined';

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject,
      html: await this.renderEmail('accountRejected', subject, {
        firstname,
        preheader: 'Your account request was not approved.',
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendNewSignupNotification(managerEmails, newUser) {
    if (!managerEmails || managerEmails.length === 0) {
      return;
    }

    const approvalsUrl = `${process.env.CLIENT_URL}/admin/pending-approvals`;
    const subject = `New ${newUser.roleName} signup pending approval`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: managerEmails.join(','),
      subject,
      html: await this.renderEmail('newSignupNotification', subject, {
        newUser,
        approvalsUrl,
        preheader: `${newUser.firstname} ${newUser.lastname} requested a ${newUser.roleName} account.`,
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendInstructorAssignedEmail(toEmail, firstname, { trainingName, startDate, sessionUrl }) {
    const when = startDate ? new Date(startDate).toLocaleString() : undefined;
    const subject = `You've been assigned to teach ${trainingName}`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject,
      html: await this.renderEmail('instructorAssigned', subject, {
        firstname,
        trainingName,
        when,
        sessionUrl,
        preheader: `You're delivering ${trainingName}${when ? ` on ${when}` : ''}.`,
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendPasswordResetEmail(toEmail, firstname, resetUrl) {
    const subject = 'Reset your password';

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject,
      html: await this.renderEmail('passwordReset', subject, {
        firstname,
        resetUrl,
        preheader: 'Set a new password for your Training Platform account.',
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendPasswordChangedEmail(toEmail, firstname) {
    const subject = 'Your password was changed';

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject,
      html: await this.renderEmail('passwordChanged', subject, {
        firstname,
        preheader: 'Your password was just changed.',
      }),
      attachments: this.logoAttachment(),
    });
  }

  async sendRecordChangedNotification(managerEmails, { actor, action, entityType, entityId, label }) {
    if (!managerEmails || managerEmails.length === 0) {
      return;
    }

    const ACTION_VERBS = { update: 'updated', delete: 'deleted', cancel: 'cancelled' };
    const verb = ACTION_VERBS[action] || action;
    const subject = `${entityType} ${verb} by ${actor.firstname} ${actor.lastname}`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: managerEmails.join(','),
      subject,
      html: await this.renderEmail('recordChanged', subject, {
        actor,
        verb,
        entityType,
        entityId,
        label,
        preheader: subject,
      }),
      attachments: this.logoAttachment(),
    });
  }
}

export { EmailService };
