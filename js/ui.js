// NexusBooks — UI Helpers & Navbar
const UI = (() => {

  // ── Toast ──────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const colors = { info:'#06b6d4', success:'#10b981', error:'#f472b6', warning:'#f59e0b' };
    const t = document.createElement('div');
    t.className = 'nb-toast';
    t.style.cssText = `border-left:3px solid ${colors[type]}`;
    t.innerHTML = `<span>${message}</span>`;
    document.getElementById('toast-container')?.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
  }

  // ── Currency ───────────────────────────────────────────────
  function formatCurrency(amount) {
    if (!amount || amount == 0) return 'Free';
    return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(amount);
  }

  // ── Date ───────────────────────────────────────────────────
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }

  // ── Stars ──────────────────────────────────────────────────
  function renderStars(rating, max = 5) {
    let html = '<span class="stars">';
    for (let i = 1; i <= max; i++) {
      if (i <= Math.floor(rating)) html += '<span class="star filled">★</span>';
      else if (i - rating < 1) html += '<span class="star half">★</span>';
      else html += '<span class="star">☆</span>';
    }
    return html + `<span class="star-num">${(+rating).toFixed(1)}</span></span>`;
  }

  // ── Truncate ───────────────────────────────────────────────
  function truncate(str, len = 100) {
    return str && str.length > len ? str.slice(0, len) + '…' : str;
  }

  // ── Book Card ──────────────────────────────────────────────
  function renderBookCard(book, size = 'normal') {
    const cover = book.cover_url || 'https://via.placeholder.com/300x420/1a0533/8b5cf6?text=📚';
    const price = formatCurrency(book.price);
    return `
    <a href="book.html?id=${book.id}" class="book-card ${size === 'small' ? 'book-card--sm' : ''}">
      <div class="book-card__cover">
        <img src="${cover}" alt="${book.title}" loading="lazy" />
        <div class="book-card__overlay">
          <span class="btn btn--sm btn--glass">Quick Preview</span>
        </div>
        ${book.is_new ? '<span class="badge badge--new">NEW</span>' : ''}
        ${book.is_trending ? '<span class="badge badge--trend">🔥 TRENDING</span>' : ''}
      </div>
      <div class="book-card__info">
        <p class="book-card__category">${book.category || 'General'}</p>
        <h3 class="book-card__title">${truncate(book.title, 48)}</h3>
        <p class="book-card__author">by ${book.profiles?.username || 'Unknown'}</p>
        <div class="book-card__footer">
          ${renderStars(book.rating_avg || 0)}
          <span class="book-card__price">${price}</span>
        </div>
      </div>
    </a>`;
  }

  // ── Navbar ─────────────────────────────────────────────────
  function renderNavbar(activePage = '') {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    nav.innerHTML = `
    <div class="nav-inner">
      <a href="${ROUTES.home}" class="nav-logo">
        <span class="nav-logo__icon">📚</span>
        <span>Nexus<b>Books</b></span>
      </a>
      <form class="nav-search" id="nav-search-form" onsubmit="handleNavSearch(event)">
        <span class="nav-search__icon">🔍</span>
        <input type="search" id="nav-search-input" placeholder="Search books, topics, creators…" />
      </form>
      <nav class="nav-links">
        <a href="${ROUTES.browse}" class="${activePage==='browse'?'active':''}">Browse</a>
        <a href="${ROUTES.library}" class="${activePage==='library'?'active':''}">Library</a>
        <div class="nav-auth" id="nav-auth"></div>
      </nav>
      <button class="nav-mobile-toggle" onclick="toggleMobileNav()">☰</button>
    </div>`;
    updateNavAuth();
  }

  async function updateNavAuth() {
    const el = document.getElementById('nav-auth');
    if (!el) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profile } = await supabaseClient.from('profiles').select('username,avatar_url,is_seller').eq('id', session.user.id).single();
      el.innerHTML = `
        <div class="nav-avatar-menu">
          <img src="${profile?.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=user'}" class="nav-avatar" onclick="toggleAvatarMenu()" alt="Profile" />
          <div class="avatar-dropdown" id="avatar-dropdown">
            <div class="avatar-dropdown__header">
              <span>${profile?.username || 'User'}</span>
            </div>
            ${profile?.is_seller ? `<a href="${ROUTES.studio}">🎨 Creator Studio</a>` : `<a href="#" onclick="Auth.upgradeSeller()">✨ Become a Creator</a>`}
            <a href="${ROUTES.library}">📦 My Library</a>
            <a href="${ROUTES.profile}?id=${session.user.id}">👤 Profile</a>
            <hr />
            <a href="#" onclick="Auth.signOut()" class="logout">🚪 Sign Out</a>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <a href="${ROUTES.login}" class="btn btn--ghost">Log In</a>
        <a href="${ROUTES.signup}" class="btn btn--primary">Sign Up</a>`;
    }
  }

  // ── Scroll Animations ──────────────────────────────────────
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
  }

  // ── Loading spinner ────────────────────────────────────────
  function showLoader(containerId) {
    const c = document.getElementById(containerId);
    if (c) c.innerHTML = '<div class="loader"><div class="loader__ring"></div></div>';
  }

  function showError(containerId, msg = 'Something went wrong.') {
    const c = document.getElementById(containerId);
    if (c) c.innerHTML = `<div class="empty-state"><p class="text-muted">${msg}</p></div>`;
  }

  return { showToast, formatCurrency, formatDate, renderStars, renderBookCard, renderNavbar, updateNavAuth, initScrollAnimations, showLoader, showError, truncate };
})();

// ── Global helpers ─────────────────────────────────────────
function handleNavSearch(e) {
  e.preventDefault();
  const q = document.getElementById('nav-search-input').value.trim();
  if (q) window.location.href = `browse.html?q=${encodeURIComponent(q)}`;
}

function toggleAvatarMenu() {
  document.getElementById('avatar-dropdown')?.classList.toggle('open');
}

function toggleMobileNav() {
  document.querySelector('.nav-links')?.classList.toggle('mobile-open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-avatar-menu')) {
    document.getElementById('avatar-dropdown')?.classList.remove('open');
  }
});
