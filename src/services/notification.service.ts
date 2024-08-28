import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { config } from '../utils/config';

sgMail.setApiKey(config.sendGridApiKey);
const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async sendEmail(to: string, subject: string, text: string): Promise<void> {
    const msg = {
      to,
      from: config.fromEmail,
      subject,
      text,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  public async sendSMS(to: string, body: string): Promise<void> {
    try {
      await twilioClient.messages.create({
        body,
        from: config.twilioPhoneNumber,
        to,
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error('Failed to send SMS');
    }
  }

  public async sendPhoneCall(to: string, message: string): Promise<void> {
    try {
      await twilioClient.calls.create({
        twiml: `<Response><Say>${message}</Say></Response>`,
        from: config.twilioPhoneNumber,
        to,
      });
    } catch (error) {
      console.error('Error making phone call:', error);
      throw new Error('Failed to make phone call');
    }
  }
}

export default NotificationService.getInstance();