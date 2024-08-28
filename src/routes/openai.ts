import express from 'express';
import {
    cancelFineTuningJobController,
    completeChatController,
    deleteFineTunedModelController,
    listFineTuningEventsController,
    listFineTuningJobsController,
    trainModelController,
    uploadFineTunedDataController
} from '../controller/openai.controller';

const router = express.Router();

router.post('/complete-chat', completeChatController);
router.post('/upload-fine-tuned-data', uploadFineTunedDataController);
router.post('/train-model', trainModelController);
router.get('/list-fine-tuning-jobs', listFineTuningJobsController);
router.post('/cancel-fine-tuning-job/:jobId', cancelFineTuningJobController);
router.get('/list-fine-tuning-events/:jobId', listFineTuningEventsController);
router.delete('/delete-fine-tuned-model/:model', deleteFineTunedModelController);

export default router;
