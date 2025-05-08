import { z } from "zod";
//make eveything optional
export const ClaimSchema = z.object({
  resourceType: z.literal("Claim"),
  id: z.string().optional(),
  status: z.string().optional(), // e.g., "active", "cancelled"
  type: z
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
  use: z.enum(["claim", "preauthorization", "predetermination"]).optional(),
  patient: z
    .object({
      reference: z.string().optional(), // "Patient/123"
    })
    .optional(),
  created: z.string().optional(), // ISO date
  provider: z.object({
    reference: z.string().optional(), // "Practitioner/456"
  }),
  diagnosis: z
    .array(
      z.object({
        sequence: z.number().optional(),
        diagnosisCodeableConcept: z
          .object({
            coding: z
              .array(
                z.object({
                  system: z.string().optional(), // e.g., "http://hl7.org/fhir/sid/icd-10"
                  code: z.string().optional(),
                  display: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
  item: z
    .array(
      z.object({
        sequence: z.number().optional(),
        productOrService: z
          .object({
            coding: z
              .array(
                z.object({
                  code: z.string().optional(),
                  system: z.string().optional(),
                  display: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
        net: z
          .object({
            value: z.number().optional(),
            currency: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

export type ClaimResponse = z.infer<typeof ClaimSchema>;
