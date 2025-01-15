import IORedis from 'ioredis';
import {  caseQueueName } from "./types";
import {createWorker} from './worker.factory';
import casePopulationProcessor from './workers/casePopulation';
import { redisOptions as redisOptionsI} from '../redis/config';

export async function startBackgroundJobs() {
  const redisOptions = {
    ...redisOptionsI,
    maxRetriesPerRequest: null,
  };

  const { worker: casePopulationWorker } = createWorker(
    caseQueueName,
    casePopulationProcessor,
    new IORedis(redisOptions)
  );

  await casePopulationWorker.startStalledCheckTimer();

  const shutdown = async () => {
    await casePopulationWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
