"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iaService } from "../../../services/iaService";
import { supabase } from "../../../lib/supabaseClient";

// ── Types explicites pour éviter les erreurs TypeScript ─────────────────────
type ExCount   = { active: boolean; count: number };
type ExSpecial = { active: boolean; prompt: string };
type ExerciseConfig = {
  qcm: ExCount; vraiFaux: ExCount;
  ordre: ExCount; saisie: ExCount;
  special: ExSpecial;
};

export default function CreateTAF() {
  const router = useRouter();
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);

  // ── États du formulaire ──────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<"cours" | "examen" | null>(null);
  const [inputMethod, setInputMethod] = useState<"texte" | "upload">("texte");
  const [courseText, setCourseText]   = useState("");
  const [tafTitle, setTafTitle]       = useState("");

  const [exerciseTypes, setExerciseTypes] = useState<ExerciseConfig>({
    qcm:      { active: true,  count: 5 },
    vraiFaux: { active: false, count: 5 },
    ordre:    { active: false, count: 5 },
    saisie:   { active: false, count: 5 },
    special:  { active: false, prompt: "" },
  });

  const [examConfig, setExamConfig] = useState({ mode: "clone", count: 1 });

  // ── État après création ──────────────────────────────────────────────────
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  // ── Création du TAF ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoading(true);
    try {
      const profileId = localStorage.getItem("edugen_profile_id");
      const config = sourceType === "cours"
        ? { type: "cours",  details: exerciseTypes }
        : { type: "examen", details: examConfig };

      const generatedData = await iaService.generateExercises(courseText, JSON.stringify(config));
      const title = tafTitle.trim() || courseText.substring(0, 40) + "...";

      const { data, error } = await supabase.from("tafs").insert([{
        profile_id: profileId, title,
        content_json: generatedData,
        status: "créé", settings: config,
      }]).select().single();

      if (error) throw error;

      const link = `${window.location.origin}/taf/${data.id}`;
      setShareLink(link);
      setStep(3);
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const pseudo = localStorage.getItem("pseudo_enfant") || "toi";
    const msg = encodeURIComponent(`Salut ${pseudo} ! 🎒\nTon devoir t'attend ici :\n${shareLink}\nBonne chance ! 💪`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  // ── Helper : label lisible ────────────────────────────────────────────────
  const labelFor = (key: string) =>
    key === "qcm" ? "Choix Multiple" :
    key === "vraiFaux" ? "Vrai / Faux" :
    key === "ordre" ? "Mettre en ordre" :
    key === "saisie" ? "Saisir un mot" : "Demande spécifique à l'IA";

  return (
    <main className="bg-slate-50 min-h-screen font-sans pb-12 text-black">

      {/* Header */}
      <div className="bg-white border-b-4 border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <button
          onClick={() => step === 1 ? router.back() : step < 3 ? setStep(step - 1) : router.push("/dashboard")}
          className="text-slate-400 font-black text-xl hover:text-purple-500 transition-colors"
        >←</button>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 w-8 rounded-full transition-all duration-300 ${step >= s ? "bg-purple-500" : "bg-slate-200"}`} />
          ))}
        </div>
        <span className="w-6" />
      </div>

      <div className="max-w-md mx-auto p-6">

        {/* ══ ÉTAPE 1 ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-slate-800">D'où vient le contenu ? 🚀</h1>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Titre du devoir (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex : Mathématiques — Les fractions"
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold outline-none focus:border-purple-300 transition-all"
                value={tafTitle}
                onChange={(e) => setTafTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-4">
              {(["cours", "examen"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSourceType(type)}
                  className={`p-6 rounded-3xl border-4 text-left transition-all duration-300 ${
                    sourceType === type
                      ? type === "cours" ? "border-purple-500 bg-purple-50 scale-[1.02]" : "border-orange-500 bg-orange-50 scale-[1.02]"
                      : "border-white bg-white shadow-sm"
                  }`}
                >
                  <span className="text-3xl block mb-2">{type === "cours" ? "📚" : "📝"}</span>
                  <span className="font-black text-lg block text-slate-700">
                    {type === "cours" ? "À partir d'un cours" : "À partir d'un examen"}
                  </span>
                  <p className="text-sm text-slate-500 font-medium">
                    {type === "cours" ? "Générer des exercices de révision" : "Cloner ou créer des variantes"}
                  </p>
                </button>
              ))}
            </div>

            {sourceType && (
              <div className="bg-white p-4 rounded-3xl shadow-sm space-y-4 border-2 border-slate-100">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                  {(["texte", "upload"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setInputMethod(m)}
                      className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${inputMethod === m ? "bg-white shadow-sm text-purple-600" : "text-slate-500"}`}
                    >
                      {m === "texte" ? "Texte" : "Fichier PDF/IMG"}
                    </button>
                  ))}
                </div>
                {inputMethod === "texte" ? (
                  <textarea
                    value={courseText}
                    onChange={(e) => setCourseText(e.target.value)}
                    placeholder={sourceType === "cours" ? "Décris ou colle le cours ici..." : "Colle l'examen original ici..."}
                    className="w-full h-32 p-4 bg-slate-50 rounded-2xl focus:outline-none font-medium border-2 border-transparent focus:border-purple-200 transition-all text-black resize-none"
                  />
                ) : (
                  <div className="border-4 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50">
                    <span className="text-3xl block mb-2">📤</span>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Bientôt disponible</p>
                  </div>
                )}
              </div>
            )}

            <button
              disabled={!sourceType || !courseText.trim()}
              onClick={() => setStep(2)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-5 rounded-3xl font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
            >
              Suivant
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 2 ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-slate-800">Configuration ⚙️</h1>

            {sourceType === "cours" ? (
              <div className="space-y-4">
                {/* QCM / VraiFaux / Ordre / Saisie */}
                {(["qcm", "vraiFaux", "ordre", "saisie"] as const).map((key) => {
                  const val = exerciseTypes[key] as ExCount;
                  return (
                    <div key={key} className={`bg-white p-4 rounded-3xl border-2 transition-all duration-300 ${val.active ? "border-purple-500 shadow-md shadow-purple-50" : "border-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-3 font-black text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={val.active}
                            onChange={(e) => setExerciseTypes({ ...exerciseTypes, [key]: { ...val, active: e.target.checked } })}
                            className="w-5 h-5 accent-purple-500 cursor-pointer"
                          />
                          {labelFor(key)}
                        </label>
                        {val.active && (
                          <input
                            type="number" min="1" max="20"
                            value={val.count}
                            onChange={(e) => setExerciseTypes({ ...exerciseTypes, [key]: { ...val, count: parseInt(e.target.value) || 1 } })}
                            className="w-12 h-10 bg-slate-100 rounded-xl text-center font-bold text-purple-600 focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Demande spéciale */}
                {(() => {
                  const val = exerciseTypes.special;
                  return (
                    <div className={`bg-white p-4 rounded-3xl border-2 transition-all ${val.active ? "border-purple-500 shadow-md" : "border-transparent"}`}>
                      <label className="flex items-center gap-3 font-black text-slate-700 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={val.active}
                          onChange={(e) => setExerciseTypes({ ...exerciseTypes, special: { ...val, active: e.target.checked } })}
                          className="w-5 h-5 accent-purple-500"
                        />
                        {labelFor("special")}
                      </label>
                      {val.active && (
                        <textarea
                          value={val.prompt}
                          onChange={(e) => setExerciseTypes({ ...exerciseTypes, special: { ...val, prompt: e.target.value } })}
                          placeholder="Ex : Fais une mise en situation réelle..."
                          className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium focus:outline-none border-2 border-transparent focus:border-purple-100 transition-all text-black"
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl space-y-4 shadow-sm border-2 border-slate-50">
                  <p className="font-black text-slate-700 uppercase text-xs tracking-widest">Mode de l'IA</p>
                  <div className="flex gap-2">
                    {["clone", "inspo"].map((m) => (
                      <button key={m} onClick={() => setExamConfig({ ...examConfig, mode: m })}
                        className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${examConfig.mode === m ? "bg-orange-500 text-white shadow-lg scale-[1.02]" : "bg-slate-100 text-slate-400"}`}>
                        {m === "clone" ? "Fidèle (Clone)" : "Inspiration"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-50 text-center space-y-4">
                  <p className="font-black text-slate-700 uppercase text-xs tracking-widest">Nombre d'examens (Max 3)</p>
                  <div className="flex justify-center gap-6">
                    {[1, 2, 3].map((n) => (
                      <button key={n} onClick={() => setExamConfig({ ...examConfig, count: n })}
                        className={`w-14 h-14 rounded-full font-black text-lg transition-all duration-300 ${examConfig.count === n ? "bg-orange-500 text-white shadow-lg scale-110" : "bg-slate-100 text-slate-400"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleCreate} disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-purple-100 active:scale-95 transition-all mt-4 disabled:opacity-50">
              {loading ? "L'IA génère les exercices..." : "✨ Créer le TAF"}
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 3 : Succès + Partage ═══════════════════════════════════ */}
        {step === 3 && shareLink && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-2xl font-black text-slate-800">TAF créé !</h1>
              <p className="text-slate-500 font-bold mt-2">Partage ce lien avec ton enfant</p>
            </div>

            <div className="bg-white rounded-3xl border-4 border-purple-200 p-4 space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lien du devoir</p>
              <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-xs text-slate-600 font-mono flex-1 truncate">{shareLink}</span>
                <button onClick={handleCopy}
                  className={`px-3 py-2 rounded-xl font-black text-xs uppercase transition-all ${copied ? "bg-green-500 text-white" : "bg-purple-500 text-white hover:bg-purple-400"}`}>
                  {copied ? "✓ Copié !" : "Copier"}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <button onClick={handleWhatsApp}
                className="w-full bg-green-500 hover:bg-green-400 text-white p-4 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-green-100 transition-all active:scale-95">
                <span className="text-2xl">📱</span> Envoyer via WhatsApp
              </button>
              <button onClick={() => {
                  const pseudo = localStorage.getItem("pseudo_enfant") || "toi";
                  const msg = `Salut ${pseudo} ! 🎒 Ton devoir t'attend ici : ${shareLink} — Bonne chance ! 💪`;
                  window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white p-4 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-100 transition-all active:scale-95">
                <span className="text-2xl">💬</span> Envoyer par SMS
              </button>
            </div>

            <button onClick={() => router.push("/dashboard")}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-3xl font-black uppercase tracking-widest transition-all">
              ← Retour au dashboard
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <div className="text-7xl animate-bounce mb-6">⚡</div>
          <p className="font-black text-slate-800 uppercase tracking-tighter text-2xl px-6 text-center">
            EduGen IA génère tes exercices...
          </p>
          <p className="text-slate-400 font-bold mt-3">Cela prend 10 à 30 secondes</p>
        </div>
      )}
    </main>
  );
}
