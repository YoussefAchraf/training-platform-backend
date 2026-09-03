class ListMyPendingAnnouncementsUseCase {
  announcementRepository: any;

  constructor({ announcementRepository }) {
    this.announcementRepository = announcementRepository;
  }

  async execute({ requester }: { requester: any }) {
    if (requester.isDeveloper()) {
      return [];
    }

    return this.announcementRepository.listPendingForUser({
      userId: requester.id,
      role: requester.roleName,
      
      
      
      
      joinedAt: requester.createdAt,
    });
  }
}

export { ListMyPendingAnnouncementsUseCase };
