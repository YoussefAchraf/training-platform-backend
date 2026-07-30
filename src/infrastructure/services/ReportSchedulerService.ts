import cron from 'node-cron';

class ReportSchedulerService {
  sessionRepository: any;
  generateReportUseCase: any;

  constructor({ sessionRepository, generateReportUseCase }) {
    this.sessionRepository = sessionRepository;
    this.generateReportUseCase = generateReportUseCase;
  }

  start() {
    const cronExpression = process.env.REPORT_JOB_CRON || '*/10 * * * *';
    const thresholdMinutes = Number(process.env.REPORT_AUTO_GENERATE_AFTER_MINUTES) || 60;

    cron.schedule(cronExpression, async () => {
      try {
        const candidates = await this.sessionRepository.listEndedWithoutReport(thresholdMinutes);
        for (const session of candidates) {
          await this.generateReportUseCase.execute({ sessionId: session.id, triggeredBy: 'timeout' });
          console.log(`[ReportScheduler] Auto-generated report for session ${session.id}`);
        }
      } catch (err) {
        console.error('[ReportScheduler] Failed to auto-generate reports:', err.message);
      }
    });

    console.log(`[ReportScheduler] Started (cron: "${cronExpression}", threshold: ${thresholdMinutes}min)`);
  }
}

export { ReportSchedulerService };
