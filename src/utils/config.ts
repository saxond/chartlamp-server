export const config = {
  sendGridApiKey: process.env.SENDGRID_API_KEY as string,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID as string,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN as string,
  fromEmail: process.env.FROM_EMAIL as string,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER as string,
};