import PDFDocument from 'pdfkit';



const COLORS = {
  primary: '#dc2626',
  primaryTint: '#fecaca',
  text: '#18181b',
  textMuted: '#52525b',
  textFaint: '#a1a1aa',
  border: '#e4e4e7',
  bgSubtle: '#fafafa',
  success: '#16a34a',
  white: '#ffffff',
};



const FONT = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

const MARGIN = 50;
const HEADER_HEIGHT = 86;

function attendanceLabel(status) {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  return 'Pending';
}

function attendanceColor(status) {
  if (status === 'present') return COLORS.success;
  if (status === 'absent') return COLORS.primary;
  return COLORS.textFaint;
}

class PdfReportService {
  async generateReportPdf({ session, training, client, instructor, attendees, report }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentWidth = doc.page.width - MARGIN * 2;

      this.drawHeader(doc, contentWidth);
      this.drawSessionDetails(doc, contentWidth, { session, training, client, instructor });
      this.drawScores(doc, contentWidth, report);
      this.drawParticipation(doc, attendees ?? []);
      this.drawAttendeeTable(doc, contentWidth, attendees ?? []);
      this.drawFooters(doc, contentWidth, report);

      doc.end();
    });
  }

  private drawHeader(doc, contentWidth) {
    doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(COLORS.primary);
    doc
      .fillColor(COLORS.white)
      .font(FONT.bold)
      .fontSize(20)
      .text('Training Platform', MARGIN, 26, { width: contentWidth });
    doc
      .fillColor(COLORS.primaryTint)
      .font(FONT.regular)
      .fontSize(12)
      .text('Session Report', MARGIN, 52, { width: contentWidth });
    doc.y = HEADER_HEIGHT + 26;
  }

  private sectionTitle(doc, title, contentWidth) {
    doc.fillColor(COLORS.text).font(FONT.bold).fontSize(13).text(title, MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(0.6);
  }

  private drawSessionDetails(doc, contentWidth, { session, training, client, instructor }) {
    this.sectionTitle(doc, 'Session Details', contentWidth);

    const rows: Array<[string, string]> = [
      ['Training', training ? training.name : 'N/A'],
      ['Provider', training?.providerName ?? 'N/A'],
      ['Client', client ? client.companyName : 'N/A'],
      ['Instructor', instructor ? `${instructor.firstname} ${instructor.lastname}` : 'Unassigned'],
      ['Starts', new Date(session.startDate).toLocaleString()],
      ['Ends', new Date(session.endDate).toLocaleString()],
      ['Status', session.sessionStatus ?? 'N/A'],
    ];

    const rowHeight = 22;
    const labelWidth = 130;
    const startY = doc.y;

    rows.forEach(([label, value], index) => {
      const y = startY + index * rowHeight;
      if (index % 2 === 0) {
        doc.rect(MARGIN, y, contentWidth, rowHeight).fill(COLORS.bgSubtle);
      }
      doc
        .fillColor(COLORS.textMuted)
        .font(FONT.regular)
        .fontSize(10)
        .text(label, MARGIN + 10, y + 6, { width: labelWidth });
      doc
        .fillColor(COLORS.text)
        .font(FONT.bold)
        .fontSize(10)
        .text(value, MARGIN + labelWidth, y + 6, { width: contentWidth - labelWidth - 10 });
    });

    doc.y = startY + rows.length * rowHeight + 24;
  }

  private drawScores(doc, contentWidth, report) {
    this.sectionTitle(doc, 'Results', contentWidth);

    const gap = 16;
    const boxWidth = (contentWidth - gap) / 2;
    const boxHeight = 68;
    const y = doc.y;

    const scoreText = report?.averageScore != null ? `${report.averageScore} / 5` : 'N/A';
    const npsText = report?.npsAverage != null ? `${report.npsAverage}%` : 'N/A';

    [
      { x: MARGIN, label: 'AVERAGE INSTRUCTOR SCORE', value: scoreText },
      { x: MARGIN + boxWidth + gap, label: 'AVERAGE NPS', value: npsText },
    ].forEach(({ x, label, value }) => {
      doc.roundedRect(x, y, boxWidth, boxHeight, 8).fill(COLORS.bgSubtle);
      doc
        .fillColor(COLORS.textMuted)
        .font(FONT.bold)
        .fontSize(9)
        .text(label, x + 14, y + 14, { width: boxWidth - 28 });
      doc
        .fillColor(COLORS.primary)
        .font(FONT.bold)
        .fontSize(24)
        .text(value, x + 14, y + 32, { width: boxWidth - 28 });
    });

    doc.y = y + boxHeight + 24;
  }

  private drawParticipation(doc, attendees) {
    const total = attendees.length;
    const submitted = attendees.filter((attendee) => attendee.surveySubmitted).length;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

    doc
      .fillColor(COLORS.text)
      .font(FONT.regular)
      .fontSize(11)
      .text(`${submitted} of ${total} attendees submitted feedback (${pct}%)`, MARGIN, doc.y);
    doc.moveDown(1.4);
  }

  private drawAttendeeTable(doc, contentWidth, attendees) {
    this.sectionTitle(doc, 'Attendees', contentWidth);

    if (attendees.length === 0) {
      doc
        .fillColor(COLORS.textMuted)
        .font(FONT.regular)
        .fontSize(10)
        .text('No attendees registered for this session.', MARGIN, doc.y);
      doc.moveDown();
      return;
    }

    const columns = [
      { key: 'name', label: 'Name', width: contentWidth * 0.3 },
      { key: 'email', label: 'Email', width: contentWidth * 0.36 },
      { key: 'attendance', label: 'Attendance', width: contentWidth * 0.17 },
      { key: 'survey', label: 'Survey', width: contentWidth * 0.17 },
    ];
    const rowHeight = 24;
    const headerHeight = 24;
    const bottomLimit = doc.page.height - MARGIN;

    const drawTableHeader = (y) => {
      doc.rect(MARGIN, y, contentWidth, headerHeight).fill(COLORS.primary);
      let x = MARGIN;
      doc.fillColor(COLORS.white).font(FONT.bold).fontSize(9);
      for (const column of columns) {
        doc.text(column.label.toUpperCase(), x + 8, y + 8, { width: column.width - 8 });
        x += column.width;
      }
      return y + headerHeight;
    };

    let y = drawTableHeader(doc.y);

    attendees.forEach((attendee, index) => {
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = drawTableHeader(MARGIN);
      }

      if (index % 2 === 1) {
        doc.rect(MARGIN, y, contentWidth, rowHeight).fill(COLORS.bgSubtle);
      }

      let x = MARGIN;
      doc
        .fillColor(COLORS.text)
        .font(FONT.regular)
        .fontSize(9)
        .text(attendee.name, x + 8, y + 7, { width: columns[0].width - 8, ellipsis: true });
      x += columns[0].width;
      doc
        .fillColor(COLORS.textMuted)
        .text(attendee.email || '-', x + 8, y + 7, { width: columns[1].width - 8, ellipsis: true });
      x += columns[1].width;
      doc
        .fillColor(attendanceColor(attendee.attendanceStatus))
        .font(FONT.bold)
        .text(attendanceLabel(attendee.attendanceStatus), x + 8, y + 7, { width: columns[2].width - 8 });
      x += columns[2].width;
      doc
        .fillColor(attendee.surveySubmitted ? COLORS.success : COLORS.textFaint)
        .text(attendee.surveySubmitted ? 'Submitted' : '—', x + 8, y + 7, { width: columns[3].width - 8 });

      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(MARGIN, y + rowHeight)
        .lineTo(MARGIN + contentWidth, y + rowHeight)
        .stroke();

      y += rowHeight;
    });

    doc.y = y + 20;
  }

  private drawFooters(doc, contentWidth, report) {
    const range = doc.bufferedPageRange();
    const generatedAt = report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'N/A';

    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 35;
      doc
        .fillColor(COLORS.textFaint)
        .font(FONT.regular)
        .fontSize(8)
        .text(`Generated on ${generatedAt}`, MARGIN, bottom, { width: contentWidth / 2, align: 'left' })
        .text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN, bottom, { width: contentWidth, align: 'right' });
    }
  }
}

export { PdfReportService };
