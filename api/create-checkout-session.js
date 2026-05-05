import Stripe from 'stripe';
import { getUserFromRequest, requireServerEnv, supabaseRest } from './_supabase.js';

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

    const user = await getUserFromRequest(req);
    const { bookId, successUrl, cancelUrl } = req.body || {};
    if (!bookId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing checkout parameters' });
    }

    const books = await supabaseRest(
      `books?id=eq.${encodeURIComponent(bookId)}&select=id,title,price,is_published`
    );
    const book = books?.[0];
    if (!book || !book.is_published) return res.status(404).json({ error: 'Book not found' });
    if (Number(book.price) <= 0) return res.status(400).json({ error: 'Book is free' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(book.price) * 100),
          product_data: {
            name: book.title,
            metadata: { book_id: book.id },
          },
        },
      }],
      metadata: {
        book_id: book.id,
        buyer_id: user.id,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not create checkout session' });
  }
}
