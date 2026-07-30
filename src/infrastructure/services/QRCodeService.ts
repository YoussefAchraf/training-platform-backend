import QRCode from 'qrcode';

class QRCodeService {
    async generateSurveyQRCode(sessionId) {
    const surveyUrl = `${process.env.CLIENT_URL}/survey/${sessionId}`;
    const dataUrl = await QRCode.toDataURL(surveyUrl, { width: 300 });
    return { surveyUrl, qrCodeDataUrl: dataUrl };
  }
}

export { QRCodeService };
