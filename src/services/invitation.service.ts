import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { InvitationModel } from "../models/invitation.model"; // Ensure this path is correct
import { Organization } from "../models/organization.model";
import { User, UserModel } from "../models/user.model"; // Ensure this path is correct
import notificationService from "./notification.service";

export class InvitationService {
  private notificationService = notificationService;

  // Create a new invitation
  async createInvitation(userId: string, email: string, role: string) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Set expiration date to 7 days from now

    const user = await UserModel.findById(userId)
      // .select("organization")
      .populate<{ organization: Organization }>("organization")
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    const inviteExists = await InvitationModel.findOne({
      email,
    }).lean();

    if (inviteExists) {
      throw new Error("User already invited");
    }

    const invitation = new InvitationModel({
      invitedBy: userId,
      organization: user.organization._id,
      email,
      role,
      token,
      expiresAt,
      status: "pending",
    });

    await invitation.save();
    const url = `${process.env.FRONTEND_URL}/auth/signup?token=${token}`;
    await this.notificationService.sendEmailV2(
      email,
      "You have been invited to Chartlamp",
      `<p>Hello,</p>
          <p>You have been invited to chartlmp by <strong>${
            user.name
          }</strong>.</p>
          <p>Your invitation will expire on <strong>${invitation.expiresAt.toDateString()}</strong>.</p>
          <p>To  accept the invitation, please click the link below:</p>
          <p><a href="${url}" style="color: #007bff; text-decoration: none;">Accept Invitation</a></p>
          <p>Thank you,</p>
          <p>Chartlamp</p>
        `
    );

    return invitation;
  }

  async sendInvitationReminder(email: string) {
    const invite = await InvitationModel.findOne({
      email,
      status: "pending",
    })
      .populate<{ invitedBy: User }>("invitedBy")
      .lean();

    if (!invite) throw new Error("Invite not found or expired");

    let updatedExpiration = new Date(invite.expiresAt);

    // If the invite has expired, extend it by 3 days
    if (new Date() > invite.expiresAt) {
      updatedExpiration = new Date();
      updatedExpiration.setDate(updatedExpiration.getDate() + 3);

      await InvitationModel.updateOne(
        { _id: invite._id },
        { expiresAt: updatedExpiration }
      );
    }
    const url = `${process.env.FRONTEND_URL}/auth/signup?token=${invite.token}`;

    await this.notificationService.sendEmailV2(
      invite.email,
      "Reminder: Invitation to Join Chartlamp",
      `<p>Hello,</p>
     <p>This is a friendly reminder that you have been invited to <strong>Chartlamp</strong> by ${
       invite.invitedBy.name
     }.</p>
     <p>Your invitation will expire on <strong>${invite.expiresAt.toDateString()}</strong>.</p>
     <p>Please accept the invitation before it expires by clicking the link below:</p>
     <p><a href="${url}" style="color: #007bff; text-decoration: none;">Accept Invitation</a></p>
     <p>Thank you,</p>
     <p>Chartlamp</p>
    `
    );

    return true;
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
    const hashedPass = await bcrypt.hash(password, 10);
    const user = new UserModel({
      name: invitation.email.split("@")[0], // Default name from email
      email: invitation.email,
      password: hashedPass,
      role: invitation.role,
      organization: invitation.organization,
    });

    await user.save();

    invitation.status = "accepted";
    await invitation.save();

    // await this.notificationService.sendEmailV2(
    //   invitation.email,
    //   "You have been invited to Chartlamp",
    //   `<p>Hello,</p>
    //   <p>You have been invited to chartlmp by <strong>${user.organization.name}</strong>.</p>
    //   <p>To  accept the invitation, please click the link below:</p>
    //   <p><a href="${url}" style="color: #007bff; text-decoration: none;">Accept Invitation</a></p>
    //   <p>Thank you,</p>
    //   <p>Chartlamp</p>
    // `
    // );

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

    if (userWithOrganization.role !== "admin") {
      const [users, invitations] = await Promise.all([
        UserModel.find({
          organization: organizationId,
          $or: [{ status: "active" }, { status: { $exists: false } }],
        })
          .select(
            "name email role accessLevel organization createdAt updatedAt"
          )
          .lean(),
        InvitationModel.find({
          organization: organizationId,
          status: "pending",
        }).lean(),
      ]);

      return { users, invitations };
    } else {
      const [users, invitations] = await Promise.all([
        UserModel.find({})
          .select(
            "name email role accessLevel organization createdAt updatedAt"
          )
          .lean(),
        InvitationModel.find({
          status: "pending",
        }).lean(),
      ]);

      return { users, invitations };
    }
  }
}
