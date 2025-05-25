import { Job } from "bullmq";
import { ProcessorService } from "../../../services/processor.service";

export default async function (job: Job) {
  console.log("processing pdf text extractor", job.data);
  const processorService = new ProcessorService();
  await processorService.processTesseractJob(job.data.pageId);
}
