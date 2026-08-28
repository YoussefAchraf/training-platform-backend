import ExcelJS from 'exceljs';
import { Readable } from 'stream';

const SUPPORTED_EXTENSIONS = ['csv', 'xlsx'];

function getExtension(filename) {
  const match = /\.([^.]+)$/.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

function findColumnIndexes(headerRow) {
  let nameIndex = null;
  let emailIndex = null;
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = String(cell.value ?? '').trim().toLowerCase();
    if (text === 'name') nameIndex = colNumber;
    if (text === 'email') emailIndex = colNumber;
  });
  return { nameIndex, emailIndex };
}

function cellText(row, colIndex) {
  if (!colIndex) return '';
  const value = row.getCell(colIndex).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('').trim();
  }
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return String(value).trim();
}

class AttendeeFileParserService {
  async parse(buffer, filename) {
    const extension = getExtension(filename);
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new Error('Unsupported file type - please upload a .xlsx or .csv file');
    }

    const workbook = new ExcelJS.Workbook();
    let worksheet;
    if (extension === 'csv') {
      worksheet = await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer);
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet || worksheet.rowCount < 1) {
      throw new Error('The uploaded file is empty');
    }

    const { nameIndex, emailIndex } = findColumnIndexes(worksheet.getRow(1));
    if (!nameIndex) {
      throw new Error(
        'Could not find a "Name" column - the first row must be a header row with a "Name" column (and optionally an "Email" column)',
      );
    }

    const rows: Array<{ row: number; name: string; email: string | null }> = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const name = cellText(row, nameIndex);
      const email = emailIndex ? cellText(row, emailIndex) : '';
      if (!name && !email) continue;
      rows.push({ row: rowNumber, name, email: email || null });
    }

    return rows;
  }
}

export { AttendeeFileParserService };
