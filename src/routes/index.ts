import express from 'express';
import { verifyApiKey } from '../middleware/verifyApiKey';
import caseRoutes from './case';
import diseaseClassificationRoutes from './diseaseClassification';
import invitationRoutes from './invitation';
import openAiRoutes from './openai';
import userRoutes from './user';
const router = express.Router();

// Apply verifyApiKey middleware to all routes
router.use(verifyApiKey);

router.use('/user', userRoutes);

router.use('/openai', openAiRoutes);

router.use('/invitations', invitationRoutes);

router.use('/dc', diseaseClassificationRoutes);

router.use('/case', caseRoutes);

export default router;

