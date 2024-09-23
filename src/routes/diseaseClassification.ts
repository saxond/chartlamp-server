import express from 'express';
import { DiseaseClassificationController } from '../controller/diseaseClassification.controller'; // Ensure this path is correct
import { isAuthenticated } from '../middleware/isAuth';

const router = express.Router();

router.post('/disease-classifications', isAuthenticated, DiseaseClassificationController.create);
router.get('/disease-classifications', DiseaseClassificationController.getAll);
//seed data from csv
router.get('/disease-classifications/seed', DiseaseClassificationController.seedData);
router.get('/disease-classifications/:icdCode', DiseaseClassificationController.getByIcdCode);
router.put('/disease-classifications/:id', DiseaseClassificationController.update);
router.delete('/disease-classifications/:id', DiseaseClassificationController.delete);


export default router;