import { ReportResponse } from "../fhirExtractor/structuredOutputs/global";

export interface PageMetadata {
  pageId: string;
  pageNumber: number;
  chunk: string;
}

export interface UnprocessedReport extends ReportResponse {}