import { z } from "zod";

//make everything optional
export const EncounterSchema = z.object({
  resourceType: z.literal("Encounter").optional(),
  id: z.string().optional(),
  status: z.string().optional(), // e.g., "finished", "in-progress"
  class: z.object({
    system: z.string().optional(), // e.g., http://terminology.hl7.org/CodeSystem/v3-ActCode
    code: z.string().optional(), // e.g., "AMB", "IMP", "EMER"
    display: z.string().optional(),
  }).optional(),
  subject: z
    .object({
      reference: z.string().optional(), // e.g., "Patient/123"
    })
    .optional(),
  period: z.object({
    start: z.string(), // ISO datetime
    end: z.string(),
  }),
});

export type EncounterResponse = z.infer<typeof EncounterSchema>;
