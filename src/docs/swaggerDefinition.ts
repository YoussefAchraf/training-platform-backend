import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const pathsDir = path.join(__dirname, 'paths');
const paths = fs.readdirSync(pathsDir).reduce((acc, file) => {
  const parsed = YAML.parse(fs.readFileSync(path.join(pathsDir, file), 'utf8'));
  return { ...acc, ...parsed };
}, {});

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Training Platform API',
    version: '1.0.0',
    description:
      'Backend for training management platform (providers, trainings, sessions, instructors, surveys, reports). ' +
      'Clean architecture: interface (controllers/routes) -> use-cases -> domain <- infrastructure.',
  },
  servers: [
    { url: 'http://localhost:{port}', description: 'Local', variables: { port: { default: '4000' } } },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Providers' },
    { name: 'Trainings' },
    { name: 'Clients' },
    { name: 'Sessions' },
    { name: 'Instructors' },
    { name: 'Calendar' },
    { name: 'Survey' },
    { name: 'Reports' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by /auth/login or /auth/refresh.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Invalid credentials' } },
      },
      Role: { type: 'string', enum: ['Sales', 'Manager', 'Instructor'] },
      UserStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          firstname: { type: 'string', example: 'Jane' },
          lastname: { type: 'string', example: 'Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          role: { $ref: '#/components/schemas/Role' },
          status: { $ref: '#/components/schemas/UserStatus' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'Short-lived JWT, JWT_EXPIRES_IN (default 8h).' },
          refreshToken: {
            type: 'string',
            description: 'Opaque, Redis-backed, revocable token, REFRESH_TOKEN_TTL_DAYS (default 30d). Rotated on every /auth/refresh call.',
          },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Red Hat' },
          description: { type: 'string', nullable: true, example: 'Enterprise Linux' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Training: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'RHCSA' },
          providerId: { type: 'integer', example: 1 },
          providerName: { type: 'string', example: 'Red Hat' },
          description: { type: 'string', nullable: true },
          duration: { type: 'integer', nullable: true, description: 'In hours or days, kept generic.' },
          createdBy: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Client: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          companyName: { type: 'string', example: 'Acme Corp' },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          createdBy: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SessionStatus: { type: 'string', enum: ['scheduled', 'ongoing', 'completed', 'cancelled'] },
      AssignmentStatus: { type: 'string', enum: ['unassigned', 'pending', 'accepted', 'refused'] },
      TrainingSession: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          trainingId: { type: 'integer' },
          clientId: { type: 'integer' },
          instructorId: { type: 'integer', nullable: true },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          sessionStatus: { $ref: '#/components/schemas/SessionStatus' },
          assignmentStatus: { $ref: '#/components/schemas/AssignmentStatus' },
          createdBy: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SessionAttendee: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sessionId: { type: 'integer' },
          name: { type: 'string', example: 'Alice Attendee' },
          email: { type: 'string', nullable: true },
          surveySubmitted: { type: 'boolean' },
        },
      },
      InstructorSkill: {
        type: 'object',
        properties: {
          trainingId: { type: 'integer' },
          trainingName: { type: 'string' },
        },
      },
      Instructor: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer' },
          bio: { type: 'string', nullable: true },
          firstname: { type: 'string' },
          lastname: { type: 'string' },
          email: { type: 'string' },
          skills: { type: 'array', items: { $ref: '#/components/schemas/InstructorSkill' } },
        },
      },
      CalendarEvent: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sessionId: { type: 'integer' },
          eventDate: { type: 'string', format: 'date-time' },
          title: { type: 'string', example: 'RHCSA - Acme Corp' },
        },
      },
      SurveyQR: {
        type: 'object',
        properties: {
          surveyUrl: { type: 'string', example: 'http://localhost:3000/survey/1' },
          qrCodeDataUrl: {
            type: 'string',
            description: 'PNG QR code as a data URL - drop straight into an <img src>.',
            example: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
          },
        },
      },
      SurveyInfo: {
        type: 'object',
        properties: {
          sessionId: { type: 'integer' },
          trainingName: { type: 'string', nullable: true },
          instructorName: { type: 'string', nullable: true },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
      },
      Survey: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sessionId: { type: 'integer' },
          instructorId: { type: 'integer', description: 'Filled server-side from the session - not client-supplied.' },
          attendeeId: { type: 'integer', nullable: true },
          instructorScore: { type: 'integer', minimum: 0, maximum: 5, example: 4 },
          npsScore: { type: 'integer', minimum: 0, maximum: 10, description: 'NPS/global score.', example: 9 },
          comments: { type: 'string', nullable: true },
          submittedAt: { type: 'string', format: 'date-time' },
        },
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sessionId: { type: 'integer' },
          pdfUrl: { type: 'string', nullable: true, description: 'Not yet implemented - always null today.' },
          averageScore: { type: 'string', example: '4.00' },
          npsAverage: { type: 'string', example: '9.00' },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths,
};

const swaggerSpec = definition;

export { swaggerSpec };
