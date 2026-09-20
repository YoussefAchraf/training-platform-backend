import type { ZodType } from 'zod';
import * as schemas from '../validation/requestSchemas';

interface Rule {
  method: 'POST' | 'PATCH' | 'PUT';
  pattern: RegExp;
  schema: ZodType;
  public?: boolean;
}

const SEG = '[^/]+';
const path = (template: string) => new RegExp(`^${template.replace(/:[a-zA-Z]+/g, SEG)}/?$`);

export const RULES: Rule[] = [
  { method: 'POST', pattern: path('/auth/signup'), schema: schemas.signup, public: true },
  { method: 'POST', pattern: path('/auth/login'), schema: schemas.login, public: true },
  { method: 'POST', pattern: path('/auth/admin-login'), schema: schemas.login, public: true },
  { method: 'POST', pattern: path('/auth/developer-login'), schema: schemas.login, public: true },
  { method: 'POST', pattern: path('/auth/reset-password'), schema: schemas.resetPassword, public: true },
  { method: 'POST', pattern: path('/survey/:sessionId/submit'), schema: schemas.surveySubmit, public: true },

  { method: 'PATCH', pattern: path('/auth/me'), schema: schemas.updateMe },
  { method: 'PATCH', pattern: path('/auth/me/password'), schema: schemas.changePassword },
  { method: 'PATCH', pattern: path('/admin/users/:id'), schema: schemas.adminUpdateUser },

  { method: 'POST', pattern: path('/providers'), schema: schemas.provider },
  { method: 'PATCH', pattern: path('/providers/:id'), schema: schemas.provider },
  { method: 'POST', pattern: path('/trainings'), schema: schemas.trainingCreate },
  { method: 'PATCH', pattern: path('/trainings/:id'), schema: schemas.trainingUpdate },
  { method: 'POST', pattern: path('/clients'), schema: schemas.client },
  { method: 'PATCH', pattern: path('/clients/:id'), schema: schemas.client },

  { method: 'PATCH', pattern: path('/calendar/global/:id'), schema: schemas.calendarEventUpdate },

  { method: 'POST', pattern: path('/sessions'), schema: schemas.sessionCreate },
  { method: 'PATCH', pattern: path('/sessions/:id'), schema: schemas.sessionUpdate },
  { method: 'POST', pattern: path('/sessions/:id/assign-instructor'), schema: schemas.assignInstructor },
  { method: 'POST', pattern: path('/sessions/:id/attendees'), schema: schemas.attendee },
  { method: 'PATCH', pattern: path('/sessions/:id/attendees/:attendeeId'), schema: schemas.attendee },
  { method: 'PATCH', pattern: path('/sessions/:id/attendees/:attendeeId/attendance'), schema: schemas.attendance },
  { method: 'POST', pattern: path('/sessions/:id/notes'), schema: schemas.note },
  { method: 'PATCH', pattern: path('/sessions/:id/notes/:noteId'), schema: schemas.note },

  { method: 'POST', pattern: path('/feedback'), schema: schemas.feedback },
  { method: 'POST', pattern: path('/announcements'), schema: schemas.announcementCreate },
  { method: 'PATCH', pattern: path('/announcements/:id/rate'), schema: schemas.announcementRate },

  { method: 'POST', pattern: path('/push/subscribe'), schema: schemas.pushSubscribe },
  { method: 'POST', pattern: path('/push/unsubscribe'), schema: schemas.pushUnsubscribe },

  { method: 'PATCH', pattern: path('/instructors/me'), schema: schemas.instructorProfile },
  { method: 'PATCH', pattern: path('/instructors/:id'), schema: schemas.instructorProfile },

  { method: 'POST', pattern: path('/messaging/conversations/direct'), schema: schemas.directConversation },
  { method: 'POST', pattern: path('/messaging/conversations/group'), schema: schemas.groupConversation },
  { method: 'POST', pattern: path('/messaging/conversations/:id/participants'), schema: schemas.conversationParticipant },
  { method: 'POST', pattern: path('/messaging/conversations/:id/read'), schema: schemas.conversationRead },
  { method: 'POST', pattern: path('/messaging/conversations/:id/mute'), schema: schemas.conversationMute },
  { method: 'POST', pattern: path('/messaging/conversations/:id/messages'), schema: schemas.messageSend },
  { method: 'POST', pattern: path('/messaging/conversations/:id/uploads'), schema: schemas.uploadInitiate },
  { method: 'POST', pattern: path('/messaging/uploads/:uploadId/complete'), schema: schemas.uploadComplete },
  { method: 'POST', pattern: path('/messaging/messages/:messageId/translate'), schema: schemas.messageTranslate },
  { method: 'POST', pattern: path('/messaging/messages/:messageId/forward'), schema: schemas.messageForward },
  { method: 'PATCH', pattern: path('/messaging/messages/:messageId'), schema: schemas.messageEdit },
];

const MAX_INT = 2147483647;

function hasCredentials(req): boolean {
  return Boolean(req.headers?.authorization) || Boolean(req.cookies?.accessToken);
}

function hasOverflowingNumericSegment(requestPath: string): boolean {
  return requestPath
    .split('/')
    .some((segment) => /^\d+$/.test(segment) && (segment.length > 10 || Number(segment) > MAX_INT));
}

export const QUERY_RULES: Array<{ pattern: RegExp; schema: ZodType }> = [
  { pattern: path('/admin/audit-log'), schema: schemas.auditLogQuery },
  { pattern: path('/trainings'), schema: schemas.trainingListQuery },
  { pattern: path('/messaging/directory'), schema: schemas.searchQuery },
  { pattern: path('/messaging/conversations/:id/messages'), schema: schemas.messageListQuery },
  { pattern: path('/messaging/conversations/:id/media'), schema: schemas.mediaListQuery },
];

function formatIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const details = error.issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message }));
  const first = details[0];
  return { error: first.field ? `${first.field}: ${first.message}` : first.message, details };
}

export default function requestValidationMiddleware(req, res, next) {
  if (hasOverflowingNumericSegment(req.path)) {
    return res.status(400).json({ error: 'Invalid identifier in path' });
  }

  if (req.method === 'GET') {
    const queryRule = QUERY_RULES.find((candidate) => candidate.pattern.test(req.path));
    if (!queryRule || !hasCredentials(req)) return next();
    const parsed = queryRule.schema.safeParse(req.query ?? {});
    if (!parsed.success) return res.status(400).json(formatIssues(parsed.error));
    return next();
  }

  const rule = RULES.find((candidate) => candidate.method === req.method && candidate.pattern.test(req.path));
  if (!rule) return next();

  if (!rule.public && !hasCredentials(req)) return next();
  if (!req.is('application/json')) return next();

  const result = rule.schema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json(formatIssues(result.error));
  }

  req.body = result.data;
  return next();
}
