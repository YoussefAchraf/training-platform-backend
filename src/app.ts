import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swaggerDefinition';
import { redis } from './infrastructure/cache/RedisClient';
import { prismaClient } from './infrastructure/database/prismaClient';

import { PasswordHasher } from './infrastructure/security/PasswordHasher';
import { TokenService } from './infrastructure/security/TokenService';
import { RefreshTokenStore } from './infrastructure/security/RefreshTokenStore';
import { PasswordResetTokenStore } from './infrastructure/security/PasswordResetTokenStore';

import { EmailService } from './infrastructure/services/EmailService';
import { ReportSchedulerService } from './infrastructure/services/ReportSchedulerService';
import { SessionReminderSchedulerService } from './infrastructure/services/SessionReminderSchedulerService';
import { CertificationExpirySchedulerService } from './infrastructure/services/CertificationExpirySchedulerService';
import { AttachmentUploadGcService } from './infrastructure/services/AttachmentUploadGcService';
import { QRCodeService } from './infrastructure/services/QRCodeService';
import { PdfReportService } from './infrastructure/services/PdfReportService';
import { WebPushService } from './infrastructure/services/WebPushService';
import { AttendeeFileParserService } from './infrastructure/services/AttendeeFileParserService';
import { AttachmentStorageService } from './infrastructure/services/AttachmentStorageService';
import { TranslationService } from './infrastructure/services/TranslationService';

import { PgUserRepository } from './infrastructure/repositories/PgUserRepository';
import { PgProviderRepository } from './infrastructure/repositories/PgProviderRepository';
import { PgTrainingRepository } from './infrastructure/repositories/PgTrainingRepository';
import { PgClientRepository } from './infrastructure/repositories/PgClientRepository';
import { PgInstructorRepository } from './infrastructure/repositories/PgInstructorRepository';
import { PgSessionRepository } from './infrastructure/repositories/PgSessionRepository';
import { PgCalendarRepository } from './infrastructure/repositories/PgCalendarRepository';
import { PgSurveyRepository } from './infrastructure/repositories/PgSurveyRepository';
import { PgReportRepository } from './infrastructure/repositories/PgReportRepository';
import { PgSessionNoteRepository } from './infrastructure/repositories/PgSessionNoteRepository';
import { PgAuditLogRepository } from './infrastructure/repositories/PgAuditLogRepository';
import { PgRoleRepository } from './infrastructure/repositories/PgRoleRepository';
import { PgPushSubscriptionRepository } from './infrastructure/repositories/PgPushSubscriptionRepository';
import { PgFeedbackRepository } from './infrastructure/repositories/PgFeedbackRepository';
import { PgFeatureAnnouncementRepository } from './infrastructure/repositories/PgFeatureAnnouncementRepository';
import { PgConversationRepository } from './infrastructure/repositories/PgConversationRepository';
import { PgMessageRepository } from './infrastructure/repositories/PgMessageRepository';

import { SignupUseCase } from './use-cases/auth/SignupUseCase';
import { LoginUseCase } from './use-cases/auth/LoginUseCase';
import { ListPendingUsersUseCase } from './use-cases/auth/ListPendingUsersUseCase';
import { ApproveUserUseCase } from './use-cases/auth/ApproveUserUseCase';
import { RefreshTokenUseCase } from './use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from './use-cases/auth/LogoutUseCase';
import { ListAllUsersUseCase } from './use-cases/auth/ListAllUsersUseCase';
import { UpdateUserByAdminUseCase } from './use-cases/auth/UpdateUserByAdminUseCase';
import { DeactivateUserUseCase } from './use-cases/auth/DeactivateUserUseCase';
import { HardDeleteUserUseCase } from './use-cases/auth/HardDeleteUserUseCase';
import { UpdateOwnProfileUseCase } from './use-cases/auth/UpdateOwnProfileUseCase';
import { ListRolesUseCase } from './use-cases/auth/ListRolesUseCase';
import { RequestPasswordResetUseCase } from './use-cases/auth/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from './use-cases/auth/ResetPasswordUseCase';
import { ChangeOwnPasswordUseCase } from './use-cases/auth/ChangeOwnPasswordUseCase';
import { GetAdminSessionsOverviewUseCase } from './use-cases/admin/GetAdminSessionsOverviewUseCase';
import { GetAuditLogUseCase } from './use-cases/admin/GetAuditLogUseCase';

