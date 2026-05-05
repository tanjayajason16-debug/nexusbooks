// NexusBooks — Books Module
const Books = (() => {

  async function fetchBooks({ category, q, sort = 'trending', minPrice, maxPrice, page = 0, limit = 24 } = {}) {
    let query = supabaseClient
      .from('books')
      .select('*, profiles(username, avatar_url)')
      .eq('is_published', true)
      .range(page * limit, (page + 1) * limit - 1);

    if (category && category !== 'All') query = query.eq('category', category);
    if (q) query = query.ilike('title', `%${q}%`);
    if (minPrice != null) query = query.gte('price', minPrice);
    if (maxPrice != null) query = query.lte('price', maxPrice);

    switch (sort) {
      case 'newest':     query = query.order('created_at', { ascending: false }); break;
      case 'rating':     query = query.order('rating_avg', { ascending: false }); break;
      case 'price_asc':  query = query.order('price', { ascending: true }); break;
      case 'price_desc': query = query.order('price', { ascending: false }); break;
      default:           query = query.order('trending_score', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function fetchBook(id) {
    const { data, error } = await supabaseClient
      .from('books')
      .select('*, profiles(id, username, avatar_url, bio, total_sales)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchTrending(limit = 8) {
    const { data } = await supabaseClient
      .from('books')
      .select('*, profiles(username, avatar_url)')
      .eq('is_published', true)
      .order('trending_score', { ascending: false })
      .limit(limit);
    return data || [];
  }

  async function fetchNew(limit = 8) {
    const { data } = await supabaseClient
      .from('books')
      .select('*, profiles(username, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map(b => ({ ...b, is_new: true }));
  }

  async function fetchByCategory(category, limit = 8) {
    const { data } = await supabaseClient
      .from('books')
      .select('*, profiles(username, avatar_url)')
      .eq('is_published', true)
      .eq('category', category)
      .order('rating_avg', { ascending: false })
      .limit(limit);
    return data || [];
  }

  async function fetchSellerBooks(sellerId) {
    const { data, error } = await supabaseClient
      .from('books')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function uploadCover(file, bookId) {
    const ext = file.name.split('.').pop();
    const path = `${bookId}/cover.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKETS.covers).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(BUCKETS.covers).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadFile(file, bookId) {
    const ext = file.name.split('.').pop();
    const path = `${bookId}/book.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKETS.files).upload(path, file, { upsert: true });
    if (error) throw new Error('Failed to upload book file');
    const { data } = supabaseClient.storage.from(BUCKETS.files).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadPreview(file, bookId) {
    const ext = file.name.split('.').pop();
    const ownerId = Auth.user?.id || (await supabaseClient.auth.getSession()).data.session?.user.id;
    if (!ownerId) throw new Error('Not authenticated');
    const path = `${ownerId}/${bookId}.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKETS.previews).upload(path, file, { upsert: true });
    if (error) throw new Error('Failed to upload preview file');
    const { data } = supabaseClient.storage.from(BUCKETS.previews).getPublicUrl(path);
    return data.publicUrl;
  }

  async function createBook(bookData) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabaseClient
      .from('books')
      .insert({
        ...bookData,
        seller_id: session.user.id,
        is_published: bookData.is_published ?? false,
        rating_avg: 0,
        downloads: 0,
        trending_score: 0
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateBook(id, updates) {
    const { error } = await supabaseClient.from('books').update(updates).eq('id', id);
    if (error) throw error;
  }

  async function deleteBook(id) {
    const user = await Auth.requireSeller();
    if (!user) return;
    
    // Attempt to delete files from storage first
    const { data: book } = await supabaseClient.from('books').select('cover_url, file_url, preview_url').eq('id', id).single();
    if (book) {
      try {
        const coverPath = storagePathFromUrl(book.cover_url, BUCKETS.covers);
        if (coverPath) await supabaseClient.storage.from(BUCKETS.covers).remove([coverPath]);
        const filePath = storagePathFromUrl(book.file_url, BUCKETS.files);
        if (filePath) await supabaseClient.storage.from(BUCKETS.files).remove([filePath]);
        const previewPath = storagePathFromUrl(book.preview_url, BUCKETS.previews);
        if (previewPath) await supabaseClient.storage.from(BUCKETS.previews).remove([previewPath]);
      } catch (e) {
        console.warn('Failed to delete some storage files', e);
      }
    }

    const { error } = await supabaseClient.from('books').delete().eq('id', id);
    if (error) throw error;
  }

  function storagePathFromUrl(url, bucket) {
    if (!url) return null;
    const marker = `/${bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
  }

  async function fetchReviews(bookId) {
    const { data } = await supabaseClient
      .from('reviews')
      .select('*, profiles(username, avatar_url)')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async function submitReview(bookId, rating, body) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { error } = await supabaseClient.from('reviews').upsert({
      book_id: bookId, reviewer_id: session.user.id, rating, body
    });
    if (error) throw error;
    const { data: allReviews } = await supabaseClient.from('reviews').select('rating').eq('book_id', bookId);
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await supabaseClient.from('books').update({ rating_avg: avg }).eq('id', bookId);
  }

  async function hasPurchased(bookId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return false;
    const { data } = await supabaseClient.from('purchases')
      .select('id').eq('book_id', bookId).eq('buyer_id', session.user.id).single();
    return !!data;
  }

  async function fetchUserLibrary() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return [];
    const { data } = await supabaseClient
      .from('purchases')
      .select('*, books(*, profiles(username, avatar_url))')
      .eq('buyer_id', session.user.id)
      .order('created_at', { ascending: false });
    return (data || []).map(p => ({ ...p.books, purchase: p }));
  }

  async function getReadingProgress(bookId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data } = await supabaseClient.from('reading_sessions')
      .select('*').eq('book_id', bookId).eq('user_id', session.user.id).single();
    return data;
  }

  async function saveReadingProgress(bookId, lastPage, totalPages) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const progress = Math.round((lastPage / totalPages) * 100);
    await supabaseClient.from('reading_sessions').upsert({
      book_id: bookId, user_id: session.user.id, last_page: lastPage, progress_pct: progress, updated_at: new Date().toISOString()
    });
  }

  return {
    fetchBooks, fetchBook, fetchTrending, fetchNew, fetchByCategory,
    fetchSellerBooks, uploadCover, uploadFile, uploadPreview, createBook, updateBook, deleteBook,
    fetchReviews, submitReview, hasPurchased, fetchUserLibrary,
    getReadingProgress, saveReadingProgress,
  };
})();
