// NexusBooks — Auth Module
const Auth = (() => {
  let currentUser = null;
  let currentProfile = null;

  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentProfile = await getProfile(session.user.id);
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
    return data;
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = ROUTES.home;
  }

  async function requireAuth(redirect = ROUTES.login) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = redirect; return null; }
    return session.user;
  }

  async function requireSeller() {
    const user = await requireAuth();
    if (!user) return null;
    const profile = await getProfile(user.id);
    if (!profile?.is_seller) { window.location.href = ROUTES.home; return null; }
    return { user, profile };
  }

  async function updateProfile(updates) {
    const user = await requireAuth();
    if (!user) return;
    const { error } = await supabaseClient.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
  }

  async function upgradeSeller() {
    await updateProfile({ is_seller: true });
    UI.showToast('You are now a creator!', 'success');
  }

  return { init, signUp, signIn, signOut, getProfile, requireAuth, requireSeller, updateProfile, upgradeSeller,
    get user() { return currentUser; },
    get profile() { return currentProfile; },
  };
})();