import { CreateProviderUseCase } from './use-cases/providers/CreateProviderUseCase';
import { ListProvidersUseCase } from './use-cases/providers/ListProvidersUseCase';
import { UpdateProviderUseCase } from './use-cases/providers/UpdateProviderUseCase';
import { DeleteProviderUseCase } from './use-cases/providers/DeleteProviderUseCase';
import { CreateTrainingUseCase } from './use-cases/trainings/CreateTrainingUseCase';
import { ListTrainingsUseCase } from './use-cases/trainings/ListTrainingsUseCase';
import { UpdateTrainingUseCase } from './use-cases/trainings/UpdateTrainingUseCase';
import { DeleteTrainingUseCase } from './use-cases/trainings/DeleteTrainingUseCase';
import { CreateClientUseCase } from './use-cases/clients/CreateClientUseCase';
import { ListClientsUseCase } from './use-cases/clients/ListClientsUseCase';
import { UpdateClientUseCase } from './use-cases/clients/UpdateClientUseCase';
import { DeleteClientUseCase } from './use-cases/clients/DeleteClientUseCase';

import { ListInstructorsUseCase } from './use-cases/instructors/ListInstructorsUseCase';
import { GetMyInstructorProfileUseCase } from './use-cases/instructors/GetMyInstructorProfileUseCase';
import { UpdateMyInstructorProfileUseCase } from './use-cases/instructors/UpdateMyInstructorProfileUseCase';
import { UpdateInstructorByManagerUseCase } from './use-cases/instructors/UpdateInstructorByManagerUseCase';
import { SendCertificationExpiryRemindersUseCase } from './use-cases/instructors/SendCertificationExpiryRemindersUseCase';

import { CreateSessionUseCase } from './use-cases/sessions/CreateSessionUseCase';
import { ListSessionsUseCase } from './use-cases/sessions/ListSessionsUseCase';
import { AssignInstructorUseCase } from './use-cases/sessions/AssignInstructorUseCase';
import { AddAttendeeUseCase } from './use-cases/sessions/AddAttendeeUseCase';
import { ListSessionAttendeesUseCase } from './use-cases/sessions/ListSessionAttendeesUseCase';
import { UpdateSessionUseCase } from './use-cases/sessions/UpdateSessionUseCase';
import { CancelSessionUseCase } from './use-cases/sessions/CancelSessionUseCase';
import { BulkImportAttendeesUseCase } from './use-cases/sessions/BulkImportAttendeesUseCase';
import { MarkAttendanceUseCase } from './use-cases/sessions/MarkAttendanceUseCase';
import { UpdateAttendeeUseCase } from './use-cases/sessions/UpdateAttendeeUseCase';
import { DeleteAttendeeUseCase } from './use-cases/sessions/DeleteAttendeeUseCase';
import { SendUpcomingSessionRemindersUseCase } from './use-cases/sessions/SendUpcomingSessionRemindersUseCase';
import { CreateSessionNoteUseCase } from './use-cases/sessions/CreateSessionNoteUseCase';
import { ListSessionNotesUseCase } from './use-cases/sessions/ListSessionNotesUseCase';
import { UpdateSessionNoteUseCase } from './use-cases/sessions/UpdateSessionNoteUseCase';
import { DeleteSessionNoteUseCase } from './use-cases/sessions/DeleteSessionNoteUseCase';

import {
  ListGlobalCalendarUseCase,
  UpdateGlobalCalendarUseCase,
  DeleteGlobalCalendarEventUseCase,
} from './use-cases/calendar/GlobalCalendarUseCases';
import { ListMyCalendarUseCase } from './use-cases/calendar/ListMyCalendarUseCase';

import { GenerateReportUseCase } from './use-cases/reports/GenerateReportUseCase';
import { GetReportUseCase } from './use-cases/reports/GetReportUseCase';
import { GetReportPdfUseCase } from './use-cases/reports/GetReportPdfUseCase';
import { GenerateSurveyQRUseCase } from './use-cases/surveys/GenerateSurveyQRUseCase';
import { GetSurveySessionInfoUseCase } from './use-cases/surveys/GetSurveySessionInfoUseCase';
import { SubmitSurveyUseCase } from './use-cases/surveys/SubmitSurveyUseCase';

