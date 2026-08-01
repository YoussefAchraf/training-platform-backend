class ListPendingUsersUseCase {
  userRepository: any;

  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ managerUser }) {
    if (!managerUser.isManager() && !managerUser.isSuperAdmin()) {
      throw new Error('Only a Manager can view pending account requests');
    }
    const pending = await this.userRepository.listPending();
    return pending.map((u) => u.toSafeJSON());
  }
}

export { ListPendingUsersUseCase };
