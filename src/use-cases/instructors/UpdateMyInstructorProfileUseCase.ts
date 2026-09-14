class UpdateMyInstructorProfileUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, bio, skills }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor can update their own profile');
    }

    const profile = await this.instructorRepository.findByUserId(requester.id);
    if (!profile) throw new Error('Instructor profile not found');

    if (bio !== undefined) {
      await this.instructorRepository.updateBio(profile.id, bio);
    }
    if (Array.isArray(skills)) {
      if (skills.some((skill) => !skill || !Number.isFinite(Number(skill.trainingId)))) {
        throw new Error('Each skill requires a valid trainingId');
      }
      await this.instructorRepository.setSkills(profile.id, skills);
    }

    return this.instructorRepository.findById(profile.id);
  }
}

export { UpdateMyInstructorProfileUseCase };
