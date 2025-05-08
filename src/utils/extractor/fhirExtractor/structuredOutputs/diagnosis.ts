import { z } from "zod";

//make everything optional
export const DiagnosticReportSchema = z.object({
  resourceType: z.literal("DiagnosticReport").optional(),
  id: z.string().optional(),
  status: z.string().optional(), // "final", "amended", etc.
  category: z
    .array(
      z.object({
        coding: z
          .array(
            z.object({
              system: z.string().optional(),
              code: z.string().optional(),
              display: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  code: z.object({
    coding: z.array(
      z.object({
        system: z.string().optional(),
        code: z.string().optional(),
        display: z.string().optional(),
      })
    ),
    text: z.string().optional(),
  }),
  subject: z
    .object({
      reference: z.string().optional(), // e.g., "Patient/123"
    })
    .optional(),
  encounter: z
    .object({
      reference: z.string().optional(),
    })
    .optional(),
  effectiveDateTime: z.string().optional(), // ISO 8601 date
  issued: z.string().optional(), // ISO datetime
  performer: z
    .array(
      z.object({
        reference: z.string().optional(),
      })
    )
    .optional(),
  result: z
    .array(
      z.object({
        reference: z.string().optional(), // e.g., Observation ID
      })
    )
    .optional(),
  conclusion: z.string().optional(),
  presentedForm: z
    .array(
      z.object({
        contentType: z.string().optional(),
        language: z.string().optional(),
        data: z.string().optional(), // base64-encoded
        title: z.string().optional(),
      })
    )
    .optional(),
});

export type DiagnosticReportResponse = z.infer<typeof DiagnosticReportSchema>;
