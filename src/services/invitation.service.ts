import { v4 as uuidv4 } from "uuid";
import { InvitationModel } from "../models/invitation.model"; // Ensure this path is correct
import { Organization } from "../models/organization.model";
import { UserModel } from "../models/user.model"; // Ensure this path is correct

export class InvitationService {
  // Create a new invitation
  async createInvitation(userId: string, email: string, role: string) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Set expiration date to 7 days from now

    const user = await UserModel.findById(userId).select("organization").lean();

    if (!user) {
      throw new Error("User not found");
    }

    const invitation = new InvitationModel({
      invitedBy: userId,
      organization: user.organization,
      email,
      role,
      token,
      expiresAt,
      status: "pending",
    });

    await invitation.save();
    return invitation;
  }

  // Find an invitation by token
  async findInvitationByToken(token: string) {
    return InvitationModel.findOne({ token });
  }

  // Accept an invitation
  async acceptInvitation(token: string, password: string) {
    const invitation = await InvitationModel.findOne({ token });

    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt < new Date()
    ) {
      throw new Error("Invalid or expired invitation");
    }

    const user = new UserModel({
      name: invitation.email.split("@")[0], // Default name from email
      email: invitation.email,
      password,
      role: invitation.role,
      organization: invitation.organization,
    });

    await user.save();

    invitation.status = "accepted";
    await invitation.save();

    return user;
  }

  // Decline an invitation
  async declineInvitation(token: string) {
    const invitation = await InvitationModel.findOne({ token });

    if (!invitation || invitation.status !== "pending") {
      throw new Error("Invalid invitation");
    }

    invitation.status = "declined";
    await invitation.save();

    return invitation;
  }

  // Get users and pending invitations by organization
  async getUsersAndInvitations(userId: string) {
    const userWithOrganization = await UserModel.findById(userId)
      .populate("organization")
      .lean();

    if (!userWithOrganization) {
      throw new Error("User not found");
    }

    if (!(userWithOrganization?.organization as Organization)?._id) {
      throw new Error("User does not belong to any organization");
    }

    const organizationId = (userWithOrganization.organization as Organization)
      ._id;

    const [users, invitations] = await Promise.all([
      UserModel.find({
        organization: organizationId,
        $or: [{ status: "active" }, { status: { $exists: false } }],
      })
        .select("name email role accessLevel organization createdAt updatedAt")
        .lean(),
      InvitationModel.find({
        organization: organizationId,
        status: "pending",
      }).lean(),
    ]);

    return { users, invitations };
  }
}