import { SubscribeToPushUseCase } from './use-cases/push/SubscribeToPushUseCase';
import { UnsubscribeFromPushUseCase } from './use-cases/push/UnsubscribeFromPushUseCase';

import { SubmitFeedbackReportUseCase } from './use-cases/feedback/SubmitFeedbackReportUseCase';
import { ListFeedbackReportsUseCase } from './use-cases/feedback/ListFeedbackReportsUseCase';
import { CreateFeatureAnnouncementUseCase } from './use-cases/announcements/CreateFeatureAnnouncementUseCase';
import { ListFeatureAnnouncementsUseCase } from './use-cases/announcements/ListFeatureAnnouncementsUseCase';
import { ListMyPendingAnnouncementsUseCase } from './use-cases/announcements/ListMyPendingAnnouncementsUseCase';
import { RateFeatureAnnouncementUseCase } from './use-cases/announcements/RateFeatureAnnouncementUseCase';

import { CreateDirectConversationUseCase } from './use-cases/messaging/CreateDirectConversationUseCase';
import { CreateGroupConversationUseCase } from './use-cases/messaging/CreateGroupConversationUseCase';
import { AddParticipantUseCase } from './use-cases/messaging/AddParticipantUseCase';
import { RemoveParticipantUseCase } from './use-cases/messaging/RemoveParticipantUseCase';
import { ListConversationsUseCase } from './use-cases/messaging/ListConversationsUseCase';
import { ListReachablePeopleUseCase } from './use-cases/messaging/ListReachablePeopleUseCase';
import { SendMessageUseCase } from './use-cases/messaging/SendMessageUseCase';
import { ListMessagesUseCase } from './use-cases/messaging/ListMessagesUseCase';
import { ListConversationMediaUseCase } from './use-cases/messaging/ListConversationMediaUseCase';
import { InitiateUploadUseCase } from './use-cases/messaging/InitiateUploadUseCase';
import { UploadChunkUseCase } from './use-cases/messaging/UploadChunkUseCase';
import { CompleteUploadUseCase } from './use-cases/messaging/CompleteUploadUseCase';
import { AbortUploadUseCase } from './use-cases/messaging/AbortUploadUseCase';
import { StatusUploadUseCase } from './use-cases/messaging/StatusUploadUseCase';
import { MarkConversationReadUseCase } from './use-cases/messaging/MarkConversationReadUseCase';
import { HideConversationUseCase } from './use-cases/messaging/HideConversationUseCase';
import { SetConversationMutedUseCase } from './use-cases/messaging/SetConversationMutedUseCase';
import { DownloadAttachmentUseCase } from './use-cases/messaging/DownloadAttachmentUseCase';
import { TranslateMessageUseCase } from './use-cases/messaging/TranslateMessageUseCase';
import { ForwardMessageUseCase } from './use-cases/messaging/ForwardMessageUseCase';
import { EditMessageUseCase } from './use-cases/messaging/EditMessageUseCase';
import { DeleteMessageUseCase } from './use-cases/messaging/DeleteMessageUseCase';

import { AuthController } from './interface/controllers/AuthController';
import { AdminController } from './interface/controllers/AdminController';
import { ProviderController } from './interface/controllers/ProviderController';
import { TrainingController } from './interface/controllers/TrainingController';
import { ClientController } from './interface/controllers/ClientController';
import { InstructorController } from './interface/controllers/InstructorController';
import { SessionController } from './interface/controllers/SessionController';
import { CalendarController } from './interface/controllers/CalendarController';
import { ReportController } from './interface/controllers/ReportController';
import { SurveyController } from './interface/controllers/SurveyController';
import { PushController } from './interface/controllers/PushController';
import { FeedbackController } from './interface/controllers/FeedbackController';
import { AnnouncementController } from './interface/controllers/AnnouncementController';
import { ConversationsController } from './interface/controllers/ConversationsController';
import { MessagesController } from './interface/controllers/MessagesController';
import { MessagingDirectoryController } from './interface/controllers/MessagingDirectoryController';
import { AttachmentsController } from './interface/controllers/AttachmentsController';
import { ConversationMediaController } from './interface/controllers/ConversationMediaController';
import { UploadsController } from './interface/controllers/UploadsController';

