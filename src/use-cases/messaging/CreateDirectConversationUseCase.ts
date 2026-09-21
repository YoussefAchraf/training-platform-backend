import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

class CreateDirectConversationUseCase {
  conversationRepository: any;
  userRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, userRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.userRepository = userRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, targetUserId }: { requester: any; targetUserId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }
    if (!targetUserId || Number(targetUserId) === Number(requester.id)) {
      throw new Error('A valid target user is required');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target || !target.isApproved()) {
      throw new Error('Target user not found');
    }
    if (target.isSuperAdmin() || !MESSAGING_ALLOWED_ROLES.includes(target.roleName)) {
      throw new Error('This user cannot be messaged');
    }

    const existing = await this.conversationRepository.findDirectConversationBetween(requester.id, target.id);
    if (existing) {
      return existing;
    }

    const conversation = await this.conversationRepository.createDirect({
      createdBy: requester.id,
      participantUserIds: [requester.id, target.id],
    });

    this.messagingRealtime?.notifyDirectCreated(conversation, requester.id).catch((err) => {
      console.error('[CreateDirectConversation] Failed to notify participants in real time:', err.message);
    });

    return conversation;
  }
}

export { CreateDirectConversationUseCase };
