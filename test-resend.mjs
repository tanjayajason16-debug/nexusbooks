import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY environment variable.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    console.log('Sending email...');
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'tanjayajason16@gmail.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
    });
    console.log('Success:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
