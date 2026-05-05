// NexusBooks payments and subscriptions
const Payments = (() => {
  async function postJson(url, body, accessToken) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  async function buyBook(book) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = ROUTES.login; return; }

    UI.showToast('Redirecting to checkout...', 'info');
    try {
      const { url } = await postJson('/api/create-checkout-session', {
        bookId: book.id,
        successUrl: `${window.location.origin}/library.html?success=1&book=${book.id}`,
        cancelUrl: `${window.location.origin}/book.html?id=${book.id}`,
      }, session.access_token);
      window.location.href = url;
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
  }

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

  async function subscribe() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = ROUTES.login; return; }
    try {
      const { url } = await postJson('/api/create-subscription-session', {
        successUrl: `${window.location.origin}/library.html?subscribed=1`,
        cancelUrl: `${window.location.origin}/index.html`,
      }, session.access_token);
      window.location.href = url;
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
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

  async function getDownloadUrl(bookId, fileUrl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const purchased = await Books.hasPurchased(bookId);
    const sub = await checkSubscription();
    if (!purchased && !sub) return null;

    const pathMatch = fileUrl.match(/book-files\/(.+)/);
    if (!pathMatch) return fileUrl;
    const { data } = await supabaseClient.storage.from(BUCKETS.files)
      .createSignedUrl(pathMatch[1].split('?')[0], 3600);
    return data?.signedUrl || null;
  }

  return { buyBook, claimFree, subscribe, checkSubscription, getSellerRevenue, getDownloadUrl };
})();
