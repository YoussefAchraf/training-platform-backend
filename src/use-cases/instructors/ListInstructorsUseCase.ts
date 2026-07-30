class ListInstructorsUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute() {
    return this.instructorRepository.listAll();
  }
}

export { ListInstructorsUseCase };
