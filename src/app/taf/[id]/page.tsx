// src/app/taf/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { tafService } from "../../../services/tafService";
import ExerciseRenderer from "../../../components/exercises/ExerciseRenderer";

export default function ViewTAF() {
  const { id } = useParams();
  const router  = useRouter();

  const [taf, setTaf]         = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [completed, setCompleted] = useState(false);

  // ── Vérification pseudo ──────────────────────────────────────────────────
  const [needsAuth, setNeedsAuth]       = useState(false);
  const [pseudoInput, setPseudoInput]   = useState("");
  const [authError, setAuthError]       = useState<string | null>(null);
  const [authLoading, setAuthLoading]   = useState(false);

  // ── Chargement du TAF ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    async function fetchTAF() {
      const { data, error } = await supabase
        .from("tafs")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        router.push("/login");
        return;
      }

      setTaf(data);

      // ── Vérifier si l'enfant est déjà identifié ────────────────────────
      const role      = localStorage.getItem("edugen_role");
      const profileId = localStorage.getItem("edugen_profile_id");
      const pseudoEnfant = localStorage.getItem("pseudo_enfant");

      const alreadyAuth =
        // Cas 1 : connecté en tant que parent propriétaire du TAF
        (role === "parent" && profileId === data.profile_id) ||
        // Cas 2 : connecté en tant qu'enfant avec pseudo connu
        (role === "enfant" && !!pseudoEnfant);

      if (alreadyAuth) {
        // Marquer en_cours si première ouverture
        if (data.status === "créé") {
          tafService.updateStatus(data.id, "en_cours").catch(console.error);
        }
        setLoading(false);
      } else {
        // Pas identifié → afficher le modal de vérification
        setNeedsAuth(true);
        setLoading(false);
      }
    }

    fetchTAF();
  }, [id, router]);

  // ── Vérification du pseudo saisi ─────────────────────────────────────────
  const handleVerifyPseudo = async () => {
    if (!pseudoInput.trim() || !taf) return;
    setAuthLoading(true);
    setAuthError(null);

    try {
      // Cherche le profil propriétaire du TAF
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, pseudo_enfant, pseudo_parent")
        .eq("id", taf.profile_id)
        .single();

      if (error || !profile) {
        setAuthError("Devoir introuvable. Demande le lien à nouveau.");
        setAuthLoading(false);
        return;
      }

      const input = pseudoInput.trim().toLowerCase();
      const isEnfant = profile.pseudo_enfant.toLowerCase() === input;
      const isParent = profile.pseudo_parent.toLowerCase() === input;

      if (isEnfant || isParent) {
        // ✅ Identifié → sauvegarder dans localStorage
        localStorage.setItem("edugen_profile_id", profile.id);
        localStorage.setItem("edugen_role", isParent ? "parent" : "enfant");
        if (isEnfant) localStorage.setItem("pseudo_enfant", profile.pseudo_enfant);
        if (isParent) localStorage.setItem("pseudo_parent", profile.pseudo_parent);

        // Marquer en_cours
        if (taf.status === "créé") {
          await tafService.updateStatus(taf.id, "en_cours").catch(console.error);
        }
        setNeedsAuth(false);
      } else {
        setAuthError("Pseudo incorrect. Demande à ton parent quel pseudo il t'a donné.");
      }
    } catch {
      setAuthError("Une erreur est survenue. Réessaie.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Score final ───────────────────────────────────────────────────────────
  const handleComplete = async (score: number, total: number, answers: Record<number, string>) => {
    if (!taf) return;
    setSaving(true);
    try {
      const scoreGlobal  = Math.round((score / total) * 20);
      const scoreDetail  = { score, total, percentage: Math.round((score / total) * 100), answers };
      await tafService.saveScore(taf.id, scoreGlobal, scoreDetail);
      setCompleted(true);
    } catch (err) {
      console.error("Erreur sauvegarde score:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Chargement ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Modal vérification pseudo ─────────────────────────────────────────────
  if (needsAuth) {
    return (
      <main className="bg-yellow-50 flex items-center justify-center min-h-screen p-4 font-sans text-black">
        <div className="bg-white rounded-3xl border-4 border-b-8 border-yellow-400 p-8 w-full max-w-sm shadow-xl text-center">

          <div className="text-6xl mb-4">🎒</div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">Ton devoir t'attend !</h1>
          {taf?.title && (
            <p className="text-sm font-bold text-purple-600 bg-purple-50 px-3 py-2 rounded-xl mb-4 truncate">
              📚 {taf.title}
            </p>
          )}
          <p className="text-slate-500 font-bold text-sm mb-6">
            Saisis ton pseudo pour accéder à ce devoir.
          </p>

          {authError && (
            <div className="bg-red-100 border-2 border-red-400 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold">
              ⚠️ {authError}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Ton pseudo..."
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold text-center text-lg transition-colors"
              value={pseudoInput}
              onChange={(e) => setPseudoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !authLoading && pseudoInput.trim() && handleVerifyPseudo()}
              autoFocus
            />
            <button
              onClick={handleVerifyPseudo}
              disabled={!pseudoInput.trim() || authLoading}
              className="w-full bg-yellow-400 text-white font-black py-4 rounded-xl border-b-4 border-yellow-600 uppercase disabled:opacity-40 transition-all active:border-b-0 active:translate-y-1"
            >
              {authLoading ? "Vérification..." : "Accéder au devoir 🚀"}
            </button>
          </div>

          <p className="text-xs text-slate-300 font-bold mt-6">
            Ton pseudo t'a été donné par ton parent.<br />
            Problème ? Demande-lui de vérifier.
          </p>
        </div>
      </main>
    );
  }

  // ── Vue du TAF ────────────────────────────────────────────────────────────
  return (
    <main className="bg-slate-50 min-h-screen pb-20">

      {/* Header */}
      <div className="bg-white border-b-4 border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => {
              const role = localStorage.getItem("edugen_role");
              router.push(role === "parent" ? "/dashboard" : "/enfant");
            }}
            className="text-2xl text-slate-400 hover:text-purple-500 transition-colors"
          >←</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-xl text-slate-800 truncate">{taf.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                taf.status === "terminé"   ? "bg-green-100 text-green-600" :
                taf.status === "en_cours"  ? "bg-orange-100 text-orange-600" :
                                             "bg-gray-100 text-gray-400"
              }`}>
                {taf.status}
              </span>
              {taf.score_global > 0 && (
                <span className="text-xs font-bold text-blue-500">
                  Score : {taf.score_global}/20
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">

        {/* Overlay sauvegarde */}
        {saving && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-md flex items-center justify-center z-50">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-black text-slate-700">Sauvegarde du score...</p>
            </div>
          </div>
        )}

        {/* Confirmation sauvegarde */}
        {completed && (
          <div className="mb-6 bg-green-100 border-2 border-green-400 text-green-800 p-4 rounded-2xl font-bold text-center text-sm">
            ✅ Score sauvegardé ! Ton parent peut voir tes résultats.
          </div>
        )}

        {/* Exercices */}
        {taf.content_json?.exercises ? (
          <ExerciseRenderer
            exercises={taf.content_json.exercises}
            maxAttempts={taf.attempts_left || 2}
            onComplete={handleComplete}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400 font-bold">Les exercices ne sont pas disponibles.</p>
            <button onClick={() => router.push("/dashboard")} className="mt-4 text-purple-600 font-black underline">
              Retour
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
