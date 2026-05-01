import { Resend } from 'resend';

// REPLACE 're_xxxxxxxxx' WITH YOUR REAL RESEND API KEY!
// (In a real production app, use process.env.RESEND_API_KEY instead of hardcoding)
const resend = new Resend('re_SVvfQuGB_No2X6HJbofznL1b2zgHBGmaj');

export default async function handler(req, res) {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'tanjayajason16@gmail.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
    });
    
    // Respond with success
    res.status(200).json({ success: true, data });
  } catch (error) {
    // Respond with error
    res.status(400).json({ success: false, error });
  }
}
