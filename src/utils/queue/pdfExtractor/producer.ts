import { createPdfTextExtractorQueue } from "./queue";

export const pdfTextExtractorQueue = createPdfTextExtractorQueue();

export async function addPdfTextExtractorBackgroundJob(pageId: string) {
  await pdfTextExtractorQueue.upsertJobScheduler(
    `scheduler-${pageId}`,
    {
      every: 120000, // 2 min
      limit: 5000,
      immediately: false,
    },
    {
      name: "pdfTextExtractor",
      data: { pageId },
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


export async function cancelPdfTextExtractorPolling(pageId: string) {
  await pdfTextExtractorQueue.removeJobScheduler(`scheduler-${pageId}`);
  console.log("🛑 Stopped polling job");
}

export const closeQueues = async () => {
  console.log("closing queues...");
  await pdfTextExtractorQueue.close();
};


process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
