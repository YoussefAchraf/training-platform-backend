class UpdateInstructorByManagerUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, instructorId, bio, trainingIds }) {
    
    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager can update another instructor profile');
    }

    const profile = await this.instructorRepository.findById(instructorId);
    if (!profile) throw new Error('Instructor not found');

    if (bio !== undefined) {
      await this.instructorRepository.updateBio(instructorId, bio);
    }
    if (Array.isArray(trainingIds)) {
      await this.instructorRepository.setSkills(instructorId, trainingIds);
    }

    return this.instructorRepository.findById(instructorId);
  }
}

export { UpdateInstructorByManagerUseCase };
