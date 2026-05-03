// src/services/tafService.ts — version avec notification
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

  // ─── NOMBRE DE TAFs NON LUS (pastille parent) ───────────────
  async getUnreadCount(profileId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tafs')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('status', 'terminé')
      .eq('parent_notified', false);
    if (error) return 0;
    return count ?? 0;
  },

  // ─── MARQUER COMME LU (parent a vu la notif) ────────────────
  async markAllAsRead(profileId: string) {
    await supabase
      .from('tafs')
      .update({ parent_notified: true })
      .eq('profile_id', profileId)
      .eq('status', 'terminé');
  },

  // ─── MISE À JOUR STATUT ──────────────────────────────────────
  async updateStatus(tafId: string, status: 'en_cours' | 'terminé') {
    const { error } = await supabase
      .from('tafs')
      .update({ status, last_activity: new Date().toISOString() })
      .eq('id', tafId);
    if (error) throw error;
  },

  // ─── SAUVEGARDE SCORE + DÉCLENCHEMENT NOTIFICATION ──────────
  async saveScore(tafId: string, scoreGlobal: number, scoreDetail: object) {
    const { error } = await supabase
      .from('tafs')
      .update({
        score_global: scoreGlobal,
        score_detail: scoreDetail,
        status: 'terminé',
        last_activity: new Date().toISOString(),
        parent_notified: false, // reset → déclenche la pastille
      })
      .eq('id', tafId);
    if (error) throw error;

    // Appel de l'API route pour envoyer l'email
    try {
      await fetch('/api/notify-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tafId }),
      });
    } catch (err) {
      // Email non bloquant — le score est déjà sauvegardé
      console.error('Notification email échouée (non bloquant):', err);
    }
  },

  // ─── SAUVEGARDE RÉPONSES INTERMÉDIAIRES ─────────────────────
  async saveAnswers(tafId: string, answers: object) {
    const { error } = await supabase
      .from('tafs')
      .update({
        score_detail: answers,
        status: 'en_cours',
        last_activity: new Date().toISOString(),
      })
      .eq('id', tafId);
    if (error) throw error;
  },
};
