import express from 'express';
import { CaseController } from '../controller/case.controller'; // Ensure this path is correct
import { isAuthenticated } from '../middleware/isAuth';

const router = express.Router();

router.post('/', isAuthenticated, CaseController.create);
router.get('/:id', isAuthenticated, CaseController.getById);
router.get('/', isAuthenticated, CaseController.getAll);
router.put('/:id', isAuthenticated, CaseController.update);
router.delete('/:id', isAuthenticated, CaseController.delete);

export default router;