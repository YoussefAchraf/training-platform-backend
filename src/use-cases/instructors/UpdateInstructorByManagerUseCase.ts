class UpdateInstructorByManagerUseCase {
  instructorRepository: any;

  constructor({ instructorRepository }) {
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester, instructorId, bio, skills }: { requester: any; instructorId: any; bio?: any; skills?: any }) {
    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager can update another instructor profile');
    }

    const profile = await this.instructorRepository.findById(instructorId);
    if (!profile) throw new Error('Instructor not found');

    if (bio !== undefined) {
      await this.instructorRepository.updateBio(instructorId, bio);
    }
    if (Array.isArray(skills)) {
      if (skills.some((skill) => !skill || !Number.isFinite(Number(skill.trainingId)))) {
        throw new Error('Each skill requires a valid trainingId');
      }
      await this.instructorRepository.setSkills(instructorId, skills);
    }

    return this.instructorRepository.findById(instructorId);
  }
}

export { UpdateInstructorByManagerUseCase };
