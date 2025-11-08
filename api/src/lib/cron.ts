import parser from 'cron-parser';

export const isDue = (cronExpr: string, referenceDate = new Date()): boolean => {
  try {
    const interval = parser.parseExpression(cronExpr, { currentDate: referenceDate });
    const prev = interval.prev();
    return referenceDate.getTime() - prev.getTime() < 60 * 1000;
  } catch (error) {
    console.warn('Invalid cron expression', cronExpr, error);
    return false;
  }
};

export const getNextRun = (cronExpr: string, referenceDate = new Date()): string | undefined => {
  try {
    const interval = parser.parseExpression(cronExpr, { currentDate: referenceDate });
    return interval.next().toDate().toISOString();
  } catch (error) {
    console.warn('Invalid cron expression', cronExpr, error);
    return undefined;
  }
};
