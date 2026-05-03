import { supabase } from '../lib/supabaseClient';

export const authService = {

  // ─── INSCRIPTION ────────────────────────────────────────────
  async registerParent(pseudoParent: string, emailParent: string, pseudoEnfant: string) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        pseudo_parent: pseudoParent,
        email_parent: emailParent,
        pseudo_enfant: pseudoEnfant
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Cet email est déjà utilisé pour un compte.");
      throw new Error(error.message);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('edugen_profile_id', data.id);
      localStorage.setItem('pseudo_parent', data.pseudo_parent);
      localStorage.setItem('edugen_role', 'parent');
    }
    return data;
  },

  // ─── CONNEXION PARENT ────────────────────────────────────────
  async loginByParentPseudo(pseudo: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('pseudo_parent', pseudo)
      .single();

    if (error || !data) {
      throw new Error("Pseudo parent introuvable. Vérifie l'orthographe ou crée un compte.");
    }
    return data;
  },

  // ─── CONNEXION ENFANT ────────────────────────────────────────
  async loginByChildPseudo(pseudo: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('pseudo_enfant', pseudo)
      .single();

    if (error || !data) {
      throw new Error("Pseudo enfant introuvable. Demande à ton parent de vérifier.");
    }
    return data;
  },

  // ─── RÉCUPÉRATION PSEUDO VIA EMAIL ──────────────────────────
  async recoverPseudo(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('pseudo_parent, pseudo_enfant')
      .eq('email_parent', email)
      .single();

    if (error || !data) {
      throw new Error("Aucun compte trouvé pour cet email.");
    }
    return data;
  },

  // ─── DÉCONNEXION ────────────────────────────────────────────
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('edugen_profile_id');
      localStorage.removeItem('pseudo_parent');
      localStorage.removeItem('pseudo_enfant');
      localStorage.removeItem('edugen_role');
    }
  }
};
