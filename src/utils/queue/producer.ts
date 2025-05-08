import { Queue } from "bullmq";
import { createIcdcodeClassificationQueue } from "./icdcodeClassification/queue";
import { createOcrPageExtractorQueue } from "./ocrPageExtractor/queue";
import { redis } from "../redis";

const icdcodeClassificationQueue = createIcdcodeClassificationQueue();
const ocrPageExtractorQueue = createOcrPageExtractorQueue();

export async function addIcdcodeClassificationBackgroundJob(
  jobName: string,
  input?: any
) {
  console.log("adding job to backgrounds...", { jobName, input });
  try {
    await icdcodeClassificationQueue.add(jobName, input, {
      jobId: `icd-cls-${input.reportId}-${input.icdCodes[0]}`,
    });
  } catch (error) {
    console.error("Error adding job to background:", error);
    throw error;
  }
}

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
  await icdcodeClassificationQueue.close();
  await ocrPageExtractorQueue.close();
};

export async function clearQueue(queueName: string) {
  const queue = new Queue(queueName, { connection: redis });

  await queue.drain(true); // true => also removes delayed jobs
  console.log(`Queue ${queueName} drained!`);

  await queue.clean(0, 0, "completed");
  await queue.clean(0, 0, "failed");
  await queue.clean(0, 0, "delayed");
  await queue.clean(0, 0, "wait");
  await queue.clean(0, 0, "active");

  console.log(`Queue ${queueName} cleaned!`);
}

ocrPageExtractorQueue.on("waiting", ({ jobId }) => {
  console.log(`Job ${jobId} is waiting`);
});

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
