import { z } from "zod";

// Human Name
const HumanNameSchema = z.object({
  use: z.string().optional(),
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
});

// Address
const AddressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

// Patient Resource
export const PatientSchema = z.object({
  resourceType: z.literal("Patient").optional(),
  id: z.string().optional(),
  //   identifier: z.array(IdentifierSchema).optional(),
  name: z.array(HumanNameSchema).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().optional(), // ISO date
  address: z.array(AddressSchema).optional(),
});

export type Patient = z.infer<typeof PatientSchema>;
