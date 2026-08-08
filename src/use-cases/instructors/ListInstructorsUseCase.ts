class ListInstructorsUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester }: { requester: any }) {
    return this.instructorRepository.listAll({ includeAllStatuses: requester.isSuperAdmin() });
  }
}

export { ListInstructorsUseCase };
