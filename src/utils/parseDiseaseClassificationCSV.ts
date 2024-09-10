import { parse } from 'csv-parse/sync';

interface DiseaseClassificationData {
  icdCode: string;
  description: string;
  affectedBodyPart: string;
}

export function parseDiseaseClassificationCSV(csvData: string): DiseaseClassificationData[] {
  const records = parse(csvData, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: string[]) => {
    const [icdDescription, affectedBodyPart] = record;
    const [icdCode, ...descriptionParts] = icdDescription.split(/\s+/);
    const description = descriptionParts.join(' ');

    return {
      icdCode,
      description,
      affectedBodyPart,
    };
  });
}