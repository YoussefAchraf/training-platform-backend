import { z } from 'zod';

const MAX_INT = 2147483647;

const text = (max: number) => z.string().max(max);
const optionalText = (max: number) => text(max).nullish();

const digitsToNumber = (value: unknown) => (typeof value === 'string' && /^\d{1,10}$/.test(value) ? Number(value) : value);

const id = z.preprocess(digitsToNumber, z.number().int().positive().max(MAX_INT));
const nonNegativeInt = z.preprocess(digitsToNumber, z.number().int().min(0).max(MAX_INT));

const dateInput = z.union([z.string().max(40), z.number()]);

const accountEmail = z
  .string()
  .max(150)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().max(128);

const opt = <T extends z.ZodType>(schema: T) => schema.optional();

export const signup = z.object({
  firstname: opt(text(100)),
  lastname: opt(text(100)),
  email: opt(accountEmail),
  password: opt(password),
  role: opt(text(50)),
});

export const login = z.object({
  email: opt(accountEmail),
  password: opt(password),
});

export const resetPassword = z.object({
  token: opt(text(512)),
  newPassword: opt(password),
});

export const changePassword = z.object({
  currentPassword: opt(password),
  newPassword: opt(password),
});

export const updateMe = z.object({
  firstname: opt(text(100)),
  lastname: opt(text(100)),
  hasSeenTour: opt(z.boolean()),
});

export const adminUpdateUser = z.object({
  firstname: opt(text(100)),
  lastname: opt(text(100)),
  email: opt(accountEmail),
  role: opt(text(50)),
  status: opt(text(20)),
});

export const provider = z.object({
  name: opt(text(150)),
  description: opt(optionalText(10000)),
  logoUrl: opt(optionalText(500)),
});

export const trainingCreate = z.object({
  name: opt(text(150)),
  providerId: opt(id),
  description: opt(optionalText(10000)),
  duration: opt(nonNegativeInt.nullable()),
  durationUnit: opt(optionalText(20)),
});

export const trainingUpdate = z.object({
  name: opt(text(150)),
  description: opt(optionalText(10000)),
  duration: opt(nonNegativeInt.nullable()),
  durationUnit: opt(optionalText(20)),
});

export const client = z.object({
  companyName: opt(text(150)),
  email: opt(optionalText(150)),
  phone: opt(optionalText(30)),
  country: opt(optionalText(2)),
});

export const calendarEventUpdate = z.object({
  eventDate: opt(dateInput),
  endDate: opt(dateInput.nullable()),
  title: opt(text(200)),
});

export const sessionCreate = z.object({
  trainingId: opt(id),
  clientId: opt(id),
  startDate: opt(dateInput),
  endDate: opt(dateInput),
  includeWeekends: opt(z.boolean()),
  locationType: opt(text(20)),
  teachingLanguage: opt(text(20)),
});

export const sessionUpdate = z.object({
  startDate: opt(dateInput),
  endDate: opt(dateInput),
  includeWeekends: opt(z.boolean()),
  locationType: opt(text(20)),
  teachingLanguage: opt(text(20)),
});

export const assignInstructor = z.object({
  instructorId: opt(id),
});

export const attendee = z.object({
  name: opt(text(150)),
  email: opt(optionalText(150)),
});

export const attendance = z.object({
  status: opt(text(20)),
});

export const note = z.object({
  body: opt(text(10000)),
});

export const surveySubmit = z.object({
  attendeeId: opt(id.nullable()),
  instructorScore: opt(z.number().int()),
  npsScore: opt(z.number().int()),
  comments: opt(optionalText(5000)),
});

export const feedback = z.object({
  category: opt(text(20)),
  message: opt(text(5000)),
});

export const announcementCreate = z.object({
  title: opt(text(150)),
  description: opt(text(10000)),
  targetRoles: opt(z.array(text(50)).max(20)),
});

export const announcementRate = z.object({
  stars: opt(z.number().int()),
});

export const pushSubscribe = z.object({
  endpoint: opt(text(2048)),
  keys: opt(
    z.object({
      p256dh: opt(text(512)),
      auth: opt(text(256)),
    })
  ),
  silent: opt(z.boolean()),
});

export const pushUnsubscribe = z.object({
  endpoint: opt(text(2048)),
});

export const instructorProfile = z.object({
  bio: opt(optionalText(10000)),
  skills: opt(
    z
      .array(
        z.object({
          trainingId: opt(id),
          certificateId: opt(optionalText(200)),
          certificateExpiresAt: opt(dateInput.nullable()),
        })
      )
      .max(200)
  ),
});

export const directConversation = z.object({
  targetUserId: opt(id),
});

export const groupConversation = z.object({
  name: opt(text(150)),
  memberUserIds: opt(z.array(id).max(200)),
});

export const conversationParticipant = z.object({
  userId: opt(id),
});

export const conversationRead = z.object({
  messageId: opt(id.nullable()),
});

export const conversationMute = z.object({
  muted: opt(z.boolean()),
});

export const messageSend = z.object({
  type: opt(text(20)),
  body: opt(z.string().max(20000).nullable()),
  replyToMessageId: opt(id.nullable()),
});

export const messageTranslate = z.object({
  targetLanguage: opt(text(20)),
});

export const messageForward = z.object({
  targetConversationId: opt(id),
});

export const messageEdit = z.object({
  body: opt(z.string().max(20000)),
});

export const messageDelete = z.object({
  scope: opt(text(20)),
});

export const uploadInitiate = z.object({
  type: opt(text(20)),
  originalName: opt(text(255)),
  sizeBytes: opt(nonNegativeInt),
});

export const uploadComplete = z.object({
  replyToMessageId: opt(id.nullable()),
});

const queryText = (max: number) => z.string().max(max).optional();
const queryInt = z
  .string()
  .regex(/^\d{1,10}$/, 'must be a non-negative integer')
  .refine((value) => Number(value) <= MAX_INT, 'is too large')
  .optional();

export const auditLogQuery = z.object({
  entityType: queryText(50),
  entityId: queryInt,
  startDate: queryText(40),
  endDate: queryText(40),
  roleName: queryText(50),
});

export const trainingListQuery = z.object({
  providerId: queryInt,
});

export const searchQuery = z.object({
  search: queryText(200),
});

export const messageListQuery = z.object({
  cursor: queryInt,
  limit: queryInt,
  search: queryText(200),
});

export const mediaListQuery = z.object({
  cursor: queryInt,
  limit: queryInt,
  filter: queryText(20),
});
