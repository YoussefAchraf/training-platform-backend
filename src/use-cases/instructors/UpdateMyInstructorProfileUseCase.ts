class UpdateMyInstructorProfileUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, bio, trainingIds }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor can update their own profile');
    }

    const profile = await this.instructorRepository.findByUserId(requester.id);
    if (!profile) throw new Error('Instructor profile not found');

    if (bio !== undefined) {
      await this.instructorRepository.updateBio(profile.id, bio);
    }
    if (Array.isArray(trainingIds)) {
      await this.instructorRepository.setSkills(profile.id, trainingIds);
    }

    return this.instructorRepository.findById(profile.id);
  }
}

export { UpdateMyInstructorProfileUseCase };
