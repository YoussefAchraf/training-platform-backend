import cron from 'node-cron';
import { ReportSchedulerService } from '../../../src/infrastructure/services/ReportSchedulerService';
import { SessionReminderSchedulerService } from '../../../src/infrastructure/services/SessionReminderSchedulerService';
import { CertificationExpirySchedulerService } from '../../../src/infrastructure/services/CertificationExpirySchedulerService';
import { AttachmentUploadGcService } from '../../../src/infrastructure/services/AttachmentUploadGcService';

jest.mock('node-cron', () => ({ __esModule: true, default: { schedule: jest.fn() } }));

const schedule = cron.schedule as unknown as jest.Mock;


function tickOf(scheduler: { start: () => void }) {
  schedule.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  scheduler.start();
  return schedule.mock.calls[0][1] as () => Promise<void>;
}

function lockThatIs(free: boolean) {
  return { runExclusive: jest.fn(async (_name: string, fn: () => Promise<any>) => (free ? (await fn(), true) : false)) };
}

afterEach(() => jest.restoreAllMocks());

describe('cron schedulers take the cluster-wide job lock on every tick', () => {
  const cases = [
    {
      name: 'report-scheduler',
      build: (jobLock) => {
        const sessionRepository = { listEndedWithoutReport: jest.fn(async () => [{ id: 7 }]) };
        const generateReportUseCase = { execute: jest.fn(async () => undefined) };
        return { scheduler: new ReportSchedulerService({ sessionRepository, generateReportUseCase, jobLock }), work: generateReportUseCase.execute };
      },
    },
    {
      name: 'session-reminder-scheduler',
      build: (jobLock) => {
        const sendUpcomingSessionRemindersUseCase = { execute: jest.fn(async () => ({ remindedCount: 0 })) };
        return { scheduler: new SessionReminderSchedulerService({ sendUpcomingSessionRemindersUseCase, jobLock }), work: sendUpcomingSessionRemindersUseCase.execute };
      },
    },
    {
      name: 'certification-expiry-scheduler',
      build: (jobLock) => {
        const sendCertificationExpiryRemindersUseCase = { execute: jest.fn(async () => ({ remindedCount: 0 })) };
        return { scheduler: new CertificationExpirySchedulerService({ sendCertificationExpiryRemindersUseCase, jobLock }), work: sendCertificationExpiryRemindersUseCase.execute };
      },
    },
    {
      name: 'attachment-upload-gc',
      build: (jobLock) => {
        const attachmentStorageService = { listStaleUploadIds: jest.fn(async () => ['u1']), abortUpload: jest.fn(async () => undefined) };
        return { scheduler: new AttachmentUploadGcService({ attachmentStorageService, jobLock }), work: attachmentStorageService.listStaleUploadIds };
      },
    },
  ];

  it.each(cases)('$name runs its work when it wins the lock, under its own lock name', async ({ name, build }) => {
    const jobLock = lockThatIs(true);
    const { scheduler, work } = build(jobLock);

    await tickOf(scheduler)();

    expect(jobLock.runExclusive).toHaveBeenCalledWith(name, expect.any(Function));
    expect(work).toHaveBeenCalled();
  });

  it.each(cases)('$name does nothing when another instance holds the lock', async ({ build }) => {
    const jobLock = lockThatIs(false);
    const { scheduler, work } = build(jobLock);

    await tickOf(scheduler)();

    expect(jobLock.runExclusive).toHaveBeenCalledTimes(1);
    expect(work).not.toHaveBeenCalled();
  });

  it.each(cases)('$name logs and survives a failing lock (database down) instead of crashing the tick', async ({ build }) => {
    const jobLock = { runExclusive: jest.fn(async () => Promise.reject(new Error('database unavailable'))) };
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { scheduler } = build(jobLock);

    await expect(tickOf(scheduler)()).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalled();
  });

  it('without a lock wired (default) the schedulers behave exactly as before', async () => {
    const sendUpcomingSessionRemindersUseCase = { execute: jest.fn(async () => ({ remindedCount: 0 })) };
    const scheduler = new SessionReminderSchedulerService({ sendUpcomingSessionRemindersUseCase } as any);

    await tickOf(scheduler)();

    expect(sendUpcomingSessionRemindersUseCase.execute).toHaveBeenCalledTimes(2);
  });
});
