import { authRoutesDocs } from '../interface/routes/authRoutes';
import { calendarRoutesDocs } from '../interface/routes/calendarRoutes';
import { clientRoutesDocs } from '../interface/routes/clientRoutes';
import { instructorRoutesDocs } from '../interface/routes/instructorRoutes';
import { providerRoutesDocs } from '../interface/routes/providerRoutes';
import { reportRoutesDocs } from '../interface/routes/reportRoutes';
import { sessionRoutesDocs } from '../interface/routes/sessionRoutes';
import { surveyRoutesDocs } from '../interface/routes/surveyRoutes';
import { trainingRoutesDocs } from '../interface/routes/trainingRoutes';

const paths = {
  ...authRoutesDocs,
  ...calendarRoutesDocs,
  ...clientRoutesDocs,
  ...instructorRoutesDocs,
  ...providerRoutesDocs,
  ...reportRoutesDocs,
  ...sessionRoutesDocs,
  ...surveyRoutesDocs,
  ...trainingRoutesDocs,
};

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
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description:
          'httpOnly session cookie set by /auth/login, /auth/admin-login, or /auth/refresh. Not readable/settable ' +
          'from JavaScript or from this UI - authenticate via a real browser session with the API running behind ' +
          'the configured CLIENT_URL origin.',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'For non-browser, server-to-server callers only (e.g. the n8n chatbot, which obtains one via ' +
          'GET /auth/service-token and forwards it on every call it makes on a user\'s behalf) - the browser ' +
          'frontend uses cookieAuth instead. Not subject to the CSRF check below, since a Bearer header is never ' +
          'attached automatically by a browser to a cross-site request the way a cookie is.',
      },
      csrfHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description:
          'Required on POST/PUT/PATCH/DELETE. Value must match the non-httpOnly csrfToken cookie set alongside ' +
          'the session (double-submit pattern).',
      },
    },
    parameters: {
      CsrfHeader: {
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        description: 'Must match the non-httpOnly csrfToken cookie set at login (double-submit pattern).',
        schema: { type: 'string' },
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
          roleId: {
            type: 'integer',
            example: 2,
            description: 'FK into the roles table. The role name itself is intentionally not exposed here.',
          },
          status: { $ref: '#/components/schemas/UserStatus' },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Red Hat' },
          description: { type: 'string', nullable: true, example: 'Enterprise Linux' },
          logoUrl: { type: 'string', nullable: true, example: 'https://example.com/redhat-logo.svg' },
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
          npsAverage: {
            type: 'string',
            description: 'Net Promoter Score, as a percentage from -100 to 100 (%promoters - %detractors).',
            example: '42.00',
          },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths,
};

const swaggerSpec = definition;

export { swaggerSpec };
