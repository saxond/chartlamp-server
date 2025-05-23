// helpers.test.ts
import {normalizeDate} from './helpers';
import { describe, expect, it } from '@jest/globals';

describe('normalizeDate', () => {
    it('should correctly normalize a valid ISO date string', () => {
        const dateInput = '2023-09-25';
        const result = normalizeDate(dateInput);
        expect(result).toBe('2023-09-25');
    });

    it('should correctly normalize a valid "DD-MM-YYYY" formatted date string', () => {
        const dateInput = '25-09-2023';
        const result = normalizeDate(dateInput);
        expect(result).toBe('2023-09-25');
    });

    it('should correctly normalize a valid "MM-DD-YYYY" formatted date string', () => {
        const dateInput = '09/25/2023';
        const result = normalizeDate(dateInput);
        expect(result).toBe('2023-09-25');
    });

    it('should correctly normalize a date string with time component', () => {
        const dateInput = '2023-09-25T15:30:00Z';
        const result = normalizeDate(dateInput);
        expect(result).toBe('2023-09-25');
    });

    it('should throw an error for invalid date strings', () => {
        const dateInput = 'invalid-date';
        expect(() => normalizeDate(dateInput)).toThrowError('Invalid date format: invalid-date');
    });
});