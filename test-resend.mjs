import { Resend } from 'resend';

const resend = new Resend('re_SVvfQuGB_No2X6HJbofznL1b2zgHBGmaj');

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
