import { Job } from "bullmq";
import { ProcessorService } from "../../../services/processor.service";

export default async function (job: Job) {
  console.log("processor", job.data);
  const processorService = new ProcessorService();
  await processorService.processOcrPage(job.data.jobId);
}
