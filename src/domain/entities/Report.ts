class Report {
  id: any;
  sessionId: any;
  pdfUrl: any;
  averageScore: any;
  npsAverage: any;
  generatedAt: any;

  constructor({ id, sessionId, pdfUrl, averageScore, npsAverage, generatedAt }: any) {
    this.id = id;
    this.sessionId = sessionId;
    this.pdfUrl = pdfUrl;
    this.averageScore = averageScore;
    this.npsAverage = npsAverage;
    this.generatedAt = generatedAt;
  }
}

export { Report };
