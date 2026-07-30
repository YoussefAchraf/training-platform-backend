import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { pool } from './infrastructure/database/connection';
import { redis } from './infrastructure/cache/RedisClient';
import { swaggerSpec } from './docs/swaggerDefinition';

import { PasswordHasher } from './infrastructure/security/PasswordHasher';
import { TokenService } from './infrastructure/security/TokenService';
import { RefreshTokenStore } from './infrastructure/security/RefreshTokenStore';

import { EmailService } from './infrastructure/services/EmailService';
import { ReportSchedulerService } from './infrastructure/services/ReportSchedulerService';
import { QRCodeService } from './infrastructure/services/QRCodeService';

import { PgUserRepository } from './infrastructure/repositories/PgUserRepository';
import { PgProviderRepository } from './infrastructure/repositories/PgProviderRepository';
import { PgTrainingRepository } from './infrastructure/repositories/PgTrainingRepository';
import { PgClientRepository } from './infrastructure/repositories/PgClientRepository';
import { PgInstructorRepository } from './infrastructure/repositories/PgInstructorRepository';
import { PgSessionRepository } from './infrastructure/repositories/PgSessionRepository';
import { PgCalendarRepository } from './infrastructure/repositories/PgCalendarRepository';
import { PgSurveyRepository } from './infrastructure/repositories/PgSurveyRepository';
import { PgReportRepository } from './infrastructure/repositories/PgReportRepository';

import { SignupUseCase } from './use-cases/auth/SignupUseCase';
import { LoginUseCase } from './use-cases/auth/LoginUseCase';
import { ListPendingUsersUseCase } from './use-cases/auth/ListPendingUsersUseCase';
import { ApproveUserUseCase } from './use-cases/auth/ApproveUserUseCase';
import { RefreshTokenUseCase } from './use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from './use-cases/auth/LogoutUseCase';

import { CreateProviderUseCase } from './use-cases/providers/CreateProviderUseCase';
import { ListProvidersUseCase } from './use-cases/providers/ListProvidersUseCase';
import { CreateTrainingUseCase } from './use-cases/trainings/CreateTrainingUseCase';
import { ListTrainingsUseCase } from './use-cases/trainings/ListTrainingsUseCase';
import { CreateClientUseCase } from './use-cases/clients/CreateClientUseCase';
import { ListClientsUseCase } from './use-cases/clients/ListClientsUseCase';

import { ListInstructorsUseCase } from './use-cases/instructors/ListInstructorsUseCase';
import { GetMyInstructorProfileUseCase } from './use-cases/instructors/GetMyInstructorProfileUseCase';
import { UpdateMyInstructorProfileUseCase } from './use-cases/instructors/UpdateMyInstructorProfileUseCase';
import { UpdateInstructorByManagerUseCase } from './use-cases/instructors/UpdateInstructorByManagerUseCase';

import { CreateSessionUseCase } from './use-cases/sessions/CreateSessionUseCase';
import { ListSessionsUseCase } from './use-cases/sessions/ListSessionsUseCase';
import { AssignInstructorUseCase } from './use-cases/sessions/AssignInstructorUseCase';
import { RespondToAssignmentUseCase } from './use-cases/sessions/RespondToAssignmentUseCase';
import { AddAttendeeUseCase } from './use-cases/sessions/AddAttendeeUseCase';

import {
  ListGlobalCalendarUseCase,
  UpdateGlobalCalendarUseCase,
  DeleteGlobalCalendarEventUseCase,
} from './use-cases/calendar/GlobalCalendarUseCases';
import { ListMyCalendarUseCase } from './use-cases/calendar/ListMyCalendarUseCase';

import { GenerateReportUseCase } from './use-cases/reports/GenerateReportUseCase';
import { GetReportUseCase } from './use-cases/reports/GetReportUseCase';
import { GenerateSurveyQRUseCase } from './use-cases/surveys/GenerateSurveyQRUseCase';
import { GetSurveySessionInfoUseCase } from './use-cases/surveys/GetSurveySessionInfoUseCase';
import { SubmitSurveyUseCase } from './use-cases/surveys/SubmitSurveyUseCase';

import { AuthController } from './interface/controllers/AuthController';
import { ProviderController } from './interface/controllers/ProviderController';
import { TrainingController } from './interface/controllers/TrainingController';
import { ClientController } from './interface/controllers/ClientController';
import { InstructorController } from './interface/controllers/InstructorController';
import { SessionController } from './interface/controllers/SessionController';
import { CalendarController } from './interface/controllers/CalendarController';
import { ReportController } from './interface/controllers/ReportController';
import { SurveyController } from './interface/controllers/SurveyController';

import authMiddlewareFactory from './interface/middlewares/authMiddleware';
import requireRole from './interface/middlewares/roleMiddleware';
import createRateLimiter from './interface/middlewares/rateLimitMiddleware';

import authRoutes from './interface/routes/authRoutes';
import providerRoutes from './interface/routes/providerRoutes';
import trainingRoutes from './interface/routes/trainingRoutes';
import clientRoutes from './interface/routes/clientRoutes';
import instructorRoutes from './interface/routes/instructorRoutes';
import sessionRoutes from './interface/routes/sessionRoutes';
import calendarRoutes from './interface/routes/calendarRoutes';
import reportRoutes from './interface/routes/reportRoutes';
import surveyRoutes from './interface/routes/surveyRoutes';

