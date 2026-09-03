class ListFeatureAnnouncementsUseCase {
  announcementRepository: any;

  constructor({ announcementRepository }) {
    this.announcementRepository = announcementRepository;
  }

  async execute({ requester }: { requester: any }) {
    if (!requester.isDeveloper()) {
      throw new Error('Only Developer can view feature announcement ratings');
    }

    return this.announcementRepository.listAllWithRatings();
  }
}

export { ListFeatureAnnouncementsUseCase };
