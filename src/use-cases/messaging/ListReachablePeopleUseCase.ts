import { MESSAGING_ALLOWED_ROLES } from '../../domain/constants/messagingRoles';

class ListReachablePeopleUseCase {
  conversationRepository: any;

  constructor({ conversationRepository }) {
    this.conversationRepository = conversationRepository;
  }

  async execute({ requester, search }: { requester: any; search?: string }) {
    if (requester.isSuperAdmin()) {
      throw new Error('SuperAdmin cannot access messaging');
    }
    if (!MESSAGING_ALLOWED_ROLES.includes(requester.roleName)) {
      throw new Error('Only Manager and Instructor can use messaging');
    }

    return this.conversationRepository.listReachablePeople({
      excludeUserId: requester.id,
      roleNames: MESSAGING_ALLOWED_ROLES,
      search,
    });
  }
}

export { ListReachablePeopleUseCase };
