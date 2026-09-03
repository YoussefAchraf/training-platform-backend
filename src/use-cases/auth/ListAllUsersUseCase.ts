class ListAllUsersUseCase {
  userRepository: any;

  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ requester }) {
    if (!requester.isSuperAdmin()) {
      throw new Error('Only a SuperAdmin can view all users');
    }

    const users = await this.userRepository.listAll();
    
    
    
    
    return users.filter((u) => !u.isDeveloper()).map((u) => u.toSafeJSON());
  }
}

export { ListAllUsersUseCase };
