import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

class CreateGroupConversationUseCase {
  conversationRepository: any;
  userRepository: any;
  messagingRealtime: any;

  constructor({ conversationRepository, userRepository, messagingRealtime = null }) {
    this.conversationRepository = conversationRepository;
    this.userRepository = userRepository;
    this.messagingRealtime = messagingRealtime;
  }

  async execute({ requester, name, memberUserIds }: { requester: any; name: any; memberUserIds: any[] }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!requester.isManager()) {
      throw new Error('Only a Manager can create a group');
    }
    if (!name || !name.trim()) {
      throw new Error('Group name is required');
    }

    const uniqueMemberIds = [...new Set((memberUserIds || []).map(Number))].filter((id) => id !== Number(requester.id));
    if (uniqueMemberIds.length === 0) {
      throw new Error('At least one member is required to create a group');
    }

    for (const memberId of uniqueMemberIds) {
      const member = await this.userRepository.findById(memberId);
      if (!member || !member.isApproved()) {
        throw new Error('One of the invited members was not found');
      }
      if (member.isSuperAdmin() || !MESSAGING_ALLOWED_ROLES.includes(member.roleName)) {
        throw new Error('One of the invited members cannot be added to messaging');
      }
    }

    const conversation = await this.conversationRepository.createGroup({
      createdBy: requester.id,
      name: name.trim(),
      memberUserIds: uniqueMemberIds,
    });

    this.messagingRealtime?.notifyGroupCreated(conversation, requester.id).catch((err) => {
      console.error('[CreateGroupConversation] Failed to notify members in real time:', err.message);
    });

    return conversation;
  }
}

export { CreateGroupConversationUseCase };
