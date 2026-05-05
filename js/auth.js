// NexusBooks — Auth Module
const Auth = (() => {
  let currentUser = null;
  let currentProfile = null;

  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentProfile = await getProfile(session.user.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user ?? null;
      currentProfile = currentUser ? await getProfile(currentUser.id) : null;
      UI.updateNavAuth();
    });
    return { user: currentUser, profile: currentProfile };
  }

  async function getProfile(userId) {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    return data;
  }

  async function signUp(email, password, username, isSeller = false) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    await supabaseClient.from('profiles').insert({
      id: data.user.id,
      username,
      email,
      is_seller: isSeller,
      avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${username}`,
    });
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    currentProfile = data.user ? await getProfile(data.user.id) : null;
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
      : await getProfile(session.user.id);
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
