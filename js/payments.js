// NexusBooks — Payments (Stripe) & Subscriptions
const Payments = (() => {
  let stripeInstance = null;

  function getStripe() {
    if (!stripeInstance) stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
    return stripeInstance;
  }

  // Single book purchase — redirects to Stripe Checkout
  async function buyBook(book) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = ROUTES.login; return; }

    UI.showToast('Redirecting to checkout…', 'info');

    // Store pending purchase in Supabase for webhook confirmation
    await supabaseClient.from('pending_purchases').insert({
      buyer_id: session.user.id,
      book_id: book.id,
      amount: book.price,
    });

    // In production this would call your backend /api/checkout
    // For demo: use Stripe Payment Links or direct Payment Intent
    const stripe = getStripe();
    const { error } = await stripe.redirectToCheckout({
      lineItems: [{ price: book.stripe_price_id, quantity: 1 }],
      mode: 'payment',
      successUrl: `${window.location.origin}/library.html?success=1&book=${book.id}`,
      cancelUrl: `${window.location.origin}/book.html?id=${book.id}`,
      customerEmail: session.user.email,
    });
    if (error) UI.showToast(error.message, 'error');
  }

  // Free book — insert purchase directly
  async function claimFree(bookId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = ROUTES.login; return; }
    const { error } = await supabaseClient.from('purchases').insert({
      buyer_id: session.user.id,
      book_id: bookId,
      amount: 0,
      allow_download: true,
      watermark_token: crypto.randomUUID(),
    });
    if (error) throw error;
    UI.showToast('Book added to your library!', 'success');
    setTimeout(() => window.location.href = ROUTES.library, 1200);
  }

  // Subscription
  async function subscribe() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = ROUTES.login; return; }
    const stripe = getStripe();
    const { error } = await stripe.redirectToCheckout({
      lineItems: [{ price: APP_CONFIG.subscriptionPriceId, quantity: 1 }],
      mode: 'subscription',
      successUrl: `${window.location.origin}/library.html?subscribed=1`,
      cancelUrl: `${window.location.origin}/index.html`,
      customerEmail: session.user.email,
    });
    if (error) UI.showToast(error.message, 'error');
  }

  async function checkSubscription() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data } = await supabaseClient.from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single();
    return data;
  }

  async function getSellerRevenue(sellerId) {
    const { data } = await supabaseClient.from('purchases')
      .select('amount, created_at, books(title)')
      .eq('books.seller_id', sellerId);
    const total = (data || []).reduce((sum, p) => sum + (p.amount * APP_CONFIG.sellerShare), 0);
    return { total, transactions: data || [] };
  }

  // Generate a signed (time-limited) download URL
  async function getDownloadUrl(bookId, fileUrl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    // Verify ownership
    const purchased = await Books.hasPurchased(bookId);
    const sub = await checkSubscription();
    if (!purchased && !sub) return null;

    // Extract storage path from public URL
    const pathMatch = fileUrl.match(/book-files\/(.+)/);
    if (!pathMatch) return fileUrl;
    const { data } = await supabaseClient.storage.from(BUCKETS.files)
      .createSignedUrl(pathMatch[1], 3600); // 1 hour expiry
    return data?.signedUrl || null;
  }

  return { buyBook, claimFree, subscribe, checkSubscription, getSellerRevenue, getDownloadUrl };
})();
