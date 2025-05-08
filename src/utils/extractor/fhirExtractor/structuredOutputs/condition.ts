import { z } from "zod";

//make eveything optional
export const ConditionSchema = z.object({
  resourceType: z.literal("Condition").optional(),
  id: z.string().optional(),
  clinicalStatus: z
    .object({
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
    .optional(),
  verificationStatus: z
    .object({
      coding: z
        .array(
          z.object({
            code: z.string().optional(),
            display: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  category: z
    .array(
      z.object({
        coding: z.array(
          z.object({
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
          })
        ),
      })
    )
    .optional(),
  code: z
    .object({
      coding: z.array(
        z.object({
          system: z.string().optional(), // e.g. ICD-10
          code: z.string().optional(),
          display: z.string().optional(),
        })
      ),
      text: z.string().optional(),
    })
    .optional(),
  subject: z
    .object({
      reference: z.string().optional(), // e.g., "Patient/123"
    })
    .optional(),
  onsetDateTime: z.string().optional(), // ISO 8601
  recordedDate: z.string().optional(),
  recorder: z
    .object({
      reference: z.string().optional(),
    })
    .optional(),
});

export type ConditionResponse = z.infer<typeof ConditionSchema>;
