import { BulkImportAttendeesUseCase } from '../../../src/use-cases/sessions/BulkImportAttendeesUseCase';

function buildRequester(overrides: Record<string, any> = {}) {
  return {
    canManageCatalog: () => true,
    ...overrides,
  };
}

function buildRepos() {
  return {
    sessionRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 5,
        startDate: '2026-09-01T09:00:00Z',
        endDate: '2026-09-01T17:00:00Z',
      }),
      findOverlappingAttendeeSession: jest.fn().mockResolvedValue(null),
      addAttendeesBulk: jest.fn().mockImplementation((sessionId, attendees) =>
        Promise.resolve(attendees.map((a: any, i: number) => ({ id: i + 1, sessionId, ...a }))),
      ),
    },
    attendeeFileParserService: {
      parse: jest.fn().mockResolvedValue([
        { row: 2, name: 'Alice', email: 'alice@example.com' },
        { row: 3, name: 'Bob', email: null },
      ]),
    },
  };
}

const file = { buffer: Buffer.from('x'), originalname: 'attendees.xlsx' };

describe('BulkImportAttendeesUseCase', () => {
  it('rejects a requester who cannot manage the catalog', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    await expect(
      useCase.execute({ requester: buildRequester({ canManageCatalog: () => false }), sessionId: 5, file })
    ).rejects.toThrow('Only Sales or Manager');
  });

  it('rejects when no file was uploaded', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, file: undefined })
    ).rejects.toThrow('No file uploaded');
  });

  it('rejects a session that does not exist', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    sessionRepository.findById.mockResolvedValue(null);
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 999, file })
    ).rejects.toThrow('Training session not found');
  });

  it('wraps a parser failure in a clear message', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockRejectedValue(new Error('Could not find a "Name" column'));
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, file })
    ).rejects.toThrow('Could not read the uploaded file');
  });

  it('skips a row with a missing name', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockResolvedValue([{ row: 2, name: '  ', email: 'a@b.com' }]);
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    const result = await useCase.execute({ requester: buildRequester(), sessionId: 5, file });

    expect(result.skipped).toEqual([{ row: 2, name: null, email: 'a@b.com', reason: 'Missing name' }]);
    expect(result.importedCount).toBe(0);
  });

  it('skips a row with an invalid email', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockResolvedValue([{ row: 2, name: 'Alice', email: 'not-an-email' }]);
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    const result = await useCase.execute({ requester: buildRequester(), sessionId: 5, file });

    expect(result.skipped).toEqual([{ row: 2, name: 'Alice', email: 'not-an-email', reason: 'Invalid email format' }]);
  });

  it('skips a row whose email is a duplicate within the same file', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockResolvedValue([
      { row: 2, name: 'Alice', email: 'a@b.com' },
      { row: 3, name: 'Alice Again', email: 'A@B.com' },
    ]);
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    const result = await useCase.execute({ requester: buildRequester(), sessionId: 5, file });

    expect(result.importedCount).toBe(1);
    expect(result.skipped).toEqual([{ row: 3, name: 'Alice Again', email: 'A@B.com', reason: 'Duplicate email in file' }]);
  });

  it('skips a row whose attendee is already registered in an overlapping session', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockResolvedValue([{ row: 2, name: 'Alice', email: 'a@b.com' }]);
    sessionRepository.findOverlappingAttendeeSession.mockResolvedValue({ id: 7 });
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    const result = await useCase.execute({ requester: buildRequester(), sessionId: 5, file });

    expect(result.skipped).toEqual([
      { row: 2, name: 'Alice', email: 'a@b.com', reason: 'Already registered in an overlapping session' },
    ]);
    expect(sessionRepository.addAttendeesBulk).toHaveBeenCalledWith(5, []);
  });

  it('rejects a file with more rows than the cap', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    attendeeFileParserService.parse.mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => ({ row: i + 2, name: `Person ${i}`, email: null })),
    );
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    await expect(
      useCase.execute({ requester: buildRequester(), sessionId: 5, file })
    ).rejects.toThrow('too many rows');
  });

  it('imports the valid rows and reports the correct counts on a mixed batch', async () => {
    const { sessionRepository, attendeeFileParserService } = buildRepos();
    const useCase = new BulkImportAttendeesUseCase({ sessionRepository, attendeeFileParserService });

    const result = await useCase.execute({ requester: buildRequester(), sessionId: 5, file });

    expect(sessionRepository.addAttendeesBulk).toHaveBeenCalledWith(5, [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: null },
    ]);
    expect(result.importedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.attendees).toHaveLength(2);
  });
});
