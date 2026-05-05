import Stripe from 'stripe';
import { getUserFromRequest, requireServerEnv } from './_supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireServerEnv();
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
    if (!process.env.STRIPE_SUBSCRIPTION_PRICE_ID) throw new Error('Missing STRIPE_SUBSCRIPTION_PRICE_ID');

    const user = await getUserFromRequest(req);
    const { successUrl, cancelUrl } = req.body || {};
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing subscription parameters' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{ price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      metadata: {
        buyer_id: user.id,
        plan: 'pro',
      },
      subscription_data: {
        metadata: {
          buyer_id: user.id,
          plan: 'pro',
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not create subscription session' });
  }
}
