"use client";

import { useState, useCallback } from "react";
import { iaService } from "../../services/iaService";

// ─── TYPES ───────────────────────────────────────────────────────────────────
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

type Feedback = "correct" | "wrong" | null;

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────
export default function ExerciseRenderer({ exercises, maxAttempts = 2, onComplete }: Props) {
  const [answers, setAnswers]           = useState<Record<number, string>>({});
  const [attempts, setAttempts]         = useState<Record<number, number>>({});
  const [feedback, setFeedback]         = useState<Record<number, Feedback>>({});
  const [locked, setLocked]             = useState<Record<number, boolean>>({});
  const [orderSelected, setOrderSelected] = useState<Record<number, string[]>>({});
  const [saisieValues, setSaisieValues] = useState<Record<number, string>>({});
  const [libreValues, setLibreValues]   = useState<Record<number, string>>({});
  const [libreLoading, setLibreLoading] = useState<Record<number, boolean>>({});
  const [libreComments, setLibreComments] = useState<Record<number, string>>({});
  const [showResult, setShowResult]     = useState(false);
  const [finalScore, setFinalScore]     = useState(0);

  // ── Vérification d'une réponse ──────────────────────────────────────────
  const checkAnswer = useCallback(
    (ex: Exercise, userAnswer: string) => {
      const expectedRaw = ex.answer;
      const expected = Array.isArray(expectedRaw)
        ? expectedRaw.join(" ").toLowerCase().trim()
        : expectedRaw.toLowerCase().trim();
      const isCorrect = expected === userAnswer.toLowerCase().trim();

      const currentAttempts = (attempts[ex.id] || 0) + 1;
      const exhausted = currentAttempts >= maxAttempts;

      setAttempts((prev) => ({ ...prev, [ex.id]: currentAttempts }));
      setAnswers((prev) => ({ ...prev, [ex.id]: userAnswer }));

      if (isCorrect) {
        setFeedback((prev) => ({ ...prev, [ex.id]: "correct" }));
        setLocked((prev) => ({ ...prev, [ex.id]: true }));
      } else if (exhausted) {
        setFeedback((prev) => ({ ...prev, [ex.id]: "wrong" }));
        setLocked((prev) => ({ ...prev, [ex.id]: true }));
      } else {
        setFeedback((prev) => ({ ...prev, [ex.id]: "wrong" }));
        // Réinitialise pour permettre le 2e essai
        setTimeout(() => setFeedback((prev) => ({ ...prev, [ex.id]: null })), 900);
      }
    },
    [attempts, maxAttempts]
  );

  // ── Validation réponse libre via IA ────────────────────────────────────
  const submitLibre = useCallback(
    async (ex: Exercise) => {
      const val = libreValues[ex.id] || "";
      if (!val.trim()) return;
      setLibreLoading((prev) => ({ ...prev, [ex.id]: true }));
      try {
        const result = await iaService.evaluateFreeAnswer(ex.question, val);
        setFeedback((prev) => ({ ...prev, [ex.id]: result.correct ? "correct" : "wrong" }));
        setLibreComments((prev) => ({ ...prev, [ex.id]: result.comment }));
        setAnswers((prev) => ({ ...prev, [ex.id]: val }));
        setLocked((prev) => ({ ...prev, [ex.id]: true }));
      } catch {
        setLibreComments((prev) => ({ ...prev, [ex.id]: "Impossible d'évaluer pour l'instant." }));
        setLocked((prev) => ({ ...prev, [ex.id]: true }));
        setFeedback((prev) => ({ ...prev, [ex.id]: "correct" })); // On ne bloque pas le score
      } finally {
        setLibreLoading((prev) => ({ ...prev, [ex.id]: false }));
      }
    },
    [libreValues]
  );

  // ── Validation finale ────────────────────────────────────────────────────
  const handleValidate = () => {
    const score = exercises.filter((ex) => feedback[ex.id] === "correct").length;
    setFinalScore(score);
    setShowResult(true);
    onComplete?.(score, exercises.length, answers);
  };

  const answeredCount = Object.keys(locked).length;
  const allAnswered   = answeredCount === exercises.length;
  const percentage    = exercises.length > 0 ? Math.round((finalScore / exercises.length) * 100) : 0;

  // ── Écran de résultat ────────────────────────────────────────────────────
  if (showResult) {
    const emoji  = percentage >= 70 ? "🎉" : percentage >= 40 ? "👍" : "💪";
    const color  = percentage >= 70 ? "text-green-500" : percentage >= 40 ? "text-orange-500" : "text-red-500";
    const barColor = percentage >= 70 ? "bg-green-400" : percentage >= 40 ? "bg-orange-400" : "bg-red-400";
    const message = percentage >= 70 ? "Excellent travail !" : percentage >= 40 ? "Pas mal, continue !" : "Courage, révise encore !";

    return (
      <div className="text-center space-y-6 py-8 px-4">
        <div className={`text-8xl font-black ${color}`}>{percentage}%</div>
        <p className="font-black text-2xl text-slate-800">
          {finalScore} / {exercises.length} bonnes réponses
        </p>
        <p className="text-slate-500 font-bold text-lg">{emoji} {message}</p>
        <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
          <div
            className={`h-5 rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Récap des réponses */}
        <div className="space-y-3 pt-4 text-left">
          <p className="font-black text-slate-600 uppercase text-xs tracking-widest">Récapitulatif</p>
          {exercises.map((ex, i) => (
            <div
              key={ex.id}
              className={`p-3 rounded-2xl border-2 text-sm font-bold flex items-start gap-3 ${
                feedback[ex.id] === "correct"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <span>{feedback[ex.id] === "correct" ? "✅" : "❌"}</span>
              <div>
                <p className="text-slate-700 font-bold">Q{i + 1}. {ex.question}</p>
                {feedback[ex.id] === "wrong" && ex.type !== "libre" && (
                  <p className="text-green-600 text-xs mt-1">
                    Réponse correcte : {Array.isArray(ex.answer) ? ex.answer.join(" ") : ex.answer}
                  </p>
                )}
                {ex.type === "libre" && libreComments[ex.id] && (
                  <p className="text-slate-500 text-xs mt-1 italic">{libreComments[ex.id]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Rendu des exercices ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {exercises.map((ex, index) => {
        const fb      = feedback[ex.id];
        const isLocked = locked[ex.id] || false;
        const attemptsLeft = maxAttempts - (attempts[ex.id] || 0);

        const cardBorder =
          fb === "correct" ? "border-green-400" :
          fb === "wrong" && isLocked ? "border-red-300" :
          "border-slate-100";

        return (
          <div
            key={ex.id}
            className={`bg-white p-6 rounded-3xl border-4 shadow-sm transition-all duration-300 ${cardBorder}`}
          >
            {/* En-tête de la question */}
            <div className="flex gap-4 mb-5">
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                  fb === "correct" ? "bg-green-100 text-green-600" :
                  fb === "wrong" && isLocked ? "bg-red-100 text-red-500" :
                  "bg-purple-100 text-purple-600"
                }`}
              >
                {fb === "correct" ? "✓" : fb === "wrong" && isLocked ? "✗" : index + 1}
              </span>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-base leading-snug">{ex.question}</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-1 inline-block">
                  {ex.type === "qcm" ? "Choix multiple" :
                   ex.type === "vraiFaux" ? "Vrai / Faux" :
                   ex.type === "saisie" ? "Saisie libre" :
                   ex.type === "ordre" ? "Remise en ordre" : "Réponse ouverte"}
                </span>
              </div>
            </div>

            {/* Badge tentatives */}
            {!isLocked && fb === null && attempts[ex.id] > 0 && (
              <div className="ml-13 mb-3 text-xs font-bold text-orange-500">
                ⚡ Encore {attemptsLeft} essai{attemptsLeft > 1 ? "s" : ""}
              </div>
            )}
            {/* Badge mauvaise réponse */}
            {fb === "wrong" && !isLocked && (
              <div className="ml-13 mb-3 text-xs font-bold text-orange-500 animate-pulse">
                ❌ Mauvaise réponse — réessaie !
              </div>
            )}
            {/* Badge réponse correcte */}
            {fb === "correct" && (
              <div className="ml-13 mb-3 text-xs font-bold text-green-600">✅ Bonne réponse !</div>
            )}
            {/* Badge épuisé */}
            {fb === "wrong" && isLocked && ex.type !== "libre" && (
              <div className="ml-13 mb-3 text-xs font-bold text-red-500">
                Réponse correcte : <span className="underline">{Array.isArray(ex.answer) ? ex.answer.join(" ") : ex.answer}</span>
              </div>
            )}

            {/* ── QCM ── */}
            {ex.type === "qcm" && ex.options && (
              <div className="grid gap-3 ml-13">
                {ex.options.map((opt, i) => {
                  const isSelected = answers[ex.id] === opt;
                  const isCorrectOpt = opt === ex.answer;
                  let btnClass = "border-slate-100 text-slate-600 hover:border-purple-200 hover:bg-purple-50";
                  if (isLocked && isCorrectOpt) btnClass = "border-green-400 bg-green-50 text-green-700";
                  else if (isLocked && isSelected && !isCorrectOpt) btnClass = "border-red-300 bg-red-50 text-red-600";
                  else if (!isLocked && isSelected) btnClass = "border-purple-400 bg-purple-50 text-purple-700";

                  return (
                    <button
                      key={i}
                      disabled={isLocked}
                      onClick={() => checkAnswer(ex, opt)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 font-medium disabled:cursor-default ${btnClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── VRAI / FAUX ── */}
            {ex.type === "vraiFaux" && (
              <div className="flex gap-4 ml-13">
                {["Vrai", "Faux"].map((opt) => {
                  const isSelected = answers[ex.id] === opt;
                  const isCorrectOpt = opt === ex.answer;
                  let btnClass = "border-slate-100 text-slate-600 hover:border-purple-200";
                  if (isLocked && isCorrectOpt) btnClass = "border-green-400 bg-green-100 text-green-700";
                  else if (isLocked && isSelected && !isCorrectOpt) btnClass = "border-red-300 bg-red-100 text-red-600";
                  else if (!isLocked && isSelected) btnClass = "border-purple-400 bg-purple-50 text-purple-700";

                  return (
                    <button
                      key={opt}
                      disabled={isLocked}
                      onClick={() => checkAnswer(ex, opt)}
                      className={`flex-1 p-4 rounded-2xl border-2 font-black text-sm transition-all duration-200 disabled:cursor-default ${btnClass}`}
                    >
                      {opt === "Vrai" ? "✅ Vrai" : "❌ Faux"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── SAISIE ── */}
            {ex.type === "saisie" && (
              <div className="ml-13 flex gap-2">
                <input
                  type="text"
                  disabled={isLocked}
                  value={saisieValues[ex.id] || ""}
                  onChange={(e) => setSaisieValues((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLocked && saisieValues[ex.id]?.trim())
                      checkAnswer(ex, saisieValues[ex.id]);
                  }}
                  placeholder="Tape ta réponse..."
                  className={`flex-1 border-2 rounded-2xl px-4 py-3 font-bold outline-none transition-all ${
                    isLocked ? "bg-gray-50 text-gray-400" : "border-purple-200 focus:border-purple-400"
                  }`}
                />
                {!isLocked && (
                  <button
                    onClick={() => saisieValues[ex.id]?.trim() && checkAnswer(ex, saisieValues[ex.id])}
                    disabled={!saisieValues[ex.id]?.trim()}
                    className="bg-purple-500 text-white px-4 rounded-2xl font-black disabled:opacity-30 transition-all"
                  >
                    OK
                  </button>
                )}
              </div>
            )}

            {/* ── ORDRE ── */}
            {ex.type === "ordre" && ex.items && (
              <div className="ml-13 space-y-3">
                {/* Mots disponibles */}
                <div className="flex flex-wrap gap-2">
                  {ex.items
                    .filter((item) => !(orderSelected[ex.id] || []).includes(item))
                    .map((item, i) => (
                      <button
                        key={i}
                        disabled={isLocked}
                        onClick={() =>
                          !isLocked &&
                          setOrderSelected((prev) => ({
                            ...prev,
                            [ex.id]: [...(prev[ex.id] || []), item],
                          }))
                        }
                        className="bg-purple-100 text-purple-700 px-3 py-2 rounded-xl font-bold text-sm hover:bg-purple-200 transition-all disabled:cursor-default"
                      >
                        {item}
                      </button>
                    ))}
                </div>

                {/* Phrase construite */}
                {(orderSelected[ex.id] || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 min-h-10 bg-slate-50 p-3 rounded-2xl border-2 border-dashed border-slate-200">
                    {(orderSelected[ex.id] || []).map((item, i) => (
                      <button
                        key={i}
                        disabled={isLocked}
                        onClick={() =>
                          !isLocked &&
                          setOrderSelected((prev) => ({
                            ...prev,
                            [ex.id]: (prev[ex.id] || []).filter((_, idx) => idx !== i),
                          }))
                        }
                        className="bg-white border-2 border-purple-300 text-purple-700 px-3 py-2 rounded-xl font-bold text-sm hover:bg-red-50 hover:border-red-300 transition-all disabled:cursor-default"
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>
                )}

                {/* Bouton valider l'ordre */}
                {!isLocked && (
                  <button
                    disabled={(orderSelected[ex.id] || []).length === 0}
                    onClick={() =>
                      checkAnswer(ex, (orderSelected[ex.id] || []).join(" "))
                    }
                    className="bg-purple-500 text-white px-6 py-2 rounded-2xl font-black text-sm disabled:opacity-30 transition-all"
                  >
                    Valider l'ordre
                  </button>
                )}
              </div>
            )}

            {/* ── RÉPONSE LIBRE ── */}
            {ex.type === "libre" && (
              <div className="ml-13 space-y-3">
                <textarea
                  disabled={isLocked}
                  value={libreValues[ex.id] || ""}
                  onChange={(e) => setLibreValues((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                  placeholder="Écris ta réponse ici..."
                  rows={4}
                  className={`w-full border-2 rounded-2xl px-4 py-3 font-medium outline-none resize-none transition-all ${
                    isLocked ? "bg-gray-50 text-gray-400" : "border-purple-200 focus:border-purple-400"
                  }`}
                />
                {!isLocked && (
                  <button
                    onClick={() => submitLibre(ex)}
                    disabled={!libreValues[ex.id]?.trim() || libreLoading[ex.id]}
                    className="bg-purple-500 text-white px-6 py-2 rounded-2xl font-black text-sm disabled:opacity-30 transition-all flex items-center gap-2"
                  >
                    {libreLoading[ex.id] ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Évaluation par l'IA...
                      </>
                    ) : (
                      "Soumettre ma réponse"
                    )}
                  </button>
                )}
                {isLocked && libreComments[ex.id] && (
                  <div className={`p-3 rounded-xl text-sm font-bold ${
                    fb === "correct" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                  }`}>
                    💬 {libreComments[ex.id]}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Bouton valider tout */}
      <button
        onClick={handleValidate}
        disabled={!allAnswered}
        className="w-full mt-6 bg-green-500 hover:bg-green-400 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-lg shadow-green-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        {allAnswered
          ? "Voir mes résultats 🏁"
          : `${answeredCount} / ${exercises.length} questions répondues`}
      </button>
    </div>
  );
}
