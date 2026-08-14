import { CronExpressionParser } from 'cron-parser';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { reportDeliveryEvents, reportSchedules } from '../models/reporting-schema';

export class ScheduleService {
  /**
   * Real cron expression parsing (future-implementation/advanced-reporting
   * remediation, section-06) - previously ignored cronExpression entirely
   * and always returned fromDate + 24h. Throws on an invalid expression
   * rather than silently returning a wrong date.
   */
  static calculateNextRun(cronExpression: string, fromDate = new Date()): Date {
    const interval = CronExpressionParser.parse(cronExpression, { currentDate: fromDate });
    return interval.next().toDate();
  }

  /**
   * Triggers active schedule delivery event logging.
   */
  static async triggerScheduleDelivery(scheduleId: string, runId: string, recipient: string) {
    await db.insert(reportDeliveryEvents).values({
      scheduleId,
      runId,
      recipient,
      deliveryStatus: 'sent',
      sentAt: new Date().toISOString(),
    });
  }
}
