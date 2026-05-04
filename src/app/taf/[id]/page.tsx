// src/app/taf/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { tafService } from "../../../services/tafService";
import ExerciseRenderer from "../../../components/exercises/ExerciseRenderer";

const TYPE_LABELS: Record<string, string> = {
  qcm: "Choix Multiple", vraiFaux: "Vrai / Faux",
  saisie: "Saisie", ordre: "Remise en ordre", libre: "Réponse ouverte",
};

// ─── VUE RÉSULTATS LECTURE SEULE (parent + enfant après terminé) ──────────────
function ResultsView({ taf, role, onBack }: { taf: any; role: string; onBack: () => void }) {
  const exercises: any[] = taf.content_json?.exercises || [];
  const detail           = taf.score_detail as any;
  const answers: Record<string, string> = detail?.answers || {};
  const percentage       = detail?.percentage ?? 0;
  const score            = taf.score_global ?? 0;

  const color    = percentage >= 70 ? "text-green-500" : percentage >= 40 ? "text-orange-500" : "text-red-500";
  const barColor = percentage >= 70 ? "bg-green-400" : percentage >= 40 ? "bg-orange-400" : "bg-red-400";
  const message  = percentage >= 70 ? "Excellent ! 🏆" : percentage >= 40 ? "Pas mal ! 👍" : "À retravailler 💪";

  const groups: Record<string, any[]> = {};
  exercises.forEach((ex) => {
    if (!groups[ex.type]) groups[ex.type] = [];
    groups[ex.type].push(ex);
  });

  const isCorrect = (ex: any) => {
    const userAns  = answers[String(ex.id)] || "";
    const expected = Array.isArray(ex.answer)
      ? ex.answer.join(" ").toLowerCase().trim()
      : ex.answer.toLowerCase().trim();
    return expected === userAns.toLowerCase().trim();
  };

  return (
    <div className="space-y-6">
      {/* Score global */}
      <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 text-center shadow-sm">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
          {role === "parent" ? "Résultats de ton enfant" : "Mes résultats"}
        </p>
        <div className={`text-6xl font-black ${color}`}>{percentage}%</div>
        <p className="font-black text-2xl text-slate-700 mt-1">{score}/20</p>
        <p className="text-slate-500 font-bold mt-1">{message}</p>
        <div className="w-full bg-slate-100 rounded-full h-3 mt-4 overflow-hidden">
          <div className={`h-3 rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Détail par type */}
      {Object.entries(groups).map(([type, exs]) => {
        const correct = exs.filter((ex) => isCorrect(ex)).length;
        const allOk   = correct === exs.length;
        return (
          <div key={type} className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm">
            <div className={`px-5 py-3 flex items-center justify-between border-b-2 border-slate-100 ${allOk ? "bg-green-50" : "bg-red-50"}`}>
              <span className="font-black text-slate-700 text-sm">{TYPE_LABELS[type] || type}</span>
              <span className={`font-black text-sm ${allOk ? "text-green-600" : "text-red-500"}`}>
                {correct}/{exs.length} {allOk ? "✅" : "❌"}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {exs.map((ex, i) => {
                const userAns    = answers[String(ex.id)] || "—";
                const ok         = isCorrect(ex);
                const correctAns = Array.isArray(ex.answer) ? ex.answer.join(" ") : ex.answer;
                return (
                  <div key={ex.id} className="p-4 space-y-2">
                    <p className="font-bold text-slate-800 text-sm">Q{i+1}. {ex.question}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`text-xs px-3 py-1.5 rounded-xl font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {ok ? "✓" : "✗"} Ta réponse : {userAns}
                      </span>
                      {!ok && (
                        <span className="text-xs px-3 py-1.5 rounded-xl font-bold bg-green-100 text-green-700">
                          ✓ Correcte : {correctAns}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button onClick={onBack}
        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-3xl font-black uppercase transition-all">
        ← Retour
      </button>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function ViewTAF() {
  const { id } = useParams();
  const router = useRouter();

  const [taf, setTaf]               = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [role, setRole]             = useState<string | null>(null);
  const [needsAuth, setNeedsAuth]   = useState(false);
  const [pseudoInput, setPseudoInput] = useState("");
  const [authError, setAuthError]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const loadTAF = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from("tafs").select("*").eq("id", id).single();
    if (error || !data) { setNeedsAuth(true); setLoading(false); return; }
    setTaf(data);

    const r          = localStorage.getItem("edugen_role");
    const profileId  = localStorage.getItem("edugen_profile_id");
    const pseudoEnfant = localStorage.getItem("pseudo_enfant");
    setRole(r);

    const alreadyAuth =
      (r === "parent" && profileId === data.profile_id) ||
      (r === "enfant" && !!pseudoEnfant);

    if (alreadyAuth) {
      if (r === "enfant" && data.status === "créé") {
        tafService.updateStatus(data.id, "en_cours").catch(console.error);
      }
      setNeedsAuth(false);
    } else {
      setNeedsAuth(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadTAF(); }, [loadTAF]);

  const handleVerifyPseudo = async () => {
    if (!pseudoInput.trim()) return;
    setAuthLoading(true); setAuthError(null);
    try {
      const input = pseudoInput.trim().toLowerCase();
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo_enfant, pseudo_parent");
      const matched = (profiles || []).find(
        (p: any) => p.pseudo_enfant.toLowerCase() === input || p.pseudo_parent.toLowerCase() === input
      );
      if (!matched) { setAuthError("Pseudo incorrect. Demande à ton parent."); setAuthLoading(false); return; }
      const isEnfant = matched.pseudo_enfant.toLowerCase() === input;
      const isParent = matched.pseudo_parent.toLowerCase() === input;
      localStorage.setItem("edugen_profile_id", matched.id);
      localStorage.setItem("edugen_role", isParent ? "parent" : "enfant");
      if (isEnfant) localStorage.setItem("pseudo_enfant", matched.pseudo_enfant);
      if (isParent) localStorage.setItem("pseudo_parent", matched.pseudo_parent);
      setRole(isParent ? "parent" : "enfant");
      setNeedsAuth(false);
      await loadTAF();
    } catch { setAuthError("Erreur. Réessaie."); }
    finally { setAuthLoading(false); }
  };

  const handleComplete = async (score: number, total: number, answers: Record<number, string>) => {
    if (!taf) return;
    setSaving(true);
    try {
      const scoreGlobal = Math.round((score / total) * 20);
      const scoreDetail = { score, total, percentage: Math.round((score / total) * 100), answers };
      await tafService.saveScore(taf.id, scoreGlobal, scoreDetail);
      await loadTAF(); // Recharge → affiche ResultsView
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleBack = () => {
    const r = localStorage.getItem("edugen_role");
    router.push(r === "parent" ? "/dashboard" : "/enfant");
  };

  // ── Chargement ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Modal pseudo ────────────────────────────────────────────────────────
  if (needsAuth) return (
    <main className="bg-yellow-50 flex items-center justify-center min-h-screen p-4 font-sans text-black">
      <div className="bg-white rounded-3xl border-4 border-b-8 border-yellow-400 p-8 w-full max-w-sm shadow-xl text-center">
        <div className="text-6xl mb-4">🎒</div>
        <h1 className="text-2xl font-black text-slate-800 mb-1">Ton devoir t'attend !</h1>
        {taf?.title && (
          <p className="text-sm font-bold text-purple-600 bg-purple-50 px-3 py-2 rounded-xl mb-4 truncate">
            📚 {taf.title}
          </p>
        )}
        <p className="text-slate-500 font-bold text-sm mb-6">Saisis ton pseudo pour accéder.</p>
        {authError && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold">
            ⚠️ {authError}
          </div>
        )}
        <div className="space-y-4">
          <input type="text" placeholder="Ton pseudo..." autoFocus
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold text-center text-lg"
            value={pseudoInput} onChange={(e) => setPseudoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !authLoading && pseudoInput.trim() && handleVerifyPseudo()} />
          <button onClick={handleVerifyPseudo} disabled={!pseudoInput.trim() || authLoading}
            className="w-full bg-yellow-400 text-white font-black py-4 rounded-xl border-b-4 border-yellow-600 uppercase disabled:opacity-40 transition-all">
            {authLoading ? "Vérification..." : "Accéder 🚀"}
          </button>
        </div>
      </div>
    </main>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VUE PARENT → toujours lecture seule (résultats ou "pas encore terminé")
  // ══════════════════════════════════════════════════════════════════════════
  if (role === "parent") {
    return (
      <main className="bg-slate-50 min-h-screen pb-20 font-sans text-black">
        <div className="bg-white border-b-4 border-slate-100 p-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={handleBack} className="text-2xl text-slate-400 hover:text-purple-500">←</button>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-xl text-slate-800 truncate">{taf.title}</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Vue parent</p>
            </div>
            <button onClick={() => router.push(`/taf/${taf.id}/edit`)}
              className="bg-purple-100 text-purple-600 hover:bg-purple-500 hover:text-white px-3 py-2 rounded-xl font-black text-xs uppercase transition-all">
              ✏️ Éditer réponses
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-6">
          {taf.status === "terminé" ? (
            <ResultsView taf={taf} role="parent" onBack={handleBack} />
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="text-6xl">⏳</div>
              <p className="font-black text-slate-600 text-xl">
                {taf.status === "en_cours" ? "Devoir en cours..." : "Devoir pas encore commencé"}
              </p>
              <p className="text-slate-400 font-bold text-sm">
                L'enfant n'a pas encore terminé ce devoir.
              </p>
              <button onClick={handleBack}
                className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black uppercase text-sm transition-all hover:bg-slate-200">
                ← Retour au dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE ENFANT → résultats si terminé, exercices si en cours / créé
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <main className="bg-slate-50 min-h-screen pb-20 font-sans text-black">
      <div className="bg-white border-b-4 border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={handleBack} className="text-2xl text-slate-400 hover:text-purple-500">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-xl text-slate-800 truncate">{taf.title}</h1>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
              taf.status === "terminé"  ? "bg-green-100 text-green-600" :
              taf.status === "en_cours" ? "bg-orange-100 text-orange-600" :
                                          "bg-gray-100 text-gray-400"}`}>
              {taf.status}
            </span>
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

        {/* TAF terminé → afficher résultats */}
        {taf.status === "terminé" ? (
          <ResultsView taf={taf} role="enfant" onBack={handleBack} />

        /* TAF en cours ou créé → afficher les exercices */
        ) : taf.content_json?.exercises ? (
          <ExerciseRenderer
            exercises={taf.content_json.exercises}
            maxAttempts={taf.attempts_left || 2}
            onComplete={handleComplete}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400 font-bold">Exercices non disponibles.</p>
          </div>
        )}
      </div>
    </main>
  );
}
