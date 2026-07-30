import express from 'express';
import cors from 'cors';
import { pool } from './infrastructure/database/connection';
import { redis } from './infrastructure/cache/RedisClient';

import { PasswordHasher } from './infrastructure/security/PasswordHasher';
import { TokenService } from './infrastructure/security/TokenService';
import { RefreshTokenStore } from './infrastructure/security/RefreshTokenStore';

import { EmailService } from './infrastructure/services/EmailService';

import { PgUserRepository } from './infrastructure/repositories/PgUserRepository';
import { PgProviderRepository } from './infrastructure/repositories/PgProviderRepository';
import { PgTrainingRepository } from './infrastructure/repositories/PgTrainingRepository';
import { PgClientRepository } from './infrastructure/repositories/PgClientRepository';

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

import { AuthController } from './interface/controllers/AuthController';
import { ProviderController } from './interface/controllers/ProviderController';
import { TrainingController } from './interface/controllers/TrainingController';
import { ClientController } from './interface/controllers/ClientController';

import authMiddlewareFactory from './interface/middlewares/authMiddleware';
import requireRole from './interface/middlewares/roleMiddleware';
import createRateLimiter from './interface/middlewares/rateLimitMiddleware';

import authRoutes from './interface/routes/authRoutes';
import providerRoutes from './interface/routes/providerRoutes';
import trainingRoutes from './interface/routes/trainingRoutes';
import clientRoutes from './interface/routes/clientRoutes';

function buildApp() {
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService();
  const refreshTokenStore = new RefreshTokenStore({ redisClient: redis });
  const emailService = new EmailService();

  const userRepository = new PgUserRepository(pool);
  const providerRepository = new PgProviderRepository(pool);
  const trainingRepository = new PgTrainingRepository(pool);
  const clientRepository = new PgClientRepository(pool);

  const signupUseCase = new SignupUseCase({
    userRepository,
    instructorRepository: undefined,
    passwordHasher,
    emailService,
  });
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

  app.use('/auth', authRoutes({ authController, authMiddleware, requireRole, authLimiter }));
  app.use('/providers', providerRoutes({ providerController, authMiddleware, requireRole }));
  app.use('/trainings', trainingRoutes({ trainingController, authMiddleware, requireRole }));
  app.use('/clients', clientRoutes({ clientController, authMiddleware, requireRole }));

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app };
}

export { buildApp };
