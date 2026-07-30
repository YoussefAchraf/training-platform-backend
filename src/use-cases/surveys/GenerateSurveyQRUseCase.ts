class GenerateSurveyQRUseCase {
  sessionRepository: any;
  instructorRepository: any;
  qrCodeService: any;

  constructor({ sessionRepository, instructorRepository, qrCodeService }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
    this.qrCodeService = qrCodeService;
  }

  async execute({ requester, sessionId }) {
    if (!requester.isInstructor()) {
      throw new Error('Only an Instructor can generate a survey QR code');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const instructorProfile = await this.instructorRepository.findByUserId(requester.id);
    if (!instructorProfile || session.instructorId !== instructorProfile.id) {
      throw new Error('You can only generate a survey QR code for your own sessions');
    }

    
    
    
    return this.qrCodeService.generateSurveyQRCode(sessionId);
  }
}

export { GenerateSurveyQRUseCase };
