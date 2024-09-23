import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/isAuth';
import { InvitationService } from '../services/invitation.service'; // Ensure this path is correct
import { formatResponse } from '../utils/helpers';

export class InvitationController {
  // Create a new invitation
  static async createInvitation(req: AuthRequest, res: Response) {
    try {
      const { email, role } = req.body;
      const invitation = await InvitationService.createInvitation(req?.user?.id, email, role);
      res.status(201).json(invitation);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  // Accept an invitation
  static async acceptInvitation(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      const user = await InvitationService.acceptInvitation(token, password);
      res.status(200).json(user);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }

  // Decline an invitation
  static async declineInvitation(req: Request, res: Response) {
    try {
      const { token } = req.body;
      const invitation = await InvitationService.declineInvitation(token);
      res.status(200).json(invitation);
    } catch (error) {
        res.status(400).json(formatResponse(false, (error as Error).message));
    }
  }
}