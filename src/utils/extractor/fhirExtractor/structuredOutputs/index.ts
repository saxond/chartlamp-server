import { z } from "zod";
import { PatientSchema } from "./patient";
import { EncounterSchema } from "./encounter";
import { ConditionSchema } from "./condition";
import { ClaimSchema } from "./claim";
import { DiagnosticReportSchema } from "./diagnosis";

export const BundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  type: z.string(),
  entry: z.array(
    z.object({
      resource: z.union([
        PatientSchema,
        EncounterSchema,
        ConditionSchema,
        DiagnosticReportSchema,
        ClaimSchema,
      ]),
    })
  ),
});

export type Bundle = z.infer<typeof BundleSchema>;

export const BundleSchemaV2 = z.object({
  patient: PatientSchema,
  encounters: z.array(EncounterSchema),
  conditions: z.array(ConditionSchema),
  diagnosticReports: z.array(DiagnosticReportSchema),
  claims: z.array(ClaimSchema),
});

export type BundelV2 = z.infer<typeof BundleSchemaV2>;
