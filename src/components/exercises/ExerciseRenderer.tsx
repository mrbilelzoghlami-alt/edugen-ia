"use client";

import { useState, useCallback, useMemo } from "react";
import { iaService } from "../../services/iaService";

interface Exercise {
  id: number;
  type: "qcm" | "vraiFaux" | "saisie" | "ordre" | "libre";
  question: string;
  options?: string[];
  items?: string[];
  answer: string | string[];
}

interface Props {
  exercises: Exercise[];
  maxAttempts?: number;
  onComplete?: (score: number, total: number, answers: Record<number, string>) => void;
}

type Phase = "answering" | "review" | "done";

const TYPE_LABELS: Record<string, string> = {
  qcm: "Choix Multiple", vraiFaux: "Vrai / Faux",
  saisie: "Saisie", ordre: "Remise en ordre", libre: "Réponse ouverte",
};

// ─── HELPER MÉLANGE ──────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isCorrect(ex: Exercise, userAnswer: string): boolean {
  const expected = Array.isArray(ex.answer)
    ? ex.answer.join(" ").toLowerCase().trim()
    : ex.answer.toLowerCase().trim();
  return expected === userAnswer.toLowerCase().trim();
}

function groupByType(exercises: Exercise[]): Record<string, Exercise[]> {
  return exercises.reduce((acc, ex) => {
    if (!acc[ex.type]) acc[ex.type] = [];
    acc[ex.type].push(ex);
    return acc;
  }, {} as Record<string, Exercise[]>);
}

