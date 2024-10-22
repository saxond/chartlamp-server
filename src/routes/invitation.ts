import express from 'express';
import { InvitationController } from '../controller/invitation.controller'; // Ensure this path is correct
import { isAuthenticated } from '../middleware/isAuth';

const router = express.Router();
const invitationController = new InvitationController();

router.post('/',isAuthenticated, invitationController.createInvitation);
router.get('/', isAuthenticated, invitationController.getInvitations);
router.post('/accept', invitationController.acceptInvitation);
router.post('/decline', invitationController.declineInvitation);

export default router;