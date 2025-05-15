import { createOcrPageExtractorQueue } from "./queue";

export const ocrPageExtractorQueue = createOcrPageExtractorQueue();

export async function addOcrPageExtractorBackgroundJob(jobId: string) {
  await ocrPageExtractorQueue.upsertJobScheduler(
    `scheduler-${jobId}`,
    {
      every: 120000, // 2 min
      limit: 5000,
      immediately: false,
    },
    {
      name: "ocrPageExtractor",
      data: { jobId },
      opts: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 10,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
      },
    }
  );
}

export async function cancelOcrPageExtractorPolling(jobId: string) {
  await ocrPageExtractorQueue.removeJobScheduler(`scheduler-${jobId}`);
  console.log("🛑 Stopped polling job");
}

export const closeQueues = async () => {
  console.log("closing queues...");
  await ocrPageExtractorQueue.close();
};

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
