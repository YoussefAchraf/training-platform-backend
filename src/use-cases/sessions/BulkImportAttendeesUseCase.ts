import { isValidEmail } from '../../domain/validation/isValidEmail';

const MAX_ROWS = 500;

class BulkImportAttendeesUseCase {
  sessionRepository: any;
  attendeeFileParserService: any;

  constructor({ sessionRepository, attendeeFileParserService }) {
    this.sessionRepository = sessionRepository;
    this.attendeeFileParserService = attendeeFileParserService;
  }

  async execute({ requester, sessionId, file }: { requester: any; sessionId: any; file?: any }) {
    if (!requester.canManageCatalog()) {
      throw new Error('Only Sales or Manager can import attendees for a session');
    }
    if (!file) throw new Error('No file uploaded');

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new Error('Training session not found');

    let rows;
    try {
      rows = await this.attendeeFileParserService.parse(file.buffer, file.originalname);
    } catch (err: any) {
      throw new Error(`Could not read the uploaded file: ${err.message}`);
    }

    if (rows.length > MAX_ROWS) {
      throw new Error(`The uploaded file has too many rows (max ${MAX_ROWS})`);
    }

    const toInsert: Array<{ name: string; email: string | null }> = [];
    const skipped: Array<{ row: number; name: string | null; email: string | null; reason: string }> = [];
    const seenEmails = new Set<string>();

    for (const entry of rows) {
      const name = (entry.name || '').trim();
      const email = entry.email ? entry.email.trim() : null;

      if (!name) {
        skipped.push({ row: entry.row, name: null, email, reason: 'Missing name' });
        continue;
      }
      if (email && !isValidEmail(email)) {
        skipped.push({ row: entry.row, name, email, reason: 'Invalid email format' });
        continue;
      }
      if (email) {
        const normalizedEmail = email.toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          skipped.push({ row: entry.row, name, email, reason: 'Duplicate email in file' });
          continue;
        }
        const conflict = await this.sessionRepository.findOverlappingAttendeeSession({
          email,
          sessionId,
          startDate: session.startDate,
          endDate: session.endDate,
        });
        if (conflict) {
          skipped.push({ row: entry.row, name, email, reason: 'Already registered in an overlapping session' });
          continue;
        }
        seenEmails.add(normalizedEmail);
      }

      toInsert.push({ name, email });
    }

    const inserted = await this.sessionRepository.addAttendeesBulk(sessionId, toInsert);

    return {
      importedCount: inserted.length,
      skippedCount: skipped.length,
      attendees: inserted,
      skipped,
    };
  }
}

export { BulkImportAttendeesUseCase };