function buildApp() {
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService();
  const refreshTokenStore = new RefreshTokenStore({ redisClient: redis });
  const emailService = new EmailService();
  const qrCodeService = new QRCodeService();

  const userRepository = new PgUserRepository(pool);
  const providerRepository = new PgProviderRepository(pool);
  const trainingRepository = new PgTrainingRepository(pool);
  const clientRepository = new PgClientRepository(pool);
  const instructorRepository = new PgInstructorRepository(pool);
  const sessionRepository = new PgSessionRepository(pool);
  const calendarRepository = new PgCalendarRepository(pool);
  const surveyRepository = new PgSurveyRepository(pool);
  const reportRepository = new PgReportRepository(pool);

  const signupUseCase = new SignupUseCase({ userRepository, instructorRepository, passwordHasher, emailService });
  const loginUseCase = new LoginUseCase({ userRepository, passwordHasher, tokenService, refreshTokenStore });
  const listPendingUsersUseCase = new ListPendingUsersUseCase({ userRepository });
  const approveUserUseCase = new ApproveUserUseCase({ userRepository, emailService, refreshTokenStore });
  const refreshTokenUseCase = new RefreshTokenUseCase({ userRepository, tokenService, refreshTokenStore });
  const logoutUseCase = new LogoutUseCase({ refreshTokenStore });

  const createProviderUseCase = new CreateProviderUseCase({ providerRepository });
  const listProvidersUseCase = new ListProvidersUseCase({ providerRepository });
  const createTrainingUseCase = new CreateTrainingUseCase({ trainingRepository, providerRepository });
  const listTrainingsUseCase = new ListTrainingsUseCase({ trainingRepository });
  const createClientUseCase = new CreateClientUseCase({ clientRepository });
  const listClientsUseCase = new ListClientsUseCase({ clientRepository });

  const listInstructorsUseCase = new ListInstructorsUseCase({ instructorRepository });
  const getMyInstructorProfileUseCase = new GetMyInstructorProfileUseCase({ instructorRepository });
  const updateMyInstructorProfileUseCase = new UpdateMyInstructorProfileUseCase({ instructorRepository });
  const updateInstructorByManagerUseCase = new UpdateInstructorByManagerUseCase({ instructorRepository });

  const createSessionUseCase = new CreateSessionUseCase({
    sessionRepository,
    trainingRepository,
    clientRepository,
    calendarRepository,
  });
  const listSessionsUseCase = new ListSessionsUseCase({ sessionRepository, instructorRepository });
  const assignInstructorUseCase = new AssignInstructorUseCase({ sessionRepository, instructorRepository });
  const respondToAssignmentUseCase = new RespondToAssignmentUseCase({ sessionRepository, instructorRepository });
  const addAttendeeUseCase = new AddAttendeeUseCase({ sessionRepository });

  const listGlobalCalendarUseCase = new ListGlobalCalendarUseCase({ calendarRepository });
  const updateGlobalCalendarUseCase = new UpdateGlobalCalendarUseCase({ calendarRepository });
  const deleteGlobalCalendarEventUseCase = new DeleteGlobalCalendarEventUseCase({ calendarRepository });
  const listMyCalendarUseCase = new ListMyCalendarUseCase({ calendarRepository, instructorRepository });

  const generateReportUseCase = new GenerateReportUseCase({ sessionRepository, surveyRepository, reportRepository });
  const getReportUseCase = new GetReportUseCase({ reportRepository });
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

  const authController = new AuthController({
    signupUseCase,
    loginUseCase,
    listPendingUsersUseCase,
    approveUserUseCase,
    refreshTokenUseCase,
    logoutUseCase,
  });
  const providerController = new ProviderController({ createProviderUseCase, listProvidersUseCase });
  const trainingController = new TrainingController({ createTrainingUseCase, listTrainingsUseCase });
  const clientController = new ClientController({ createClientUseCase, listClientsUseCase });
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
  });
  const calendarController = new CalendarController({
    listGlobalCalendarUseCase,
    updateGlobalCalendarUseCase,
    deleteGlobalCalendarEventUseCase,
    listMyCalendarUseCase,
  });
  const reportController = new ReportController({ getReportUseCase, generateReportUseCase });
  const surveyController = new SurveyController({
    generateSurveyQRUseCase,
    getSurveySessionInfoUseCase,
    submitSurveyUseCase,
  });

  const authMiddleware = authMiddlewareFactory({ tokenService, userRepository });

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

  const app = express();
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
  app.use(express.json());
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/auth', authRoutes({ authController, authMiddleware, requireRole, authLimiter }));
  app.use('/providers', providerRoutes({ providerController, authMiddleware, requireRole }));
  app.use('/trainings', trainingRoutes({ trainingController, authMiddleware, requireRole }));
  app.use('/clients', clientRoutes({ clientController, authMiddleware, requireRole }));
  app.use('/instructors', instructorRoutes({ instructorController, authMiddleware, requireRole }));
  app.use('/sessions', sessionRoutes({ sessionController, authMiddleware, requireRole }));
  app.use('/calendar', calendarRoutes({ calendarController, authMiddleware, requireRole }));
  app.use('/reports', reportRoutes({ reportController, authMiddleware, requireRole }));
  app.use('/survey', surveyRoutes({ surveyController, authMiddleware, requireRole }));

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const reportScheduler = new ReportSchedulerService({ sessionRepository, generateReportUseCase });

  return { app, reportScheduler };
}

export { buildApp };
