// src/app/taf/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

const TYPE_LABELS: Record<string, string> = {
  qcm: "Choix Multiple",
  vraiFaux: "Vrai / Faux",
  saisie: "Saisie",
  ordre: "Remise en ordre",
  libre: "Réponse ouverte",
};

export default function EditTAF() {
  const { id } = useParams();
  const router  = useRouter();

  const [taf, setTaf]           = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!id) return;
    const role = localStorage.getItem("edugen_role");
    if (role !== "parent") { router.push("/dashboard"); return; }

    supabase.from("tafs").select("*").eq("id", id).single()
      .then(({ data, error }) => {
        if (error || !data) { router.push("/dashboard"); return; }
        setTaf(data);
        setExercises(data.content_json?.exercises || []);
        setLoading(false);
      });
  }, [id, router]);

  // ── Début d'édition d'une réponse ────────────────────────────────────────
  const startEdit = (ex: any) => {
    setEditingId(ex.id);
    const current = Array.isArray(ex.answer) ? ex.answer.join(" ") : ex.answer;
    setEditValue(current);
  };

  // ── Sauvegarde d'une réponse éditée ─────────────────────────────────────
  const saveEdit = (ex: any) => {
    const updated = exercises.map((e) => {
      if (e.id !== ex.id) return e;
      // Pour type ordre, on reconvertit en tableau
      const newAnswer = ex.type === "ordre"
        ? editValue.split(" ").filter(Boolean)
        : editValue.trim();
      return { ...e, answer: newAnswer };
    });
    setExercises(updated);
    setEditingId(null);
    setSaved(false);
  };

  // ── Sauvegarde dans Supabase ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!taf) return;
    setSaving(true);
    try {
      const newContentJson = { ...taf.content_json, exercises };
      await supabase
        .from("tafs")
        .update({ content_json: newContentJson })
        .eq("id", taf.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Grouper par type
  const groups: Record<string, any[]> = {};
  exercises.forEach((ex) => {
    if (!groups[ex.type]) groups[ex.type] = [];
    groups[ex.type].push(ex);
  });

  return (
    <main className="bg-slate-50 min-h-screen pb-24 font-sans text-black">

      {/* Header */}
      <div className="bg-white border-b-4 border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()}
            className="text-2xl text-slate-400 hover:text-purple-500 transition-colors">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg text-slate-800 truncate">{taf.title}</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Correction du devoir
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-2xl font-black text-sm uppercase transition-all ${
              saved
                ? "bg-green-500 text-white"
                : "bg-purple-500 text-white hover:bg-purple-400 disabled:opacity-50"
            }`}
          >
            {saving ? "Sauvegarde..." : saved ? "✓ Sauvegardé !" : "Sauvegarder"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">

        {/* Info */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-sm font-bold text-blue-700">
          ℹ️ Clique sur <strong>Modifier</strong> à côté d'une réponse pour la corriger,
          puis <strong>Sauvegarder</strong> en haut.
        </div>

        {/* Exercices groupés par type */}
        {Object.entries(groups).map(([type, exs]) => (
          <div key={type} className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm">

            {/* Header type */}
            <div className="bg-slate-50 px-5 py-3 border-b-2 border-slate-100">
              <span className="font-black text-slate-600 uppercase text-xs tracking-widest">
                {TYPE_LABELS[type] || type} — {exs.length} question{exs.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="divide-y divide-slate-50">
              {exs.map((ex, index) => {
                const isEditing = editingId === ex.id;
                const answerDisplay = Array.isArray(ex.answer)
                  ? ex.answer.join(" → ")
                  : ex.answer;

                return (
                  <div key={ex.id} className="p-5 space-y-3">

                    {/* Question */}
                    <div className="flex gap-3">
                      <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <p className="font-bold text-slate-800 text-sm flex-1">{ex.question}</p>
                    </div>

                    {/* Options QCM */}
                    {ex.type === "qcm" && ex.options && (
                      <div className="ml-10 flex flex-wrap gap-2">
                        {ex.options.map((opt: string, i: number) => (
                          <span key={i} className={`text-xs px-2 py-1 rounded-lg font-bold ${
                            opt === ex.answer
                              ? "bg-green-100 text-green-700 border-2 border-green-300"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {opt === ex.answer ? "✓ " : ""}{opt}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Réponse correcte */}
                    <div className="ml-10 flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex-1 flex gap-2">
                          {ex.type === "vraiFaux" ? (
                            // Sélecteur Vrai/Faux
                            <div className="flex gap-2 flex-1">
                              {["Vrai", "Faux"].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setEditValue(opt)}
                                  className={`flex-1 py-2 rounded-xl font-black text-sm border-2 transition-all ${
                                    editValue === opt
                                      ? "border-purple-400 bg-purple-50 text-purple-700"
                                      : "border-slate-200 text-slate-500"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : ex.type === "qcm" ? (
                            // Sélecteur options QCM
                            <div className="flex flex-wrap gap-2 flex-1">
                              {ex.options.map((opt: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => setEditValue(opt)}
                                  className={`px-3 py-2 rounded-xl font-bold text-xs border-2 transition-all ${
                                    editValue === opt
                                      ? "border-purple-400 bg-purple-50 text-purple-700"
                                      : "border-slate-200 text-slate-500"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            // Saisie libre
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 border-2 border-purple-300 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:border-purple-500"
                              autoFocus
                              placeholder={ex.type === "ordre" ? "mots séparés par des espaces" : "Réponse correcte..."}
                            />
                          )}
                          <button
                            onClick={() => saveEdit(ex)}
                            className="bg-green-500 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-green-400 transition-all"
                          >
                            ✓ OK
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl font-black text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-2">
                            <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-0.5">
                              Réponse correcte
                            </p>
                            <p className="font-black text-green-800 text-sm">{answerDisplay}</p>
                          </div>
                          <button
                            onClick={() => startEdit(ex)}
                            className="bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white px-3 py-2 rounded-xl font-black text-xs uppercase transition-all"
                          >
                            ✏️ Modifier
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bouton sauvegarder bas de page */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full p-5 rounded-3xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
            saved
              ? "bg-green-500 text-white shadow-green-100"
              : "bg-purple-600 text-white shadow-purple-100 hover:bg-purple-500 disabled:opacity-50"
          }`}
        >
          {saving ? "Sauvegarde en cours..." : saved ? "✅ Corrections sauvegardées !" : "💾 Sauvegarder les corrections"}
        </button>
      </div>
    </main>
  );
}
