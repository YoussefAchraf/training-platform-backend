import cron from 'node-cron';
import { noJobLock } from './JobLock';

class ReportSchedulerService {
  sessionRepository: any;
  generateReportUseCase: any;
  jobLock: any;

  constructor({ sessionRepository, generateReportUseCase, jobLock = noJobLock }) {
    this.sessionRepository = sessionRepository;
    this.generateReportUseCase = generateReportUseCase;
    this.jobLock = jobLock;
  }

  start() {
    const cronExpression = process.env.REPORT_JOB_CRON || '*/10 * * * *';
    const thresholdMinutes = Number(process.env.REPORT_AUTO_GENERATE_AFTER_MINUTES) || 60;

    cron.schedule(cronExpression, async () => {
      try {
        await this.jobLock.runExclusive('report-scheduler', async () => {
          const candidates = await this.sessionRepository.listEndedWithoutReport(thresholdMinutes);
          for (const session of candidates) {
            await this.generateReportUseCase.execute({ sessionId: session.id, triggeredBy: 'timeout' });
            console.log(`[ReportScheduler] Auto-generated report for session ${session.id}`);
          }
        });
      } catch (err) {
        console.error('[ReportScheduler] Failed to auto-generate reports:', err.message);
      }
    });

    console.log(`[ReportScheduler] Started (cron: "${cronExpression}", threshold: ${thresholdMinutes}min)`);
  }
}

export { ReportSchedulerService };
