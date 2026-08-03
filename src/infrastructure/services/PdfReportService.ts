import PDFDocument from 'pdfkit';

class PdfReportService {
  async generateReportPdf({ session, training, client, report }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Training Session Report', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(14).text('Session Details');
      doc.fontSize(11);
      doc.text(`Training: ${training ? training.name : 'N/A'}`);
      doc.text(`Client: ${client ? client.companyName : 'N/A'}`);
      doc.text(`Start: ${new Date(session.startDate).toLocaleString()}`);
      doc.text(`End: ${new Date(session.endDate).toLocaleString()}`);
      doc.moveDown(2);

      doc.fontSize(14).text('Results');
      doc.fontSize(11);
      doc.text(`Average instructor score: ${report.averageScore ?? 'N/A'} / 5`);
      doc.text(`Average NPS score: ${report.npsAverage ?? 'N/A'} / 10`);
      doc.moveDown(2);

      doc.fontSize(9).fillColor('gray').text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);

      doc.end();
    });
  }
}

export { PdfReportService };
