import { Router } from 'express';
import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

export const messagingRoutesDocs: Record<string, any> = {
  '/messaging/directory': {
    get: {
      tags: ['Messaging'],
      summary: 'List people reachable for messaging (Manager/Instructor only, SuperAdmin never included)',
      parameters: [{ name: 'search', in: 'query', required: false, schema: { type: 'string' } }],
      responses: { 200: { description: 'OK' } },
    },
  },
  '/messaging/conversations': {
    get: { tags: ['Messaging'], summary: 'List my conversations, most recent activity first', responses: { 200: { description: 'OK' } } },
  },
  '/messaging/conversations/direct': {
    post: { tags: ['Messaging'], summary: 'Start (or reuse) a 1:1 conversation with another user', responses: { 201: { description: 'Created' } } },
  },
  '/messaging/conversations/group': {
    post: { tags: ['Messaging'], summary: 'Create a group conversation (Manager only)', responses: { 201: { description: 'Created' } } },
  },
  '/messaging/conversations/{id}/participants': {
    post: { tags: ['Messaging'], summary: 'Add a participant to a group (group owner only)', responses: { 201: { description: 'Created' } } },
  },
  '/messaging/conversations/{id}/participants/{userId}': {
    delete: { tags: ['Messaging'], summary: 'Remove a participant from a group (group owner only)', responses: { 204: { description: 'Deleted' } } },
  },
  '/messaging/conversations/{id}/read': {
    post: { tags: ['Messaging'], summary: 'Mark a conversation read up to a given message id', responses: { 200: { description: 'OK' } } },
  },
  '/messaging/conversations/{id}/messages': {
    get: { tags: ['Messaging'], summary: 'List messages in a conversation (keyset paginated)', responses: { 200: { description: 'OK' } } },
    post: {
      tags: ['Messaging'],
      summary: 'Send a message (multipart/form-data with a `file` field for image/voice/file types)',
      responses: { 201: { description: 'Created' } },
    },
  },
  '/messaging/attachments/{messageId}': {
    get: {
      tags: ['Messaging'],
      summary: "Download a message's attachment (participants of that conversation only)",
      parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' } },
    },
  },
  '/messaging/messages/{messageId}/translate': {
    post: {
      tags: ['Messaging'],
      summary: 'Translate a text message into the requesting user\'s language (requires GEMINI_API_KEY)',
      parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' }, 400: { description: 'Not configured, not found, or not a participant' } },
    },
  },
  '/messaging/messages/{messageId}/forward': {
    post: {
      tags: ['Messaging'],
      summary: 'Forward a message to another conversation you are a participant of',
      parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 201: { description: 'Created' } },
    },
  },
};

export default function messagingRoutes({
  conversationsController,
  messagesController,
  messagingDirectoryController,
  attachmentsController,
  uploadMessageAttachment,
  authMiddleware,
  requireRole,
  translateLimiter,
}) {
  const router = Router();
  const requireMessagingRole = requireRole(MESSAGING_ALLOWED_ROLES);

  router.get('/directory', authMiddleware, requireMessagingRole, messagingDirectoryController.list);

  router.get('/conversations', authMiddleware, requireMessagingRole, conversationsController.list);
  router.post('/conversations/direct', authMiddleware, requireMessagingRole, conversationsController.createDirect);
  router.post('/conversations/group', authMiddleware, requireMessagingRole, conversationsController.createGroup);
  router.post('/conversations/:id/participants', authMiddleware, requireMessagingRole, conversationsController.addParticipant);
  router.delete('/conversations/:id/participants/:userId', authMiddleware, requireMessagingRole, conversationsController.removeParticipant);
  router.post('/conversations/:id/read', authMiddleware, requireMessagingRole, conversationsController.markRead);

  router.get('/conversations/:id/messages', authMiddleware, requireMessagingRole, messagesController.list);
  router.post(
    '/conversations/:id/messages',
    authMiddleware,
    requireMessagingRole,
    uploadMessageAttachment,
    messagesController.send,
  );

  router.get('/attachments/:messageId', authMiddleware, requireMessagingRole, attachmentsController.download);

  router.post(
    '/messages/:messageId/translate',
    authMiddleware,
    requireMessagingRole,
    translateLimiter,
    messagesController.translate,
  );
  router.post('/messages/:messageId/forward', authMiddleware, requireMessagingRole, messagesController.forward);

  return router;
}
