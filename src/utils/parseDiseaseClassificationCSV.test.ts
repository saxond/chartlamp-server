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

/*
    it('should parse a valid CSV string into an array of DiseaseClassificationData objects', () => {
        const csvData = `E11.9 Diabetes mellitus, unspecified,Endocrine system
I10 Essential (primary) hypertension,Circulatory system`;

        const result = parseDiseaseClassificationCSV(csvData);

        expect(result).toEqual([
            {
                icdCode: 'E11.9',
                description: 'Diabetes mellitus, unspecified',
                affectedBodyPart: 'Endocrine system',
            },
            {
                icdCode: 'I10',
                description: 'Essential (primary) hypertension',
                affectedBodyPart: 'Circulatory system',
            },
        ]);
    });

    it('should handle extra whitespace in the CSV data', () => {
        const csvData = `  E11.9   Diabetes mellitus, unspecified  ,  Endocrine system      
I10      Essential (primary) hypertension,     Circulatory system  `;

        const result = parseDiseaseClassificationCSV(csvData);

        expect(result).toEqual([
            {
                icdCode: 'E11.9',
                description: 'Diabetes mellitus, unspecified',
                affectedBodyPart: 'Endocrine system',
            },
            {
                icdCode: 'I10',
                description: 'Essential (primary) hypertension',
                affectedBodyPart: 'Circulatory system',
            },
        ]);
    });

    it('should ignore empty lines in the CSV data', () => {
        const csvData = `E11.9 Diabetes mellitus, unspecified,Endocrine system

I10 Essential (primary) hypertension,Circulatory system`;

        const result = parseDiseaseClassificationCSV(csvData);

        expect(result).toEqual([
            {
                icdCode: 'E11.9',
                description: 'Diabetes mellitus, unspecified',
                affectedBodyPart: 'Endocrine system',
            },
            {
                icdCode: 'I10',
                description: 'Essential (primary) hypertension',
                affectedBodyPart: 'Circulatory system',
            },
        ]);
    });

    it('should throw an error for invalid CSV format', () => {
        const csvData = `E11.9 Diabetes mellitus, unspecified`;

        expect(() => parseDiseaseClassificationCSV(csvData)).toThrow();
    });

 */
});