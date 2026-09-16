import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

class ListConversationsUseCase {
  conversationRepository: any;

  constructor({ conversationRepository }) {
    this.conversationRepository = conversationRepository;
  }

  async execute({ requester }: { requester: any }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }

    return this.conversationRepository.listForUser(requester.id);
  }
}

export { ListConversationsUseCase };
