class GetAdminSessionsOverviewUseCase {
  sessionRepository: any;

  constructor({ sessionRepository }) {
    this.sessionRepository = sessionRepository;
  }

  async execute({ requester }) {
    if (!requester.isSuperAdmin()) {
      throw new Error('Only a SuperAdmin can view the sessions overview');
    }

    return this.sessionRepository.listAllWithDetails();
  }
}

export { GetAdminSessionsOverviewUseCase };
