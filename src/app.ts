import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { pool } from './infrastructure/database/connection';
import { prismaClient } from './infrastructure/database/prismaClient';
import { redis } from './infrastructure/cache/RedisClient';
import { swaggerSpec } from './docs/swaggerDefinition';

import { PasswordHasher } from './infrastructure/security/PasswordHasher';
import { TokenService } from './infrastructure/security/TokenService';
import { RefreshTokenStore } from './infrastructure/security/RefreshTokenStore';

import { EmailService } from './infrastructure/services/EmailService';
import { ReportSchedulerService } from './infrastructure/services/ReportSchedulerService';
import { QRCodeService } from './infrastructure/services/QRCodeService';
import { PdfReportService } from './infrastructure/services/PdfReportService';
import { WebPushService } from './infrastructure/services/WebPushService';

import { PgUserRepository } from './infrastructure/repositories/PgUserRepository';
import { PgProviderRepository } from './infrastructure/repositories/PgProviderRepository';
import { PgTrainingRepository } from './infrastructure/repositories/PgTrainingRepository';
import { PgClientRepository } from './infrastructure/repositories/PgClientRepository';
import { PgInstructorRepository } from './infrastructure/repositories/PgInstructorRepository';
import { PgSessionRepository } from './infrastructure/repositories/PgSessionRepository';
import { PgCalendarRepository } from './infrastructure/repositories/PgCalendarRepository';
import { PgSurveyRepository } from './infrastructure/repositories/PgSurveyRepository';
import { PgReportRepository } from './infrastructure/repositories/PgReportRepository';
import { PgAuditLogRepository } from './infrastructure/repositories/PgAuditLogRepository';
import { PgRoleRepository } from './infrastructure/repositories/PgRoleRepository';
import { PgPushSubscriptionRepository } from './infrastructure/repositories/PgPushSubscriptionRepository';

import { SignupUseCase } from './use-cases/auth/SignupUseCase';
import { LoginUseCase } from './use-cases/auth/LoginUseCase';
import { ListPendingUsersUseCase } from './use-cases/auth/ListPendingUsersUseCase';
import { ApproveUserUseCase } from './use-cases/auth/ApproveUserUseCase';
import { RefreshTokenUseCase } from './use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from './use-cases/auth/LogoutUseCase';
import { ListAllUsersUseCase } from './use-cases/auth/ListAllUsersUseCase';
import { UpdateUserByAdminUseCase } from './use-cases/auth/UpdateUserByAdminUseCase';
import { DeactivateUserUseCase } from './use-cases/auth/DeactivateUserUseCase';
import { UpdateOwnProfileUseCase } from './use-cases/auth/UpdateOwnProfileUseCase';
import { ListRolesUseCase } from './use-cases/auth/ListRolesUseCase';
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

import { CreateSessionUseCase } from './use-cases/sessions/CreateSessionUseCase';
import { ListSessionsUseCase } from './use-cases/sessions/ListSessionsUseCase';
import { AssignInstructorUseCase } from './use-cases/sessions/AssignInstructorUseCase';
import { RespondToAssignmentUseCase } from './use-cases/sessions/RespondToAssignmentUseCase';
import { AddAttendeeUseCase } from './use-cases/sessions/AddAttendeeUseCase';
import { ListSessionAttendeesUseCase } from './use-cases/sessions/ListSessionAttendeesUseCase';
import { UpdateSessionUseCase } from './use-cases/sessions/UpdateSessionUseCase';
import { CancelSessionUseCase } from './use-cases/sessions/CancelSessionUseCase';

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

import authMiddlewareFactory from './interface/middlewares/authMiddleware';
import optionalAuthMiddlewareFactory from './interface/middlewares/optionalAuthMiddleware';
import { setSessionCookies, clearSessionCookies, csrfCheckPasses } from './infrastructure/security/CookieSessionService';
import requireRole from './interface/middlewares/roleMiddleware';
import createRateLimiter from './interface/middlewares/rateLimitMiddleware';
import sanitizeMiddleware from './interface/middlewares/sanitizeMiddleware';

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

function buildApp() {
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService();
  const refreshTokenStore = new RefreshTokenStore({ redisClient: redis });
  const emailService = new EmailService();
  const qrCodeService = new QRCodeService();
  const pdfReportService = new PdfReportService();
  const webPushService = new WebPushService();

  const userRepository = new PgUserRepository(pool);
  const providerRepository = new PgProviderRepository(pool);
  const trainingRepository = new PgTrainingRepository(pool);
  const clientRepository = new PgClientRepository(pool);
  const instructorRepository = new PgInstructorRepository(pool);
  const sessionRepository = new PgSessionRepository(pool);
  const calendarRepository = new PgCalendarRepository(pool);
  const surveyRepository = new PgSurveyRepository(pool);
  const reportRepository = new PgReportRepository(pool);
  const auditLogRepository = new PgAuditLogRepository(pool);
  const roleRepository = new PgRoleRepository(prismaClient);
  const pushSubscriptionRepository = new PgPushSubscriptionRepository(pool);

  const signupUseCase = new SignupUseCase({
    userRepository,
    instructorRepository,
    passwordHasher,
    emailService,
    auditLogRepository,
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
  const updateUserByAdminUseCase = new UpdateUserByAdminUseCase({ userRepository, auditLogRepository });
  const deactivateUserUseCase = new DeactivateUserUseCase({ userRepository, auditLogRepository, refreshTokenStore });
  const updateOwnProfileUseCase = new UpdateOwnProfileUseCase({ userRepository, auditLogRepository });
  const listRolesUseCase = new ListRolesUseCase({ roleRepository });
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
  const assignInstructorUseCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });
  const respondToAssignmentUseCase = new RespondToAssignmentUseCase({ sessionRepository, instructorRepository });
  const addAttendeeUseCase = new AddAttendeeUseCase({ sessionRepository });
  const listSessionAttendeesUseCase = new ListSessionAttendeesUseCase({ sessionRepository, instructorRepository });
  const updateSessionUseCase = new UpdateSessionUseCase({
    sessionRepository,
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
    updateOwnProfileUseCase,
    tokenService,
    listRolesUseCase,
    setSessionCookies,
    clearSessionCookies,
    csrfCheckPasses,
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
    respondToAssignmentUseCase,
    addAttendeeUseCase,
    listSessionAttendeesUseCase,
    updateSessionUseCase,
    cancelSessionUseCase,
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

  const app = express();
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
    authRoutes({ authController, authMiddleware, optionalAuthMiddleware, requireRole, authLimiter, adminLoginLimiter }),
  );
  app.use('/admin', adminRoutes({ authController, adminController, authMiddleware, requireRole }));
  app.use('/providers', providerRoutes({ providerController, authMiddleware, requireRole }));
  app.use('/trainings', trainingRoutes({ trainingController, authMiddleware, requireRole }));
  app.use('/clients', clientRoutes({ clientController, authMiddleware, requireRole }));
  app.use('/instructors', instructorRoutes({ instructorController, authMiddleware, requireRole }));
  app.use('/sessions', sessionRoutes({ sessionController, authMiddleware, requireRole }));
  app.use('/calendar', calendarRoutes({ calendarController, authMiddleware, requireRole }));
  app.use('/reports', reportRoutes({ reportController, authMiddleware, requireRole }));
  app.use('/survey', surveyRoutes({ surveyController, authMiddleware, requireRole }));
  app.use('/push', pushRoutes({ pushController, authMiddleware }));

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const reportScheduler = new ReportSchedulerService({ sessionRepository, generateReportUseCase });

  return { app, reportScheduler };
}

export { buildApp };
