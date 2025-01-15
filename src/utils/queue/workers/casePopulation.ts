import { Job } from "bullmq";
import { CaseService } from "../../../services/case.service";

export default async function (job: Job) {
  const caseService = new CaseService();
  await caseService.cacheCaseData(job.data);
}
