import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

class AddParticipantUseCase {
  conversationRepository: any;
  userRepository: any;

  constructor({ conversationRepository, userRepository }) {
    this.conversationRepository = conversationRepository;
    this.userRepository = userRepository;
  }

  async execute({ requester, conversationId, userId }: { requester: any; conversationId: any; userId: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!requester.isManager()) {
      throw new Error('Only a Manager can add a participant');
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== 'group') {
      throw new Error('Group not found');
    }
    const requesterParticipant = conversation.participants.find((p) => Number(p.userId) === Number(requester.id));
    if (!requesterParticipant || requesterParticipant.role !== 'owner') {
      throw new Error('Only the group owner can add a participant');
    }

    const target = await this.userRepository.findById(userId);
    if (!target || !target.isApproved()) {
      throw new Error('Target user not found');
    }
    if (target.isSuperAdmin() || !MESSAGING_ALLOWED_ROLES.includes(target.roleName)) {
      throw new Error('This user cannot be added to messaging');
    }
    if (conversation.participants.some((p) => Number(p.userId) === Number(target.id))) {
      throw new Error('This user is already in the group');
    }

    return this.conversationRepository.addParticipant(conversationId, target.id, 'member');
  }
}

export { AddParticipantUseCase };