import authMiddlewareFactory from './interface/middlewares/authMiddleware';
import optionalAuthMiddlewareFactory from './interface/middlewares/optionalAuthMiddleware';
import { setSessionCookies, clearSessionCookies, csrfCheckPasses } from './infrastructure/security/CookieSessionService';
import requireRole from './interface/middlewares/roleMiddleware';
import createRateLimiter from './interface/middlewares/rateLimitMiddleware';
import sanitizeMiddleware from './interface/middlewares/sanitizeMiddleware';
import uploadAttendeesFile from './interface/middlewares/uploadMiddleware';
import uploadMessageAttachmentFactory from './interface/middlewares/uploadMessageAttachmentMiddleware';
import uploadChunkMiddlewareFactory from './interface/middlewares/uploadChunkMiddleware';

import authRoutes from './interface/routes/authRoutes';
import adminRoutes from './interface/routes/adminRoutes';
import providerRoutes from './interface/routes/providerRoutes';
import trainingRoutes from './interface/routes/trainingRoutes';
import clientRoutes from './interface/routes/clientRoutes';
import instructorRoutes from './interface/routes/instructorRoutes';
import sessionRoutes from './interface/routes/sessionRoutes';
import calendarRoutes from './interface/routes/calendarRoutes';
import reportRoutes from './interface/routes/reportRoutes';
import surveyRoutes from './interface/routes/surveyRoutes';
import pushRoutes from './interface/routes/pushRoutes';
import feedbackRoutes from './interface/routes/feedbackRoutes';
import announcementRoutes from './interface/routes/announcementRoutes';
import messagingRoutes from './interface/routes/messagingRoutes';

