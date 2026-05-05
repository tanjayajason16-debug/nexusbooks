-- Run this file only if the original NexusBooks schema already exists.
-- It applies the security/policy changes without recreating existing tables.

-- Purchases should be unique per buyer/book so webhook upserts are safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchases_buyer_id_book_id_key'
      AND conrelid = 'public.purchases'::regclass
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_buyer_id_book_id_key UNIQUE (buyer_id, book_id);
  END IF;
END $$;

ALTER TABLE public.pending_purchases ENABLE ROW LEVEL SECURITY;

-- Replace unsafe purchase insert policy.
DROP POLICY IF EXISTS "System can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can claim free published books" ON public.purchases;
CREATE POLICY "Users can claim free published books" ON public.purchases
FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
  AND amount = 0
  AND stripe_payment_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = purchases.book_id
      AND books.is_published = true
      AND books.price = 0
  )
);

-- Pending purchases can only be prepared by the logged-in buyer for paid published books.
DROP POLICY IF EXISTS "Users can view own pending purchases" ON public.pending_purchases;
DROP POLICY IF EXISTS "Users can create own pending purchases" ON public.pending_purchases;
CREATE POLICY "Users can view own pending purchases" ON public.pending_purchases
FOR SELECT
USING (auth.uid() = buyer_id);

CREATE POLICY "Users can create own pending purchases" ON public.pending_purchases
FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
  AND amount > 0
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = pending_purchases.book_id
      AND books.is_published = true
      AND books.price = pending_purchases.amount
  )
);

-- Replace broad private file read/upload policies.
DROP POLICY IF EXISTS "Auth Private Read" ON storage.objects;
DROP POLICY IF EXISTS "Entitled Private Book File Read" ON storage.objects;
CREATE POLICY "Entitled Private Book File Read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'book-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.books
      WHERE books.id::text = (storage.foldername(name))[1]
        AND books.seller_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.purchases
      WHERE purchases.book_id::text = (storage.foldername(name))[1]
        AND purchases.buyer_id = auth.uid()
        AND purchases.allow_download = true
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.user_id = auth.uid()
        AND subscriptions.status = 'active'
        AND (
          subscriptions.current_period_end IS NULL
          OR subscriptions.current_period_end > now()
        )
    )
  )
);

DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Public Asset Upload" ON storage.objects;
DROP POLICY IF EXISTS "Seller Private Book File Upload" ON storage.objects;

CREATE POLICY "Authenticated Public Asset Upload" ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND bucket_id IN ('book-covers', 'book-previews', 'avatars')
);

CREATE POLICY "Seller Private Book File Upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'book-files'
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.seller_id = auth.uid()
  )
);
