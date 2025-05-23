import { pdfTextExtractorQueueName } from "../types";
import { createWorker } from "../worker.factory";
import pdfTextExtractorProcessor from "./processor";
import { redis } from "../../redis";

export async function createPdfTextExtractorWorker() {
  const { worker: pdfTextExtractorWorker } = createWorker(
    pdfTextExtractorQueueName,
    pdfTextExtractorProcessor,
    redis
  );

  await pdfTextExtractorWorker.startStalledCheckTimer();

  return pdfTextExtractorWorker;
}
