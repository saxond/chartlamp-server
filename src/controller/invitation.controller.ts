import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/isAuth';
import { InvitationService } from '../services/invitation.service'; // Ensure this path is correct
import { formatResponse } from '../utils/helpers';

const invitationService = new InvitationService();

export class InvitationController {
  // Create a new invitation
   async createInvitation(req: AuthRequest, res: Response) {
    try {
      const { email, role } = req.body;
      const invitation = await invitationService.createInvitation(req?.user?.id, email, role);
      res.status(201).json(invitation);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  // Accept an invitation
  async acceptInvitation(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      const user = await invitationService.acceptInvitation(token, password);
      res.status(200).json(user);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  // Decline an invitation
  async declineInvitation(req: Request, res: Response) {
    try {
      const { token } = req.body;
      const invitation = await invitationService.declineInvitation(token);
      res.status(200).json(invitation);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  //team member and invitation
  async getInvitations(req: AuthRequest, res: Response) {
    try {
      const invitations = await invitationService.getUsersAndInvitations(req?.user?.id as string);
      res.status(200).json(invitations);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }
}