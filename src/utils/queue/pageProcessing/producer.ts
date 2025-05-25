import { createPageProcessingQueue } from "./queue";

export const pageProcessingQueue = createPageProcessingQueue();

export async function addPageProcessingBackgroundJob(job: any) {
  await pageProcessingQueue.add(`process-page-${job.pageNumber}`, job);
}
