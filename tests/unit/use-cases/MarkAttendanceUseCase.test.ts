import { MarkAttendanceUseCase } from '../../../src/use-cases/sessions/MarkAttendanceUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    canManageCatalog: () => false,
    isSuperAdmin: () => false,
    isInstructor: () => false,
    ...overrides,
  };
}

function buildRepos(session: any = { id: 5, instructorId: 9 }) {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue(session),
      findAttendeeById: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Jane' }),
      markAttendeeStatus: jest.fn().mockResolvedValue({ id: 1, sessionId: 5, name: 'Jane', attendanceStatus: 'present' }),
    },
    instructorRepository: {
      findByUserId: jest.fn().mockResolvedValue({ id: 9 }),
    },
  };
}

describe('MarkAttendanceUseCase', () => {
  it('rejects an invalid status value', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => true }), sessionId: 5, attendeeId: 1, status: 'late' })
    ).rejects.toThrow('status must be "present" or "absent"');
    expect(sessionRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).rejects.toThrow('Training session not found');
  });

  it('rejects an Instructor marking attendance for a session that is not their own', async () => {
    const { sessionRepository, instructorRepository } = buildRepos({ id: 5, instructorId: 999 });
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).rejects.toThrow('not allowed');
    expect(sessionRepository.markAttendeeStatus).not.toHaveBeenCalled();
  });

  it('rejects an Instructor with no matching instructor profile', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    instructorRepository.findByUserId.mockResolvedValue(null);
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).rejects.toThrow('not allowed');
  });

  it('rejects a requester who is neither catalog-manager, SuperAdmin, nor the assigned Instructor', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, attendeeId: 1, status: 'present' })
    ).rejects.toThrow('not allowed');
  });

  it('allows the assigned Instructor to mark their own session\'s attendee', async () => {
    const { sessionRepository, instructorRepository } = buildRepos({ id: 5, instructorId: 9 });
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isInstructor: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).resolves.toBeDefined();
    expect(sessionRepository.markAttendeeStatus).toHaveBeenCalledWith(1, 'present');
  });

  it('allows Sales/Manager (canManageCatalog) to mark attendance on any session', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => true }), sessionId: 5, attendeeId: 1, status: 'absent' })
    ).resolves.toBeDefined();
  });

  it('allows a SuperAdmin to mark attendance on any session', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ isSuperAdmin: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).resolves.toBeDefined();
  });

  it('rejects marking an attendee that belongs to a different session (IDOR guard)', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue({ id: 1, sessionId: 999, name: 'Jane' });
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => true }), sessionId: 5, attendeeId: 1, status: 'present' })
    ).rejects.toThrow('Attendee not found for this session');
    expect(sessionRepository.markAttendeeStatus).not.toHaveBeenCalled();
  });

  it('rejects an attendeeId that does not exist at all', async () => {
    const { sessionRepository, instructorRepository } = buildRepos();
    sessionRepository.findAttendeeById.mockResolvedValue(null);
    const useCase = new MarkAttendanceUseCase({ sessionRepository, instructorRepository });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => true }), sessionId: 5, attendeeId: 404, status: 'present' })
    ).rejects.toThrow('Attendee not found for this session');
  });
});
