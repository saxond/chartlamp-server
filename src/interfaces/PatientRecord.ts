import { z } from "zod";
import { normalizeDate } from "../utils/helpers";

const PatientDetailsSchema = z.object({
  name: z.string(),
  //   age: z.union([z.string(), z.number()]), // Allow age as string or number
  //   gender: z.string(),
  //   dateOfBirth: z.string(), // You can parse this to a Date later if needed
  //   address: z.string(),
  //   contactInformation: z.string(),
});

const EncounterSchema = z.object({
  dateTime: z.string()
  .transform((date) => {
    return normalizeDate(date);
  }),
  location: z.string(),
  medicalNote: z.string(),
  diagnoses: z.array(
    z.object({
      diagnosis: z.string(),
      code: z.string(),
    })
  ),
  //   procedures: z.array(z.string()),
  //   medications: z.array(z.string()),
  careTeam: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
    })
  ),
  claims: z.array(
    z.object({
      //   claimId: z.string(),
      totalAmount: z.string(),
      //   dateOfClaimSubmission: z.string().transform((val: string) => new Date(val)), // Converts to a Date object
      status: z.string(),
    })
  ),
});

const patientRecordSchema = z.object({
  patientDetails: PatientDetailsSchema,
  encounters: z.array(EncounterSchema),
});

function mergeEncounters(encounters: any[]) {
  const merged: any = {};

  // Iterate through the encounters and group them by date
  encounters.forEach((encounter) => {
    const date = encounter.dateTime;
    if (!merged[date]) {
      // Initialize the grouped object if it doesn't exist for this date
      merged[date] = {
        dateTime: date, // Use the date for consistency
        location: encounter.location,
        medicalNote: encounter.medicalNote,
        diagnoses: [...encounter.diagnoses],
        careTeam: [...encounter.careTeam],
        claims: [...encounter.claims],
      };
    } else {
      // Merge data for the same date
      merged[date].medicalNote += ` ${encounter.medicalNote}`;
      merged[date].diagnoses.push(...encounter.diagnoses);
      merged[date].careTeam.push(...encounter.careTeam);
      merged[date].claims.push(...encounter.claims);
    }
  });

  // Return an array of the merged encounters
  return Object.values(merged);
}

export { mergeEncounters, patientRecordSchema };
