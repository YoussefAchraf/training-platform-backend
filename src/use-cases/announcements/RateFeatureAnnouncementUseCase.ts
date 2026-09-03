class RateFeatureAnnouncementUseCase {
  announcementRepository: any;

  constructor({ announcementRepository }) {
    this.announcementRepository = announcementRepository;
  }

  async execute({ requester, announcementId, stars }: { requester: any; announcementId: any; stars: any }) {
    if (requester.isDeveloper()) {
      throw new Error('Developer accounts cannot rate feature announcements');
    }

    const parsedStars = Number(stars);
    if (!Number.isInteger(parsedStars) || parsedStars < 1 || parsedStars > 5) {
      throw new Error('stars must be an integer between 1 and 5');
    }

    const announcement = await this.announcementRepository.findById(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (!announcement.targetRoles.includes(requester.roleName)) {
      throw new Error('This announcement was not targeted at your role');
    }

    await this.announcementRepository.rate({
      announcementId,
      userId: requester.id,
      stars: parsedStars,
    });

    return { message: 'Rating recorded.' };
  }
}

export { RateFeatureAnnouncementUseCase };
