-- ==========================================
-- NexusBooks Supabase Schema
-- ==========================================

-- 1. PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_seller BOOLEAN DEFAULT FALSE,
  total_sales INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. BOOKS
CREATE TABLE books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0.00,
  cover_url TEXT,
  file_url TEXT,
  preview_url TEXT,
  ai_summary TEXT,
  rating_avg DECIMAL(3,2) DEFAULT 0.00,
  downloads INTEGER DEFAULT 0,
  trending_score FLOAT DEFAULT 0.0,
  is_published BOOLEAN DEFAULT FALSE,
  stripe_price_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. PURCHASES
CREATE TABLE purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id TEXT,
  watermark_token UUID DEFAULT gen_random_uuid(),
  allow_download BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(buyer_id, book_id)
);

-- 4. REVIEWS
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(book_id, reviewer_id)
);

-- 5. READING SESSIONS (Progress tracking)
CREATE TABLE reading_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  last_page INTEGER DEFAULT 1,
  progress_pct INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, book_id)
);

-- 6. SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT,
  plan TEXT,
  status TEXT DEFAULT 'active',
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. PENDING PURCHASES (For Stripe Webhooks)
CREATE TABLE pending_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  book_id UUID REFERENCES books(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_purchases ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view, only owner can edit or insert
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Books: Anyone can view published, only seller can edit/delete
CREATE POLICY "Published books are viewable by everyone" ON books FOR SELECT USING (is_published = true);
CREATE POLICY "Sellers can view own books" ON books FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can insert own books" ON books FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own books" ON books FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own books" ON books FOR DELETE USING (auth.uid() = seller_id);

-- Purchases: Only buyer or seller of the book can view
CREATE POLICY "Users can view own purchases" ON purchases FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can view purchases of their books" ON purchases FOR SELECT USING (
  auth.uid() IN (SELECT seller_id FROM books WHERE id = purchases.book_id)
);
CREATE POLICY "Users can claim free published books" ON purchases FOR INSERT WITH CHECK (
  auth.uid() = buyer_id
  AND amount = 0
  AND stripe_payment_id IS NULL
  AND EXISTS (
    SELECT 1 FROM books
    WHERE books.id = purchases.book_id
      AND books.is_published = true
      AND books.price = 0
  )
);

-- Reviews: Anyone can view, only buyer can insert
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Reading Sessions: Only owner can view/edit
CREATE POLICY "Users can view own reading progress" ON reading_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own reading progress" ON reading_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own reading progress" ON reading_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Users can view own subscription
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Pending purchases: users can only prepare their own checkout for a published paid book.
-- Paid purchases should be finalized only by a server-side webhook using the service role key.
CREATE POLICY "Users can view own pending purchases" ON pending_purchases FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Users can create own pending purchases" ON pending_purchases FOR INSERT WITH CHECK (
  auth.uid() = buyer_id
  AND amount > 0
  AND EXISTS (
    SELECT 1 FROM books
    WHERE books.id = pending_purchases.book_id
      AND books.is_published = true
      AND books.price = pending_purchases.amount
  )
);

-- ==========================================
-- STORAGE POLICIES
-- ==========================================
-- Note: You must manually create these buckets in the Supabase Dashboard:
-- 1. book-covers (Public)
-- 2. book-files (Private)
-- 3. book-previews (Public)
-- 4. avatars (Public)

-- Allow public access to read files (except private book files)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('book-covers', 'book-previews', 'avatars'));

-- Private book files are readable only by the seller, buyers, or active subscribers.
CREATE POLICY "Entitled Private Book File Read" ON storage.objects FOR SELECT USING (
  bucket_id = 'book-files'
  AND (
    EXISTS (
      SELECT 1 FROM books
      WHERE books.id::text = (storage.foldername(name))[1]
        AND books.seller_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.book_id::text = (storage.foldername(name))[1]
        AND purchases.buyer_id = auth.uid()
        AND purchases.allow_download = true
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.user_id = auth.uid()
        AND subscriptions.status = 'active'
        AND (subscriptions.current_period_end IS NULL OR subscriptions.current_period_end > NOW())
    )
  )
);

-- Public asset buckets can be written by authenticated users.
CREATE POLICY "Authenticated Public Asset Upload" ON storage.objects FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND bucket_id IN ('book-covers', 'book-previews', 'avatars')
);

-- Full book files can only be uploaded by the seller who owns the matching book id folder.
CREATE POLICY "Seller Private Book File Upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'book-files'
  AND EXISTS (
    SELECT 1 FROM books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.seller_id = auth.uid()
  )
);

-- Allow users to update their own files
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (auth.uid() = owner);

-- Allow users to delete their own files
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (auth.uid() = owner);
