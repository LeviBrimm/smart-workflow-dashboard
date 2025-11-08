import type { SQSEvent } from 'aws-lambda';
import { processRunRecords } from '../../api/src/services/run-processor.js';

export const handler = async (event: SQSEvent) => {
  await processRunRecords(event.Records.map(record => ({ body: record.body ?? '' })));
};
