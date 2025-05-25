import {DocumentService} from './document.service';

import {describe, expect, it, jest, afterEach, beforeEach} from '@jest/globals';

describe('DocumentService', () => {
    let documentService: DocumentService;

    beforeEach(() => {
        documentService = new DocumentService();
    });

    afterEach(async () => {
        jest.clearAllMocks();
    });

    it('should get icd code from description', async () => {
        const result = await documentService.getIcdCodeFromDescription('Acute bronchitis due to coxsackievirus');

        expect(result).toBeDefined();
        expect(result).toEqual(['J20.3']);
    }, 10000);
});