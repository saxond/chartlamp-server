import { Job } from "bullmq";
import { CaseService } from "../../../services/case.service";

export default async function (job: Job) {
  console.log(" process", job.data);
  const caseService = new CaseService();
  await caseService.getStreamlinedDiseaseName(job.data);
}
