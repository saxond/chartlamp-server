import { PageFhirData } from "./structuredOutputs/global";

const combineFhirPageData = (pages: PageFhirData[]) => {
  const combined: PageFhirData = {
    diseases: [],
    diagnoses: [],
    encounters: [],
    claims: [],
  };

  for (const page of pages) {
    if (page.diseases) combined?.diseases.push(...page.diseases);
    if (page.diagnoses) combined?.diagnoses.push(...page.diagnoses);
    if (page.encounters) combined?.encounters.push(...page.encounters);
    if (page.claims) combined?.claims.push(...page.claims);
  }

  // Deduplicate
  combined.diseases = [...new Set(combined.diseases)];
  combined.diagnoses = [...new Set(combined.diagnoses)];
  combined.encounters = [...new Set(combined.encounters)];
  combined.claims = [...new Set(combined.claims)];

  return combined;
};

export { combineFhirPageData };
