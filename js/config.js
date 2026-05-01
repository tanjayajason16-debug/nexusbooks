// ============================================================
//  NexusBooks — Core Configuration
//  Replace placeholder values with your real keys before use
// ============================================================

// --- Supabase ---
const SUPABASE_URL = 'https://mbccojoeppruespghlne.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iY2Nvam9lcHBydWVzcGdobG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzQ0OTksImV4cCI6MjA5MzIxMDQ5OX0.45lW0vU1b5pACy9NgHvhSqIFd8cDRx2CM8gviIdUT08';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Stripe ---
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_KEY';

// --- Gemini AI ---
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- App Constants ---
const APP_CONFIG = {
  name: 'NexusBooks',
  tagline: 'The marketplace for digital knowledge.',
  platformFee: 0.20,
  sellerShare: 0.80,
  defaultPreviewPages: 10,
  subscriptionPrice: 9.99,
  subscriptionPriceId: 'price_YOUR_STRIPE_PRICE_ID',
  currency: 'usd',
  currencySymbol: '$',
  categories: [
    'All', 'Student Notes', 'Coding', 'Design', 'Hacking & Security',
    'Business', 'AI & Machine Learning', 'Fiction', 'Self Help',
    'Science', 'Mathematics', 'Languages', 'Other'
  ],
  sortOptions: [
    { value: 'trending', label: 'Trending' },
    { value: 'newest',   label: 'Newest' },
    { value: 'rating',   label: 'Top Rated' },
    { value: 'price_asc',  label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
  ],
};

// --- Storage Bucket Names ---
const BUCKETS = {
  covers:   'book-covers',
  files:    'book-files',
  previews: 'book-previews',
  avatars:  'avatars',
};

// --- Routes ---
const ROUTES = {
  home:     'index.html',
  browse:   'browse.html',
  book:     'book.html',
  login:    'login.html',
  signup:   'signup.html',
  studio:   'studio.html',
  library:  'library.html',
  profile:  'profile.html',
};
