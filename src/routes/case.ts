import express from 'express';
import { CaseController } from '../controller/case.controller'; // Ensure this path is correct
import { isAuthenticated } from '../middleware/isAuth';

const router = express.Router();
const caseController = new CaseController();

// Case routes
router.post('/', isAuthenticated, caseController.create);
router.get('/', isAuthenticated, caseController.getAll);
router.get('/user', isAuthenticated, caseController.getUserCases);
router.get('/:id', isAuthenticated, caseController.getById);
router.put('/:id', isAuthenticated, caseController.update);
router.delete('/:id', isAuthenticated, caseController.delete);

export default router;