// NexusBooks — Auth Module
const Auth = (() => {
  let currentUser = null;
  let currentProfile = null;

  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentProfile = await ensureProfile(session.user);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user ?? null;
      currentProfile = currentUser ? await ensureProfile(currentUser) : null;
      UI.updateNavAuth();
    });
    return { user: currentUser, profile: currentProfile };
  }

  async function getProfile(userId) {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data;
  }

  async function ensureProfile(user, defaults = {}) {
    if (!user) return null;
    const existing = await getProfile(user.id);
    if (existing) return existing;

    const usernameBase = defaults.username || user.email?.split('@')[0] || 'user';
    const fallbackUsername = usernameBase.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user';
    const profile = {
      id: user.id,
      username: fallbackUsername,
      email: user.email,
      is_seller: defaults.isSeller ?? false,
      avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(fallbackUsername)}`,
    };
    const { data, error } = await supabaseClient
      .from('profiles')
      .insert(profile)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, username, isSeller = false) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await ensureProfile(data.user, { username, isSeller });
    }
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    currentProfile = data.user ? await ensureProfile(data.user) : null;
    return data;
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = ROUTES.home;
  }

  async function requireAuth(redirect = ROUTES.login) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      currentUser = null;
      currentProfile = null;
      window.location.href = redirect;
      return null;
    }
    currentUser = session.user;
    currentProfile = currentProfile?.id === session.user.id
      ? currentProfile
      : await ensureProfile(session.user);
    return currentUser;
  }

  async function requireSeller() {
    const user = await requireAuth();
    if (!user) return null;
    const profile = currentProfile || await getProfile(user.id);
    currentProfile = profile;
    if (!profile?.is_seller) { window.location.href = ROUTES.home; return null; }
    return { user, profile };
  }

  async function updateProfile(updates) {
    const user = await requireAuth();
    if (!user) return;
    const { error } = await supabaseClient.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    currentProfile = { ...currentProfile, ...updates };
  }

  async function uploadAvatar(file) {
    const user = await requireAuth();
    if (!user) return;
    
    const ext = file.name.split('.').pop();
    const path = `${user.id}.${ext}`;
    
    const { error } = await supabaseClient.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw new Error('Failed to upload avatar');
    
    const { data } = supabaseClient.storage.from('avatars').getPublicUrl(path);
    // Add a cache buster so the image refreshes instantly
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
    
    await updateProfile({ avatar_url: avatarUrl });
    return avatarUrl;
  }

  async function upgradeSeller() {
    await updateProfile({ is_seller: true });
    UI.showToast('You are now a creator!', 'success');
  }

  return { init, signUp, signIn, signOut, getProfile, requireAuth, requireSeller, updateProfile, uploadAvatar, upgradeSeller,
    get user() { return currentUser; },
    get profile() { return currentProfile; },
  };
})();
