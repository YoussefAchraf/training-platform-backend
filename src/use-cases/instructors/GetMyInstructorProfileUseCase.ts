class GetMyInstructorProfileUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor has an instructor profile');
    }
    const profile = await this.instructorRepository.findByUserId(requester.id);
    if (!profile) throw new Error('Instructor profile not found');
    return profile;
  }
}

export { GetMyInstructorProfileUseCase };
