import express from 'express';
import { InvitationController } from '../controller/invitation.controller'; // Ensure this path is correct
import { isAuthenticated } from '../middleware/isAuth';

const router = express.Router();

router.post('/invitations',isAuthenticated, InvitationController.createInvitation);
router.post('/invitations/accept', InvitationController.acceptInvitation);
router.post('/invitations/decline', InvitationController.declineInvitation);

export default router;