class ListRolesUseCase {
  roleRepository: any;

  constructor({ roleRepository }) {
    this.roleRepository = roleRepository;
  }

  async execute() {
    return this.roleRepository.listAll();
  }
}

export { ListRolesUseCase };
