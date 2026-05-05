import Stripe from 'stripe';
import { requireServerEnv, supabaseRest } from './_supabase.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function recordBookPurchase(session) {
  const bookId = session.metadata?.book_id;
  const buyerId = session.metadata?.buyer_id;
  if (!bookId || !buyerId) return;

  await supabaseRest('purchases?on_conflict=buyer_id,book_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      buyer_id: buyerId,
      book_id: bookId,
      amount: (session.amount_total || 0) / 100,
      stripe_payment_id: session.payment_intent,
      allow_download: true,
    }),
  });
}

async function recordSubscription(session) {
  const buyerId = session.metadata?.buyer_id;
  if (!buyerId || !session.subscription) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  await supabaseRest('subscriptions', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: buyerId,
      stripe_subscription_id: subscription.id,
      plan: session.metadata?.plan || 'pro',
      status: subscription.status,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  try {
    requireServerEnv();
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

    const signature = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      await readRawBody(req),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'payment') await recordBookPurchase(session);
      if (session.mode === 'subscription') await recordSubscription(session);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(400).send(error.message || 'Webhook error');
  }
}
