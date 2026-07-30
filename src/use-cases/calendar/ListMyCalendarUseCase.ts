class ListMyCalendarUseCase {
  calendarRepository: any;
  instructorRepository: any;

  constructor({ calendarRepository, instructorRepository }) {
    this.calendarRepository = calendarRepository;
    this.instructorRepository = instructorRepository;
  }

  async execute({ requester }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor has a personal calendar');
    }
    const profile = await this.instructorRepository.findByUserId(requester.id);
    if (!profile) return [];
    return this.calendarRepository.listForInstructor(profile.id);
  }
}

export { ListMyCalendarUseCase };