function buildApp({ app: providedApp, messagingRealtime = null, presenceStore = null }: any = {}) {
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService();
  const refreshTokenStore = new RefreshTokenStore({ redisClient: redis });
  const passwordResetTokenStore = new PasswordResetTokenStore({ redisClient: redis });
  const emailService = new EmailService();
  const qrCodeService = new QRCodeService();
  const pdfReportService = new PdfReportService();
  const webPushService = new WebPushService();
  const attachmentStorageService = new AttachmentStorageService();
  const translationService = new TranslationService();
  const attendeeFileParserService = new AttendeeFileParserService();

  const userRepository = new PgUserRepository(prismaClient);
  const providerRepository = new PgProviderRepository(prismaClient);
  const trainingRepository = new PgTrainingRepository(prismaClient);
  const clientRepository = new PgClientRepository(prismaClient);
  const instructorRepository = new PgInstructorRepository(prismaClient);
  const sessionRepository = new PgSessionRepository(prismaClient);
  const calendarRepository = new PgCalendarRepository(prismaClient);
  const surveyRepository = new PgSurveyRepository(prismaClient);
  const reportRepository = new PgReportRepository(prismaClient);
  const sessionNoteRepository = new PgSessionNoteRepository(prismaClient);
  const auditLogRepository = new PgAuditLogRepository(prismaClient);
  const roleRepository = new PgRoleRepository(prismaClient);
  const pushSubscriptionRepository = new PgPushSubscriptionRepository(prismaClient);
  const feedbackRepository = new PgFeedbackRepository(prismaClient);
  const announcementRepository = new PgFeatureAnnouncementRepository(prismaClient);
  const conversationRepository = new PgConversationRepository(prismaClient);
  const messageRepository = new PgMessageRepository(prismaClient);

  const signupUseCase = new SignupUseCase({
    userRepository,
    instructorRepository,
    passwordHasher,
    emailService,
    auditLogRepository,
    pushSubscriptionRepository,
    webPushService,
  });
  const loginUseCase = new LoginUseCase({ userRepository, passwordHasher, tokenService, refreshTokenStore });
  const listPendingUsersUseCase = new ListPendingUsersUseCase({ userRepository });
  const approveUserUseCase = new ApproveUserUseCase({
    userRepository,
    emailService,
    refreshTokenStore,
    auditLogRepository,
  });
  const refreshTokenUseCase = new RefreshTokenUseCase({ userRepository, tokenService, refreshTokenStore });
  const logoutUseCase = new LogoutUseCase({ refreshTokenStore });
  const listAllUsersUseCase = new ListAllUsersUseCase({ userRepository });
  const updateUserByAdminUseCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository, instructorRepository });
  const deactivateUserUseCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });
  const hardDeleteUserUseCase = new HardDeleteUserUseCase({ userRepository, auditLogRepository });
  const updateOwnProfileUseCase = new UpdateOwnProfileUseCase({ userRepository, auditLogRepository });
  const listRolesUseCase = new ListRolesUseCase({ roleRepository });
  const requestPasswordResetUseCase = new RequestPasswordResetUseCase({
    userRepository,
    passwordResetTokenStore,
    refreshTokenStore,
    emailService,
    auditLogRepository,
  });
  const resetPasswordUseCase = new ResetPasswordUseCase({
    userRepository,
    passwordResetTokenStore,
    refreshTokenStore,
    passwordHasher,
    emailService,
    auditLogRepository,
  });
  const changeOwnPasswordUseCase = new ChangeOwnPasswordUseCase({
    userRepository,
    passwordHasher,
    tokenService,
    refreshTokenStore,
    emailService,
    auditLogRepository,
  });
  const getAdminSessionsOverviewUseCase = new GetAdminSessionsOverviewUseCase({ sessionRepository });
  const getAuditLogUseCase = new GetAuditLogUseCase({ auditLogRepository });

  const createProviderUseCase = new CreateProviderUseCase({ providerRepository, auditLogRepository });
  const listProvidersUseCase = new ListProvidersUseCase({ providerRepository });
  const updateProviderUseCase = new UpdateProviderUseCase({
    providerRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const deleteProviderUseCase = new DeleteProviderUseCase({
    providerRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const createTrainingUseCase = new CreateTrainingUseCase({
    trainingRepository,
    providerRepository,
    auditLogRepository,
  });
  const listTrainingsUseCase = new ListTrainingsUseCase({ trainingRepository });
  const updateTrainingUseCase = new UpdateTrainingUseCase({
    trainingRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const deleteTrainingUseCase = new DeleteTrainingUseCase({
    trainingRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const createClientUseCase = new CreateClientUseCase({ clientRepository, auditLogRepository });
  const listClientsUseCase = new ListClientsUseCase({ clientRepository });
  const updateClientUseCase = new UpdateClientUseCase({
    clientRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const deleteClientUseCase = new DeleteClientUseCase({
    clientRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });

  const listInstructorsUseCase = new ListInstructorsUseCase({ instructorRepository });
  const getMyInstructorProfileUseCase = new GetMyInstructorProfileUseCase({ instructorRepository });
  const updateMyInstructorProfileUseCase = new UpdateMyInstructorProfileUseCase({ instructorRepository });
  const updateInstructorByManagerUseCase = new UpdateInstructorByManagerUseCase({ instructorRepository });

  const createSessionUseCase = new CreateSessionUseCase({
    sessionRepository,
    trainingRepository,
    clientRepository,
    calendarRepository,
    auditLogRepository,
  });
  const listSessionsUseCase = new ListSessionsUseCase({ sessionRepository, instructorRepository });
  const assignInstructorUseCase = new AssignInstructorUseCase({
    sessionRepository,
    instructorRepository,
    trainingRepository,
    emailService,
    webPushService,
    pushSubscriptionRepository,
  });
  const addAttendeeUseCase = new AddAttendeeUseCase({ sessionRepository });
  const listSessionAttendeesUseCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });
  const updateSessionUseCase = new UpdateSessionUseCase({
    sessionRepository,
    calendarRepository,
    reportRepository,
    surveyRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const cancelSessionUseCase = new CancelSessionUseCase({
    sessionRepository,
    reportRepository,
    surveyRepository,
    auditLogRepository,
    userRepository,
    emailService,
  });
  const bulkImportAttendeesUseCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });
  const markAttendanceUseCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });
  const updateAttendeeUseCase = new UpdateAttendeeUseCase({ sessionRepository });
  const createSessionNoteUseCase = new CreateSessionNoteUseCase({ sessionRepository, instructorRepository, sessionNoteRepository });
  const listSessionNotesUseCase = new ListSessionNotesUseCase({ sessionRepository, instructorRepository, sessionNoteRepository });
  const updateSessionNoteUseCase = new UpdateSessionNoteUseCase({ sessionRepository, instructorRepository, sessionNoteRepository });
  const deleteSessionNoteUseCase = new DeleteSessionNoteUseCase({ sessionRepository, instructorRepository, sessionNoteRepository });
  const deleteAttendeeUseCase = new DeleteAttendeeUseCase({ sessionRepository });
  const sendUpcomingSessionRemindersUseCase = new SendUpcomingSessionRemindersUseCase({
    sessionRepository,
    trainingRepository,
    instructorRepository,
    pushSubscriptionRepository,
    webPushService,
  });
  const sendCertificationExpiryRemindersUseCase = new SendCertificationExpiryRemindersUseCase({
    instructorRepository,
    userRepository,
    pushSubscriptionRepository,
    webPushService,
    emailService,
  });

  const listGlobalCalendarUseCase = new ListGlobalCalendarUseCase({ calendarRepository });
  const updateGlobalCalendarUseCase = new UpdateGlobalCalendarUseCase({ calendarRepository });
  const deleteGlobalCalendarEventUseCase = new DeleteGlobalCalendarEventUseCase({ calendarRepository });
  const listMyCalendarUseCase = new ListMyCalendarUseCase({ calendarRepository, instructorRepository });

  const generateReportUseCase = new GenerateReportUseCase({ sessionRepository, surveyRepository, reportRepository });
  const getReportUseCase = new GetReportUseCase({ reportRepository });
  const getReportPdfUseCase = new GetReportPdfUseCase({
    reportRepository,
    sessionRepository,
    trainingRepository,
    clientRepository,
    instructorRepository,
    pdfReportService,
  });
  const generateSurveyQRUseCase = new GenerateSurveyQRUseCase({
    sessionRepository,
    instructorRepository,
    qrCodeService,
  });
  const getSurveySessionInfoUseCase = new GetSurveySessionInfoUseCase({
    sessionRepository,
    trainingRepository,
    instructorRepository,
  });
  const submitSurveyUseCase = new SubmitSurveyUseCase({
    sessionRepository,
    surveyRepository,
    generateReportUseCase,
  });

  const subscribeToPushUseCase = new SubscribeToPushUseCase({ pushSubscriptionRepository, webPushService });
  const unsubscribeFromPushUseCase = new UnsubscribeFromPushUseCase({ pushSubscriptionRepository });

  const submitFeedbackReportUseCase = new SubmitFeedbackReportUseCase({ feedbackRepository });
  const listFeedbackReportsUseCase = new ListFeedbackReportsUseCase({ feedbackRepository });
  const createFeatureAnnouncementUseCase = new CreateFeatureAnnouncementUseCase({ announcementRepository });
  const listFeatureAnnouncementsUseCase = new ListFeatureAnnouncementsUseCase({ announcementRepository });
  const listMyPendingAnnouncementsUseCase = new ListMyPendingAnnouncementsUseCase({ announcementRepository });
  const rateFeatureAnnouncementUseCase = new RateFeatureAnnouncementUseCase({ announcementRepository });

  const createDirectConversationUseCase = new CreateDirectConversationUseCase({ conversationRepository, userRepository, messagingRealtime });
  const createGroupConversationUseCase = new CreateGroupConversationUseCase({ conversationRepository, userRepository, messagingRealtime });
  const addParticipantUseCase = new AddParticipantUseCase({ conversationRepository, userRepository, messagingRealtime });
  const removeParticipantUseCase = new RemoveParticipantUseCase({ conversationRepository, messagingRealtime });
  const listConversationsUseCase = new ListConversationsUseCase({ conversationRepository });
  const listReachablePeopleUseCase = new ListReachablePeopleUseCase({ conversationRepository });
  const sendMessageUseCase = new SendMessageUseCase({
    conversationRepository,
    messageRepository,
    messagingRealtime,
    presenceStore,
    pushSubscriptionRepository,
    webPushService,
    attachmentStorageService,
  });
  const listMessagesUseCase = new ListMessagesUseCase({ conversationRepository, messageRepository, messagingRealtime });
  const listConversationMediaUseCase = new ListConversationMediaUseCase({ conversationRepository, messageRepository });
  const initiateUploadUseCase = new InitiateUploadUseCase({ conversationRepository, attachmentStorageService });
  const uploadChunkUseCase = new UploadChunkUseCase({ conversationRepository, attachmentStorageService });
  const completeUploadUseCase = new CompleteUploadUseCase({
    conversationRepository,
    attachmentStorageService,
    sendMessageUseCase,
  });
  const abortUploadUseCase = new AbortUploadUseCase({ attachmentStorageService });
  const statusUploadUseCase = new StatusUploadUseCase({ attachmentStorageService });
  const markConversationReadUseCase = new MarkConversationReadUseCase({ conversationRepository, messagingRealtime });
  const hideConversationUseCase = new HideConversationUseCase({ conversationRepository, messagingRealtime });
  const setConversationMutedUseCase = new SetConversationMutedUseCase({ conversationRepository, messagingRealtime });
  const downloadAttachmentUseCase = new DownloadAttachmentUseCase({ conversationRepository, messageRepository });
  const translateMessageUseCase = new TranslateMessageUseCase({
    conversationRepository,
    messageRepository,
    translationService,
    redis,
  });
  const forwardMessageUseCase = new ForwardMessageUseCase({
    conversationRepository,
    messageRepository,
    messagingRealtime,
    presenceStore,
    pushSubscriptionRepository,
    webPushService,
  });
  const editMessageUseCase = new EditMessageUseCase({ conversationRepository, messageRepository, messagingRealtime });
  const deleteMessageUseCase = new DeleteMessageUseCase({
    conversationRepository,
    messageRepository,
    attachmentStorageService,
    messagingRealtime,
  });

  const authController = new AuthController({
    signupUseCase,
    loginUseCase,
    listPendingUsersUseCase,
    approveUserUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    listAllUsersUseCase,
    updateUserByAdminUseCase,
    deactivateUserUseCase,
    hardDeleteUserUseCase,
    updateOwnProfileUseCase,
    tokenService,
    listRolesUseCase,
    setSessionCookies,
    clearSessionCookies,
    csrfCheckPasses,
    requestPasswordResetUseCase,
    resetPasswordUseCase,
    changeOwnPasswordUseCase,
  });
  const adminController = new AdminController({ getAdminSessionsOverviewUseCase, getAuditLogUseCase });
  const providerController = new ProviderController({
    createProviderUseCase,
    listProvidersUseCase,
    updateProviderUseCase,
    deleteProviderUseCase,
  });
  const trainingController = new TrainingController({
    createTrainingUseCase,
    listTrainingsUseCase,
    updateTrainingUseCase,
    deleteTrainingUseCase,
  });
  const clientController = new ClientController({
    createClientUseCase,
    listClientsUseCase,
    updateClientUseCase,
    deleteClientUseCase,
  });
  const instructorController = new InstructorController({
    listInstructorsUseCase,
    getMyInstructorProfileUseCase,
    updateMyInstructorProfileUseCase,
    updateInstructorByManagerUseCase,
  });
  const sessionController = new SessionController({
    createSessionUseCase,
    listSessionsUseCase,
    assignInstructorUseCase,
    addAttendeeUseCase,
    listSessionAttendeesUseCase,
    updateSessionUseCase,
    cancelSessionUseCase,
    bulkImportAttendeesUseCase,
    markAttendanceUseCase,
    updateAttendeeUseCase,
    deleteAttendeeUseCase,
    createSessionNoteUseCase,
    listSessionNotesUseCase,
    updateSessionNoteUseCase,
    deleteSessionNoteUseCase,
  });
  const calendarController = new CalendarController({
    listGlobalCalendarUseCase,
    updateGlobalCalendarUseCase,
    deleteGlobalCalendarEventUseCase,
    listMyCalendarUseCase,
  });
  const reportController = new ReportController({ getReportUseCase, generateReportUseCase, getReportPdfUseCase });
  const surveyController = new SurveyController({
    generateSurveyQRUseCase,
    getSurveySessionInfoUseCase,
    submitSurveyUseCase,
  });
  const pushController = new PushController({ subscribeToPushUseCase, unsubscribeFromPushUseCase });
  const feedbackController = new FeedbackController({ submitFeedbackReportUseCase, listFeedbackReportsUseCase });
  const announcementController = new AnnouncementController({
    createFeatureAnnouncementUseCase,
    listFeatureAnnouncementsUseCase,
    listMyPendingAnnouncementsUseCase,
    rateFeatureAnnouncementUseCase,
  });
  const conversationsController = new ConversationsController({
    createDirectConversationUseCase,
    createGroupConversationUseCase,
    addParticipantUseCase,
    removeParticipantUseCase,
    listConversationsUseCase,
    markConversationReadUseCase,
    hideConversationUseCase,
    setConversationMutedUseCase,
  });
  const messagesController = new MessagesController({
    sendMessageUseCase,
    listMessagesUseCase,
    translateMessageUseCase,
    forwardMessageUseCase,
    editMessageUseCase,
    deleteMessageUseCase,
  });
  const messagingDirectoryController = new MessagingDirectoryController({ listReachablePeopleUseCase });
  const attachmentsController = new AttachmentsController({ downloadAttachmentUseCase, attachmentStorageService });
  const conversationMediaController = new ConversationMediaController({ listConversationMediaUseCase });
  const uploadsController = new UploadsController({
    initiateUploadUseCase,
    uploadChunkUseCase,
    completeUploadUseCase,
    abortUploadUseCase,
    statusUploadUseCase,
  });
  const uploadMessageAttachment = uploadMessageAttachmentFactory({ attachmentStorageService });
  const uploadChunkMiddleware = uploadChunkMiddlewareFactory({ attachmentStorageService });

  const authMiddleware = authMiddlewareFactory({ tokenService, userRepository, csrfCheckPasses });
  const optionalAuthMiddleware = optionalAuthMiddlewareFactory({ tokenService, userRepository });

  const globalLimiter = createRateLimiter({
    redisClient: redis,
    windowMs: 5 * 60 * 1000,
    limit: 300,
    prefix: 'global',
  });
  const authLimiter = createRateLimiter({
    redisClient: redis,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: 'Too many auth attempts, please try again later.',
    prefix: 'auth',
  });
  
  
  
  
  const adminLoginLimiter = createRateLimiter({
    redisClient: redis,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Too many admin login attempts, please try again later.',
    prefix: 'admin-login',
  });
  const developerLoginLimiter = createRateLimiter({
    redisClient: redis,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Too many developer login attempts, please try again later.',
    prefix: 'developer-login',
  });
  const translateLimiter = createRateLimiter({
    redisClient: redis,
    windowMs: 60 * 1000,
    limit: 20,
    message: 'Too many translation requests, please try again in a moment.',
    prefix: 'translate',
  });

  const app = providedApp || express();
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  
  
  
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(express.json());
  
  
  
  
  
  
  
  app.use(cookieParser());
  app.use(sanitizeMiddleware);
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(
    '/auth',
    authRoutes({
      authController,
      authMiddleware,
      optionalAuthMiddleware,
      requireRole,
      authLimiter,
      adminLoginLimiter,
      developerLoginLimiter,
    }),
  );
  app.use('/admin', adminRoutes({ authController, adminController, authMiddleware, requireRole }));
  app.use('/providers', providerRoutes({ providerController, authMiddleware, requireRole }));
  app.use('/trainings', trainingRoutes({ trainingController, authMiddleware, requireRole }));
  app.use('/clients', clientRoutes({ clientController, authMiddleware, requireRole }));
  app.use('/instructors', instructorRoutes({ instructorController, authMiddleware, requireRole }));
  app.use('/sessions', sessionRoutes({ sessionController, authMiddleware, requireRole, uploadAttendeesFile }));
  app.use('/calendar', calendarRoutes({ calendarController, authMiddleware, requireRole }));
  app.use('/reports', reportRoutes({ reportController, authMiddleware, requireRole }));
  app.use('/survey', surveyRoutes({ surveyController, authMiddleware, requireRole }));
  app.use('/push', pushRoutes({ pushController, authMiddleware }));
  app.use('/feedback', feedbackRoutes({ feedbackController, authMiddleware, requireRole }));
  app.use('/announcements', announcementRoutes({ announcementController, authMiddleware, requireRole }));
  app.use(
    '/messaging',
    messagingRoutes({
      conversationsController,
      messagesController,
      messagingDirectoryController,
      attachmentsController,
      conversationMediaController,
      uploadsController,
      uploadMessageAttachment,
      uploadChunkMiddleware,
      authMiddleware,
      requireRole,
      translateLimiter,
    }),
  );

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const reportScheduler = new ReportSchedulerService({ sessionRepository, generateReportUseCase });
  const sessionReminderScheduler = new SessionReminderSchedulerService({ sendUpcomingSessionRemindersUseCase });
  const certificationExpiryScheduler = new CertificationExpirySchedulerService({ sendCertificationExpiryRemindersUseCase });
  const attachmentUploadGcScheduler = new AttachmentUploadGcService({ attachmentStorageService });

  return {
    app,
    reportScheduler,
    sessionReminderScheduler,
    certificationExpiryScheduler,
    attachmentUploadGcScheduler,
  };
}

export { buildApp };
