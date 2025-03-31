import { Queue } from "bullmq";
import { redisOptions } from "../redis/config";
import { createIcdcodeClassificationQueue } from "./icdcodeClassification/queue";
import { createOcrQueue } from "./ocrExtraction/queue";
import { createOcrStatusQueue } from "./ocrExtractionStatus/queue";
import { createOcrPageExtractorQueue } from "./ocrPageExtractor/queue";
import { caseQueueName } from "./types";

const casePopulationQueue = new Queue(caseQueueName, {
  connection: redisOptions,
});

const ocrExtractionQueue = createOcrQueue();
const ocrExtractionStatusQueue = createOcrStatusQueue();
const icdcodeClassificationQueue = createIcdcodeClassificationQueue();
const ocrPageExtractorQueue = createOcrPageExtractorQueue();

export async function addOcrExtractionBackgroundJob(
  jobName: string,
  input?: any
) {
  console.log("adding job to backgrounds...", { jobName, input });
  try {
    await ocrExtractionQueue.add(jobName, input, {
      jobId: `ocr-${input.documentId}`,
    });
  } catch (error) {
    console.error("Error adding job to background:", error);
    throw error;
  }
}

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

export async function addOcrExtractionStatusPollingJob(jobId: string) {
  await ocrExtractionStatusQueue.upsertJobScheduler(
    `scheduler-${jobId}`,
    {
      every: 60000, // 1 min
      limit: 50,
      immediately: false,
    },
    {
      name: "ocrExtractionStatus",
      data: { jobId },
      // opts: {}, // Optional additional job options
    }
  );
}

export async function addOcrPageExtractorBackgroundJobV2(jobId: string) {
  console.log("adding job to backgrounds...", jobId);
  try {
    await ocrPageExtractorQueue.upsertJobScheduler(
      `scheduler-${jobId}`,
      {
        every: 60000, // 1 min
        limit: 100,
        immediately: false,
      },
      {
        name: "ocrPageExtractor",
        data: { jobId },
      }
    );
  } catch (error) {
    console.error("Error adding job to background:", error);
    throw error;
  }
}

export async function addOcrPageExtractorBackgroundJob(jobId: string) {
  console.log("Adding job to background queue...", jobId);
  try {
    const jobKey = `ocr-${jobId}`;

    const existingJob = await ocrPageExtractorQueue.getJob(jobKey);
    if (existingJob) {
      console.log("Job already exists in the queue:", jobKey);
      return;
    }

    await ocrPageExtractorQueue.add(
      "ocrPageExtractor",
      { jobId },
      {
        jobId: jobKey,
        // repeat: { every: 60000 }, // Repeat every minute
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    console.log("Job successfully added:", jobKey);
  } catch (error) {
    console.error("Error adding job to background:", error);
    throw error;
  }
}

export async function cancelOcrExtractionPolling(jobId: string) {
  await ocrExtractionStatusQueue.removeJobScheduler(`scheduler-${jobId}`);
  console.log("🛑 Stopped polling job");
}
export async function cancelOcrPageExtractorPolling(jobId: string) {
  await ocrPageExtractorQueue.removeJobScheduler(`scheduler-${jobId}`);
  console.log("🛑 Stopped polling job");
}

export const closeQueues = async () => {
  await casePopulationQueue.close();
};

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
