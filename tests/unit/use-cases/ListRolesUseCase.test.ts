import { ListRolesUseCase } from '../../../src/use-cases/auth/ListRolesUseCase';

describe('ListRolesUseCase', () => {
  it('returns whatever the repository reports, without assuming fixed ids', async () => {
    const roles = [
      { id: 1, name: 'Sales' },
      { id: 2, name: 'Manager' },
      { id: 3, name: 'Instructor' },
      { id: 7, name: 'SuperAdmin' },
    ];
    const roleRepository = { listAll: jest.fn().mockResolvedValue(roles) };
    const useCase = new ListRolesUseCase({ roleRepository });

    const result = await useCase.execute();

    expect(result).toBe(roles);
    expect(roleRepository.listAll).toHaveBeenCalled();
  });
});
