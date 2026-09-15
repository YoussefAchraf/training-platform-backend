import { CreateGroupConversationUseCase } from '../../../src/use-cases/messaging/CreateGroupConversationUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    isSuperAdmin: () => false,
    isManager: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    conversationRepository: {
      createGroup: jest.fn().mockResolvedValue({ id: 10, type: 'group', name: 'Onboarding' }),
    },
    userRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 2,
        roleName: 'Instructor',
        isApproved: () => true,
        isSuperAdmin: () => false,
      }),
    },
  };
}

describe('CreateGroupConversationUseCase', () => {
  it('rejects a SuperAdmin requester', async () => {
    const repos = buildRepos();
    const useCase = new CreateGroupConversationUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), name: 'G', memberUserIds: [2] })
    ).rejects.toThrow('SuperAdmin cannot access messaging');
    expect(repos.conversationRepository.createGroup).not.toHaveBeenCalled();
  });

  it('rejects a non-Manager requester (Instructors cannot create groups)', async () => {
    const repos = buildRepos();
    const useCase = new CreateGroupConversationUseCase(repos);

    await expect(
      useCase.execute({ requester: buildRequester({ isManager: () => false }), name: 'G', memberUserIds: [2] })
    ).rejects.toThrow('Only a Manager');
  });

  it('rejects a blank group name', async () => {
    const repos = buildRepos();
    const useCase = new CreateGroupConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), name: '  ', memberUserIds: [2] })).rejects.toThrow(
      'Group name is required'
    );
  });

  it('rejects an empty member list (after removing the requester)', async () => {
    const repos = buildRepos();
    const useCase = new CreateGroupConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), name: 'G', memberUserIds: [1] })).rejects.toThrow(
      'At least one member'
    );
  });

  it('rejects a member who is SuperAdmin', async () => {
    const repos = buildRepos();
    repos.userRepository.findById.mockResolvedValue({ id: 2, roleName: 'SuperAdmin', isApproved: () => true, isSuperAdmin: () => true });
    const useCase = new CreateGroupConversationUseCase(repos);

    await expect(useCase.execute({ requester: buildRequester(), name: 'G', memberUserIds: [2] })).rejects.toThrow(
      'cannot be added to messaging'
    );
    expect(repos.conversationRepository.createGroup).not.toHaveBeenCalled();
  });

  it('dedupes member ids and excludes the requester before creating the group', async () => {
    const repos = buildRepos();
    const useCase = new CreateGroupConversationUseCase(repos);

    await useCase.execute({ requester: buildRequester(), name: '  Onboarding  ', memberUserIds: [2, 2, 1] });

    expect(repos.conversationRepository.createGroup).toHaveBeenCalledWith({
      createdBy: 1,
      name: 'Onboarding',
      memberUserIds: [2],
    });
  });
});
