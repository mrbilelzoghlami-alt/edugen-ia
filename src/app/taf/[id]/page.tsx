// src/app/taf/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { tafService } from "../../../services/tafService";
import ExerciseRenderer from "../../../components/exercises/ExerciseRenderer";

export default function ViewTAF() {
  const { id } = useParams();
  const router = useRouter();
  const [taf, setTaf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function fetchTAF() {
      const { data, error } = await supabase
        .from("tafs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        router.push("/dashboard");
        return;
      }
      setTaf(data);
      setLoading(false);

      // Marquer comme "en_cours" dès l'ouverture si pas encore terminé
      if (data.status === "créé") {
        tafService.updateStatus(data.id, "en_cours").catch(console.error);
      }
    }

    if (id) fetchTAF();
  }, [id, router]);

  // ── Callback quand l'enfant termine tous les exercices ─────────────────
  const handleComplete = async (score: number, total: number, answers: Record<number, string>) => {
    if (!taf) return;
    setSaving(true);
    try {
      const scoreGlobal = Math.round((score / total) * 20); // score sur 20
      const scoreDetail = { score, total, percentage: Math.round((score / total) * 100), answers };
      await tafService.saveScore(taf.id, scoreGlobal, scoreDetail);
      setCompleted(true);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du score:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Chargement ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-black text-slate-400">Chargement du TAF...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-slate-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b-4 border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-2xl text-slate-400 hover:text-purple-500 transition-colors"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-xl text-slate-800 truncate">{taf.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                taf.status === "terminé"
                  ? "bg-green-100 text-green-600"
                  : taf.status === "en_cours"
                  ? "bg-orange-100 text-orange-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {taf.status}
              </span>
              {taf.score_global > 0 && (
                <span className="text-xs font-bold text-blue-500">
                  Score précédent : {taf.score_global}/20
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Sauvegarde en cours */}
        {saving && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-md flex items-center justify-center z-50">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-black text-slate-700">Sauvegarde de ton score...</p>
            </div>
          </div>
        )}

        {/* Confirmation sauvegardé */}
        {completed && (
          <div className="mb-6 bg-green-100 border-2 border-green-400 text-green-800 p-4 rounded-2xl font-bold text-center text-sm">
            ✅ Score sauvegardé ! Ton parent peut maintenant voir tes résultats.
          </div>
        )}

        {/* Rendu des exercices */}
        {taf.content_json?.exercises ? (
          <ExerciseRenderer
            exercises={taf.content_json.exercises}
            maxAttempts={taf.attempts_left || 2}
            onComplete={handleComplete}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400 font-bold">
              Les exercices de ce TAF ne sont pas disponibles.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-purple-600 font-black underline"
            >
              Retour au dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
