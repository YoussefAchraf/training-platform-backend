class AssignInstructorUseCase {
  sessionRepository: any;
  instructorRepository: any;
  trainingRepository: any;
  emailService: any;
  webPushService: any;
  pushSubscriptionRepository: any;

  constructor({
    sessionRepository,
    instructorRepository,
    trainingRepository,
    emailService,
    webPushService,
    pushSubscriptionRepository,
  }) {
    this.sessionRepository = sessionRepository;
    this.instructorRepository = instructorRepository;
    this.trainingRepository = trainingRepository;
    this.emailService = emailService;
    this.webPushService = webPushService;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
  }

  async execute({ requester, sessionId, instructorId }) {

    if (!requester.isManager() && !requester.isSuperAdmin()) {
      throw new Error('Only a Manager can assign a training session to an instructor');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    const instructor = await this.instructorRepository.findById(instructorId);
    if (!instructor) throw new Error('Instructor not found');
    if (instructor.status !== 'approved') {
      throw new Error('This instructor is not an active, approved instructor');
    }





    const qualified = await this.instructorRepository.isQualifiedForTraining(instructorId, session.trainingId);
    if (!qualified) {
      throw new Error('This instructor is not marked as qualified for this session\'s training');
    }

    const assigned = await this.sessionRepository.assignInstructor(sessionId, instructorId);

    
    
    
    try {
      await this.notifyInstructor(session, instructor);
    } catch (_err) {
      
    }

    return assigned;
  }

  async notifyInstructor(session, instructor) {
    const training = await this.trainingRepository.findById(session.trainingId);
    
    
    
    
    
    const sessionPath = `/sessions/${session.id}`;
    const sessionUrl = `${process.env.CLIENT_URL}${sessionPath}`;

    try {
      await this.emailService.sendInstructorAssignedEmail(instructor.email, instructor.firstname, {
        trainingName: training ? training.name : 'a training session',
        startDate: session.startDate,
        sessionUrl,
      });
    } catch (_err) {
      
    }

    try {
      const subscriptions = await this.pushSubscriptionRepository.listByUserId(instructor.userId);
      for (const subscription of subscriptions) {
        try {
          await this.webPushService.send(subscription, {
            title: 'New session assigned',
            body: `You've been assigned to teach ${training ? training.name : 'a session'}.`,
            url: sessionPath,
          });
        } catch (err: any) {
          if (err.expired) {
            await this.pushSubscriptionRepository.deleteByEndpointForUser(subscription.endpoint, instructor.userId);
          }
        }
      }
    } catch (_err) {
      
    }
  }
}

export { AssignInstructorUseCase };
