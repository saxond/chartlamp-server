// parseDiseaseClassificationCSV.test.ts
import fs from "fs";
import {parseDiseaseClassificationCSV} from './parseDiseaseClassificationCSV';
import { describe, expect, it } from '@jest/globals';

describe('parseDiseaseClassificationCSV', () => {

    it('should parse medical diagnosis codes', () => {
        const csvData = fs.readFileSync(
            "icd-10-medical-diagnosis-codes.csv",
            "utf-8"
        );
        const diseaseClassifications = parseDiseaseClassificationCSV(csvData);
        expect(diseaseClassifications.length).toEqual(71486);
        const found = diseaseClassifications.findLast((data) => data.icdCode == "A221");
        expect(found?.description).toEqual("Pulmonary anthrax");
    });

    it('should return an empty array for an empty CSV string', () => {
        const csvData = '';

        const result = parseDiseaseClassificationCSV(csvData);

        expect(result).toEqual([]);
    });
});