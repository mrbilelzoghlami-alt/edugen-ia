import { supabase } from '../lib/supabaseClient';

export const tafService = {

  // ─── LECTURE ────────────────────────────────────────────────
  async getTafsByProfile(profileId: string) {
    const { data, error } = await supabase
      .from('tafs')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getTafById(tafId: string) {
    const { data, error } = await supabase
      .from('tafs')
      .select('*')
      .eq('id', tafId)
      .single();

    if (error) throw error;
    return data;
  },

  // ─── MISE À JOUR STATUT ──────────────────────────────────────
  async updateStatus(tafId: string, status: 'en_cours' | 'terminé') {
    const { error } = await supabase
      .from('tafs')
      .update({
        status,
        last_activity: new Date().toISOString()
      })
      .eq('id', tafId);

    if (error) throw error;
  },

  // ─── SAUVEGARDE SCORE FINAL ──────────────────────────────────
  async saveScore(tafId: string, scoreGlobal: number, scoreDetail: object) {
    const { error } = await supabase
      .from('tafs')
      .update({
        score_global: scoreGlobal,
        score_detail: scoreDetail,
        status: 'terminé',
        last_activity: new Date().toISOString()
      })
      .eq('id', tafId);

    if (error) throw error;
  },

  // ─── SAUVEGARDE RÉPONSES INTERMÉDIAIRES (reprise possible) ───
  async saveAnswers(tafId: string, answers: object) {
    const { error } = await supabase
      .from('tafs')
      .update({
        score_detail: answers,
        status: 'en_cours',
        last_activity: new Date().toISOString()
      })
      .eq('id', tafId);

    if (error) throw error;
  }
};
