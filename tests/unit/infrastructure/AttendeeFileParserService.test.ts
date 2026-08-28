import ExcelJS from 'exceljs';
import { AttendeeFileParserService } from '../../../src/infrastructure/services/AttendeeFileParserService';

async function buildXlsxBuffer(headers: string[], rows: Array<Array<string | undefined>>) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendees');
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('AttendeeFileParserService', () => {
  it('parses a well-formed file with Name and Email columns', async () => {
    const buffer = await buildXlsxBuffer(['Name', 'Email'], [
      ['Alice', 'alice@example.com'],
      ['Bob', ''],
    ]);
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.xlsx');

    expect(rows).toEqual([
      { row: 2, name: 'Alice', email: 'alice@example.com' },
      { row: 3, name: 'Bob', email: null },
    ]);
  });

  it('does not care about header column order', async () => {
    const buffer = await buildXlsxBuffer(['Email', 'Name'], [['carol@example.com', 'Carol']]);
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.xlsx');

    expect(rows).toEqual([{ row: 2, name: 'Carol', email: 'carol@example.com' }]);
  });

  it('matches headers case-insensitively', async () => {
    const buffer = await buildXlsxBuffer(['NAME', 'email'], [['Dana', 'dana@example.com']]);
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.xlsx');

    expect(rows).toEqual([{ row: 2, name: 'Dana', email: 'dana@example.com' }]);
  });

  it('throws a clear error when there is no Name column', async () => {
    const buffer = await buildXlsxBuffer(['Email'], [['a@b.com']]);
    const service = new AttendeeFileParserService();

    await expect(service.parse(buffer, 'attendees.xlsx')).rejects.toThrow('Could not find a "Name" column');
  });

  it('rejects an unsupported file extension', async () => {
    const buffer = await buildXlsxBuffer(['Name'], [['Alice']]);
    const service = new AttendeeFileParserService();

    await expect(service.parse(buffer, 'attendees.xls')).rejects.toThrow('Unsupported file type');
  });

  it('trims whitespace from cell values', async () => {
    const buffer = await buildXlsxBuffer(['Name', 'Email'], [['  Alice  ', '  alice@example.com  ']]);
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.xlsx');

    expect(rows).toEqual([{ row: 2, name: 'Alice', email: 'alice@example.com' }]);
  });

  it('parses a CSV file', async () => {
    const buffer = Buffer.from('Name,Email\nEve,eve@example.com\n');
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.csv');

    expect(rows).toEqual([{ row: 2, name: 'Eve', email: 'eve@example.com' }]);
  });

  it('skips fully blank rows', async () => {
    const buffer = await buildXlsxBuffer(['Name', 'Email'], [
      ['Alice', 'alice@example.com'],
      ['', ''],
      ['Bob', ''],
    ]);
    const service = new AttendeeFileParserService();

    const rows = await service.parse(buffer, 'attendees.xlsx');

    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });
});
