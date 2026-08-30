import { Router } from 'express';

export const sessionRoutesDocs: Record<string, any> = {
  '/sessions': {
    get: {
      tags: ['Sessions'],
      summary: 'List training sessions',
      description: 'Sales/Manager see every session; an Instructor sees only sessions assigned to them.',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/TrainingSession' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Sessions'],
      summary: 'Create a training session',
      description:
        'Sales, Manager, or SuperAdmin only. Also creates the matching global calendar entry. includeWeekends (default false) is only meaningful for a multi-day session - it records whether Saturday/Sunday count as real training days, so the calendar can correctly show the session as occupying (or skipping) those days.\n',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['trainingId', 'clientId', 'startDate', 'endDate'],
              properties: {
                trainingId: { type: 'integer' },
                clientId: { type: 'integer' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                includeWeekends: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description: 'Validation error, or endDate not after startDate',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales, Manager, or SuperAdmin' },
      },
    },
  },
  '/sessions/{id}': {
    patch: {
      tags: ['Sessions'],
      summary: 'Update a training session (dates only)',
      description:
        'Sales or Manager only, and only for a session you created (SuperAdmin can update any). Rejected once the session already has a survey or report attached.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description:
            'Session not found, not the creator, endDate not after startDate, or the session already has a survey/report',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}/cancel': {
    post: {
      tags: ['Sessions'],
      summary: 'Cancel a training session',
      description:
        'Sales or Manager only, and only for a session you created (SuperAdmin can cancel any). Rejected if already cancelled, or if the session already has a survey or report attached.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description:
            'Session not found, not the creator, already cancelled, or the session already has a survey/report',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}/assign-instructor': {
    post: {
      tags: ['Sessions'],
      summary: 'Assign a session to an instructor',
      description:
        'Manager only (Sales cannot). The session must already have at least one attendee. Assignment is immediate and final (assignmentStatus is set straight to "accepted" - there is no accept/refuse step). Rejected if the instructor is already assigned to a different session at the exact same start time (a different start time on the same day is fine).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['instructorId'], properties: { instructorId: { type: 'integer' } } },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingSession' } } } },
        400: {
          description:
            'No attendees yet, instructor not found/not approved/not qualified, or already engaged in another session at the same start time',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not a Manager' },
      },
    },
  },
  '/sessions/{id}/attendees': {
    post: {
      tags: ['Sessions'],
      summary: 'Add an attendee to a session',
      description: 'Sales or Manager only.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' }, email: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionAttendee' } } } },
        403: { description: 'Not Sales or Manager' },
      },
    },
    get: {
      tags: ['Sessions'],
      summary: "List a session's attendees",
      description: 'Sales/Manager can view any session\'s attendees; an Instructor can only view attendees of a session assigned to them.\n',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/SessionAttendee' } },
            },
          },
        },



        400: { description: "Not allowed to view this session's attendees, or the session does not exist" },
      },
    },
  },
  '/sessions/{id}/attendees/import': {
    post: {
      tags: ['Sessions'],
      summary: 'Bulk-import attendees from a spreadsheet',
      description:
        'Sales or Manager only. Upload a .xlsx or .csv file with a header row containing a "Name" column and an optional "Email" column. Rows are imported best-effort: a row is skipped (with a reason) rather than failing the whole file if the name is missing, the email is invalid, the email is duplicated within the file, or the attendee is already registered in a different session that overlaps this one in time.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
          },
        },
      },
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  importedCount: { type: 'integer' },
                  skippedCount: { type: 'integer' },
                  attendees: { type: 'array', items: { $ref: '#/components/schemas/SessionAttendee' } },
                  skipped: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        row: { type: 'integer' },
                        name: { type: 'string', nullable: true },
                        email: { type: 'string', nullable: true },
                        reason: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'No file uploaded, unsupported file type, unreadable file, or session does not exist',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
  '/sessions/{id}/attendees/{attendeeId}/attendance': {
    patch: {
      tags: ['Sessions'],
      summary: "Mark an attendee's attendance",
      description: "Only the session's assigned Instructor can mark an attendee Present or Absent.",
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'attendeeId', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['present', 'absent'] } } },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionAttendee' } } } },
        400: {
          description: 'Invalid status, session/attendee not found, or attendee does not belong to this session',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not the assigned Instructor' },
      },
    },
  },
  '/sessions/{id}/attendees/{attendeeId}': {
    patch: {
      tags: ['Sessions'],
      summary: "Edit an attendee's name/email",
      description:
        "Sales or Manager only. Locked once the session's attendance has started being marked - callers should stop offering this once any attendee on the session has a non-pending attendanceStatus, though the backend itself doesn't separately enforce that (there's nothing wrong with fixing a typo after the fact via the API).\n",
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'attendeeId', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' }, email: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionAttendee' } } } },
        400: {
          description: 'Invalid name/email, session/attendee not found, attendee does not belong to this session, or the new email overlaps another session',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        403: { description: 'Not Sales or Manager' },
      },
    },
  },
};

export default function sessionRoutes({ sessionController, authMiddleware, requireRole, uploadAttendeesFile }) {
  const router = Router();

  router.get('/', authMiddleware, sessionController.list);
  router.post('/', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.create);
  router.patch('/:id', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.update);
  router.post('/:id/cancel', authMiddleware, requireRole(['Sales', 'Manager']), sessionController.cancel);

  router.post(
    '/:id/assign-instructor',
    authMiddleware,
    requireRole(['Manager']),
    sessionController.assignInstructor
  );

  router.post(
    '/:id/attendees',
    authMiddleware,
    requireRole(['Sales', 'Manager']),
    sessionController.addAttendee
  );



  router.get('/:id/attendees', authMiddleware, sessionController.listAttendees);

  router.post(
    '/:id/attendees/import',
    authMiddleware,
    requireRole(['Sales', 'Manager']),
    uploadAttendeesFile,
    sessionController.importAttendees
  );

  router.patch(
    '/:id/attendees/:attendeeId/attendance',
    authMiddleware,
    requireRole(['Sales', 'Manager', 'Instructor']),
    sessionController.markAttendance
  );

  router.patch(
    '/:id/attendees/:attendeeId',
    authMiddleware,
    requireRole(['Sales', 'Manager']),
    sessionController.updateAttendee
  );

  return router;
};
