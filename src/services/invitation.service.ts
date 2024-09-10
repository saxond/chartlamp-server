import { v4 as uuidv4 } from 'uuid';
import { InvitationModel } from '../models/invitation.model'; // Ensure this path is correct
import { User, UserModel } from '../models/user.model'; // Ensure this path is correct

export class InvitationService {
  // Create a new invitation
  static async createInvitation(invitedBy: User["_id"], email: string, role: string) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Set expiration date to 7 days from now

    const organization = await UserModel.findById(invitedBy).select('organization').lean();

    const invitation = new InvitationModel({
      invitedBy,
      organization,
      email,
      role,
      token,
      expiresAt,
      status: 'pending',
    });

    await invitation.save();
    return invitation;
  }

  // Find an invitation by token
  static async findInvitationByToken(token: string) {
    return InvitationModel.findOne({ token });
  }

  // Accept an invitation
  static async acceptInvitation(token: string, password: string) {
    const invitation = await InvitationModel.findOne({ token });

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      throw new Error('Invalid or expired invitation');
    }

    const user = new UserModel({
      name: invitation.email.split('@')[0], // Default name from email
      email: invitation.email,
      password,
      role: invitation.role,
      organization: invitation.organization,
    });

    await user.save();

    invitation.status = 'accepted';
    await invitation.save();

    return user;
  }

  // Decline an invitation
  static async declineInvitation(token: string) {
    const invitation = await InvitationModel.findOne({ token });

    if (!invitation || invitation.status !== 'pending') {
      throw new Error('Invalid invitation');
    }

    invitation.status = 'declined';
    await invitation.save();

    return invitation;
  }
}