export default function ExerciseRenderer({ exercises, maxAttempts = 2, onComplete }: Props) {
  const [phase, setPhase]     = useState<Phase>("answering");
  const [attempt, setAttempt] = useState(1);

  const [answers, setAnswers]               = useState<Record<number, string>>({});
  const [orderSelected, setOrderSelected]   = useState<Record<number, string[]>>({});
  const [saisieValues, setSaisieValues]     = useState<Record<number, string>>({});
  const [libreValues, setLibreValues]       = useState<Record<number, string>>({});
  const [libreLoading, setLibreLoading]     = useState<Record<number, boolean>>({});
  const [libreComments, setLibreComments]   = useState<Record<number, string>>({});

  const [results, setResults]       = useState<Record<number, boolean>>({});
  const [lockedTypes, setLockedTypes] = useState<Set<string>>(new Set());
  const [typeScores, setTypeScores]   = useState<Record<string, { correct: number; total: number }>>({});

  // ── ✅ POINT 1 : Mélanger options QCM et ordre Vrai/Faux une seule fois ───
  const shuffledOptions = useMemo(() => {
    const map: Record<number, string[]> = {};
    exercises.forEach((ex) => {
      if (ex.type === "qcm" && ex.options) {
        map[ex.id] = shuffle(ex.options);
      } else if (ex.type === "vraiFaux") {
        // 50% de chance d'afficher Faux en premier
        map[ex.id] = Math.random() > 0.5 ? ["Vrai", "Faux"] : ["Faux", "Vrai"];
      }
    });
    return map;
  }, [exercises]); // calculé une seule fois au montage

  const groups   = groupByType(exercises);
  const typeKeys = Object.keys(groups);

  const activeExercises = attempt === 1
    ? exercises
    : exercises.filter((ex) => !lockedTypes.has(ex.type));

  const allAnswered = activeExercises.every((ex) => {
    if (ex.type === "ordre")  return (orderSelected[ex.id] || []).length > 0;
    if (ex.type === "libre")  return !!(libreValues[ex.id]?.trim());
    if (ex.type === "saisie") return !!(saisieValues[ex.id]?.trim());
    return !!(answers[ex.id]);
  });

  const getAnswer = (ex: Exercise): string => {
    if (ex.type === "ordre")  return (orderSelected[ex.id] || []).join(" ");
    if (ex.type === "libre")  return libreValues[ex.id] || "";
    if (ex.type === "saisie") return saisieValues[ex.id] || "";
    return answers[ex.id] || "";
  };

  const evaluateLibre = useCallback(async (ex: Exercise) => {
    const val = libreValues[ex.id] || "";
    if (!val.trim()) return;
    setLibreLoading((p) => ({ ...p, [ex.id]: true }));
    try {
      const res = await iaService.evaluateFreeAnswer(ex.question, val);
      setLibreComments((p) => ({ ...p, [ex.id]: res.comment }));
      setAnswers((p) => ({ ...p, [ex.id]: val }));
    } finally {
      setLibreLoading((p) => ({ ...p, [ex.id]: false }));
    }
  }, [libreValues]);

  const handleSubmit = async () => {
    const newResults: Record<number, boolean> = { ...results };
    for (const ex of activeExercises) {
      newResults[ex.id] = ex.type === "libre" ? true : isCorrect(ex, getAnswer(ex));
    }
    setResults(newResults);

    const newTypeScores: Record<string, { correct: number; total: number }> = {};
    for (const [type, exs] of Object.entries(groups)) {
      const correct = exs.filter((ex) => newResults[ex.id]).length;
      newTypeScores[type] = { correct, total: exs.length };
    }
    setTypeScores(newTypeScores);

    const newLocked = new Set<string>();
    for (const [type, score] of Object.entries(newTypeScores)) {
      if (score.correct === score.total) newLocked.add(type);
    }
    setLockedTypes(newLocked);

    if (attempt === 1) {
      setPhase("review");
    } else {
      const totalCorrect = Object.values(newResults).filter(Boolean).length;
      const allAnswersMap: Record<number, string> = {};
      exercises.forEach((ex) => { allAnswersMap[ex.id] = getAnswer(ex); });
      onComplete?.(totalCorrect, exercises.length, allAnswersMap);
      setPhase("done");
    }
  };

  // ── ✅ POINT 2 : Conserver les réponses de la tentative 1 ─────────────────
  const handleRetry = () => {
    // On NE réinitialise PLUS les réponses → l'enfant voit ses réponses pré-remplies
    // et peut se concentrer uniquement sur les questions dont il doute
    setAttempt(2);
    setPhase("answering");
  };

  // ── PHASE REVIEW ──────────────────────────────────────────────────────────
  if (phase === "review") {
    const allPerfect = typeKeys.every((t) => lockedTypes.has(t));
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <h2 className="text-xl font-black text-slate-800">Résultats — Tentative 1</h2>
          <p className="text-slate-500 font-bold text-sm mt-1">
            {allPerfect ? "Parfait ! Tu as tout réussi du premier coup 🏆" : "Voici tes résultats par type d'exercice :"}
          </p>
        </div>

        <div className="space-y-3">
          {typeKeys.map((type) => {
            const score  = typeScores[type] || { correct: 0, total: 0 };
            const locked = lockedTypes.has(type);
            const pct    = Math.round((score.correct / score.total) * 100);
            return (
              <div key={type} className={`bg-white rounded-2xl border-4 p-4 ${locked ? "border-green-300" : "border-orange-300"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-slate-700">{TYPE_LABELS[type] || type}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-black ${locked ? "text-green-600" : "text-orange-500"}`}>
                      {score.correct}/{score.total}
                    </span>
                    {locked ? <span className="text-xl">✅</span> : <span className="text-xl">🔄</span>}
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${locked ? "bg-green-400" : "bg-orange-400"}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs font-bold mt-1 text-slate-400">
                  {locked
                    ? "✓ Parfait ! Ces questions sont validées."
                    : "→ Tes réponses sont conservées, corrige celles dont tu doutes."}
                </p>
              </div>
            );
          })}
        </div>

        {allPerfect ? (
          <button
            onClick={() => {
              const totalCorrect = exercises.length;
              const allAnswersMap: Record<number, string> = {};
              exercises.forEach((ex) => { allAnswersMap[ex.id] = getAnswer(ex); });
              onComplete?.(totalCorrect, exercises.length, allAnswersMap);
              setPhase("done");
            }}
            className="w-full bg-green-500 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
          >
            Voir mes résultats 🏁
          </button>
        ) : (
          <button onClick={handleRetry}
            className="w-full bg-orange-500 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-lg shadow-orange-100 transition-all active:scale-95">
            2ᵉ tentative — Corriger mes erreurs 💪
          </button>
        )}
      </div>
    );
  }

  // ── PHASE DONE ────────────────────────────────────────────────────────────
  if (phase === "done") {
    const totalCorrect = Object.values(results).filter(Boolean).length;
    const percentage   = Math.round((totalCorrect / exercises.length) * 100);
    const color    = percentage >= 70 ? "text-green-500" : percentage >= 40 ? "text-orange-500" : "text-red-500";
    const barColor = percentage >= 70 ? "bg-green-400" : percentage >= 40 ? "bg-orange-400" : "bg-red-400";
    const message  = percentage >= 70 ? "Excellent travail ! 🏆" : percentage >= 40 ? "Pas mal, continue ! 👍" : "Courage, révise encore ! 💪";

    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <div className={`text-7xl font-black ${color}`}>{percentage}%</div>
          <p className="font-black text-2xl text-slate-800 mt-2">{totalCorrect}/{exercises.length} bonnes réponses</p>
          <p className="text-slate-500 font-bold mt-1">{message}</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
          <div className={`h-4 rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${percentage}%` }} />
        </div>

        <div className="space-y-4">
          {typeKeys.map((type) => {
            const exs    = groups[type];
            const score  = typeScores[type] || { correct: 0, total: 0 };
            const allOk  = score.correct === score.total;
            return (
              <div key={type} className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between ${allOk ? "bg-green-50" : "bg-red-50"}`}>
                  <span className="font-black text-slate-700">{TYPE_LABELS[type] || type}</span>
                  <span className={`font-black text-lg ${allOk ? "text-green-600" : "text-red-500"}`}>
                    {score.correct}/{score.total} {allOk ? "✅" : "❌"}
                  </span>
                </div>
                {!allOk && (
                  <div className="divide-y divide-slate-50">
                    {exs.filter((ex) => !results[ex.id]).map((ex, i) => (
                      <div key={ex.id} className="px-5 py-3">
                        <p className="text-sm font-bold text-slate-700">Q{i + 1}. {ex.question}</p>
                        <p className="text-xs font-bold text-red-400 mt-1">Ta réponse : {getAnswer(ex) || "—"}</p>
                        <p className="text-xs font-bold text-green-600 mt-0.5">
                          Réponse correcte : {Array.isArray(ex.answer) ? ex.answer.join(" ") : ex.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── PHASE ANSWERING ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-3 text-center font-black text-sm uppercase tracking-widest ${
        attempt === 1 ? "bg-purple-100 text-purple-600" : "bg-orange-100 text-orange-600"
      }`}>
        {attempt === 1
          ? "✏️ Réponds à toutes les questions"
          : "🔄 2ᵉ tentative — Tes réponses sont conservées, corrige celles dont tu doutes"}
      </div>

      {typeKeys.map((type) => {
        const exs    = groups[type];
        const locked = lockedTypes.has(type) && attempt === 2;
        const score  = typeScores[type];

        return (
          <div key={type} className={`rounded-3xl overflow-hidden border-4 ${locked ? "border-green-300 opacity-60" : "border-slate-200"}`}>
            <div className={`px-5 py-3 flex items-center justify-between ${locked ? "bg-green-50" : "bg-slate-50"}`}>
              <span className="font-black text-slate-700 uppercase text-xs tracking-widest">
                {TYPE_LABELS[type] || type}
              </span>
              {locked && score && (
                <span className="text-green-600 font-black text-sm">✅ {score.correct}/{score.total} — Validé</span>
              )}
            </div>

            <div className="divide-y divide-slate-100 bg-white">
              {exs.map((ex, index) => (
                <div key={ex.id} className={`p-5 ${locked ? "pointer-events-none" : ""}`}>
                  <div className="flex gap-3 mb-4">
                    <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="font-bold text-slate-800">{ex.question}</p>
                  </div>

                  {/* ── QCM : options mélangées ── */}
                  {ex.type === "qcm" && (
                    <div className="grid gap-2 ml-10">
                      {(shuffledOptions[ex.id] || ex.options || []).map((opt, i) => (
                        <button key={i} disabled={locked}
                          onClick={() => setAnswers((p) => ({ ...p, [ex.id]: opt }))}
                          className={`text-left p-3 rounded-2xl border-2 font-medium text-sm transition-all ${
                            answers[ex.id] === opt
                              ? "border-purple-400 bg-purple-50 text-purple-700"
                              : "border-slate-100 text-slate-600 hover:border-purple-200"
                          }`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── VRAI / FAUX : ordre aléatoire ── */}
                  {ex.type === "vraiFaux" && (
                    <div className="flex gap-3 ml-10">
                      {(shuffledOptions[ex.id] || ["Vrai", "Faux"]).map((opt) => (
                        <button key={opt} disabled={locked}
                          onClick={() => setAnswers((p) => ({ ...p, [ex.id]: opt }))}
                          className={`flex-1 p-3 rounded-2xl border-2 font-black text-sm transition-all ${
                            answers[ex.id] === opt
                              ? "border-purple-400 bg-purple-50 text-purple-700"
                              : "border-slate-100 text-slate-600"
                          }`}>
                          {opt === "Vrai" ? "✅ Vrai" : "❌ Faux"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── SAISIE ── */}
                  {ex.type === "saisie" && (
                    <div className="ml-10">
                      <input type="text" disabled={locked}
                        value={saisieValues[ex.id] || ""}
                        onChange={(e) => setSaisieValues((p) => ({ ...p, [ex.id]: e.target.value }))}
                        placeholder="Ta réponse..."
                        className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold outline-none focus:border-purple-300 transition-all" />
                    </div>
                  )}

                  {/* ── ORDRE ── */}
                  {ex.type === "ordre" && ex.items && (
                    <div className="ml-10 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {ex.items.filter((item) => !(orderSelected[ex.id] || []).includes(item)).map((item, i) => (
                          <button key={i} disabled={locked}
                            onClick={() => setOrderSelected((p) => ({ ...p, [ex.id]: [...(p[ex.id] || []), item] }))}
                            className="bg-purple-100 text-purple-700 px-3 py-2 rounded-xl font-bold text-sm hover:bg-purple-200 transition-all">
                            {item}
                          </button>
                        ))}
                      </div>
                      {(orderSelected[ex.id] || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border-2 border-dashed border-slate-200 min-h-10">
                          {(orderSelected[ex.id] || []).map((item, i) => (
                            <button key={i} disabled={locked}
                              onClick={() => setOrderSelected((p) => ({ ...p, [ex.id]: (p[ex.id] || []).filter((_, idx) => idx !== i) }))}
                              className="bg-white border-2 border-purple-300 text-purple-700 px-3 py-2 rounded-xl font-bold text-sm hover:bg-red-50">
                              {item} ×
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── LIBRE ── */}
                  {ex.type === "libre" && (
                    <div className="ml-10 space-y-2">
                      <textarea disabled={locked}
                        value={libreValues[ex.id] || ""}
                        onChange={(e) => setLibreValues((p) => ({ ...p, [ex.id]: e.target.value }))}
                        placeholder="Écris ta réponse..." rows={3}
                        className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 font-medium outline-none resize-none focus:border-purple-300 transition-all" />
                      {libreComments[ex.id] && (
                        <p className="text-xs font-bold text-slate-500 italic">💬 {libreComments[ex.id]}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={handleSubmit} disabled={!allAnswered}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
        {allAnswered
          ? attempt === 1 ? "Envoyer mes réponses →" : "Envoyer — Voir le résultat final 🏁"
          : "Réponds à toutes les questions d'abord"}
      </button>
    </div>
  );
}
