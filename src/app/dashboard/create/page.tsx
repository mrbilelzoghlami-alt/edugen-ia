"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iaService } from "../../../services/iaService";
import { supabase } from "../../../lib/supabaseClient";

export default function CreateTAF() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- États du Formulaire ---
  const [sourceType, setSourceType] = useState<"cours" | "examen" | null>(null);
  const [inputMethod, setInputMethod] = useState<"texte" | "upload">("texte");
  const [courseText, setCourseText] = useState("");
  
  // Configuration Cours
  const [exerciseTypes, setExerciseTypes] = useState({
    qcm: { active: true, count: 5 },
    vraiFaux: { active: false, count: 5 },
    ordre: { active: false, count: 5 },
    saisie: { active: false, count: 5 },
    special: { active: false, prompt: "" }
  });

  // Configuration Examen
  const [examConfig, setExamConfig] = useState({
    mode: "clone",
    count: 1
  });

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const profileId = localStorage.getItem("edugen_profile_id");
      
      const config = sourceType === "cours" 
        ? { type: "cours", details: exerciseTypes } 
        : { type: "examen", details: examConfig };

      const generatedData = await iaService.generateExercises(courseText, JSON.stringify(config));

      const { error } = await supabase.from('tafs').insert([{
        profile_id: profileId,
        title: courseText.substring(0, 30) + "...",
        content_json: generatedData,
        status: 'créé',
        settings: config
      }]);

      if (error) throw error;
      router.push("/dashboard");
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-slate-50 min-h-screen font-sans pb-12 text-black">
      
      <div className="bg-white border-b-4 border-slate-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <button onClick={() => (step === 1 ? router.back() : handleBack())} className="text-slate-400 font-black text-xl hover:text-purple-500 transition-colors">←</button>
        <div className="flex gap-2">
          {[1, 2].map((s) => (
            <div key={s} className={`h-2 w-8 rounded-full transition-all duration-300 ${step >= s ? 'bg-purple-500' : 'bg-slate-200'}`} />
          ))}
        </div>
        <span className="w-6" />
      </div>

      <div className="max-w-md mx-auto p-6">
        
        
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-black text-slate-800">D'où vient le contenu ? 🚀</h1>
            
            <div className="grid gap-4">
              <button 
                onClick={() => setSourceType("cours")}
                className={`p-6 rounded-3xl border-4 text-left transition-all duration-300 ${sourceType === "cours" ? "border-purple-500 bg-purple-50 scale-[1.02]" : "border-white bg-white shadow-sm hover:border-purple-100"}`}
              >
                <span className="text-3xl block mb-2">📚</span>
                <span className="font-black text-lg block text-slate-700">À partir d'un cours</span>
                <p className="text-sm text-slate-500 font-medium">Générer des exercices de révision</p>
              </button>

              <button 
                onClick={() => setSourceType("examen")}
                className={`p-6 rounded-3xl border-4 text-left transition-all duration-300 ${sourceType === "examen" ? "border-orange-500 bg-orange-50 scale-[1.02]" : "border-white bg-white shadow-sm hover:border-orange-100"}`}
              >
                <span className="text-3xl block mb-2">📝</span>
                <span className="font-black text-lg block text-slate-700">À partir d'un examen</span>
                <p className="text-sm text-slate-500 font-medium">Cloner ou créer des variantes</p>
              </button>
            </div>

            {sourceType && (
              <div className="bg-white p-4 rounded-3xl shadow-sm space-y-4 border-2 border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button 
                    onClick={() => setInputMethod("texte")} 
                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${inputMethod === "texte" ? "bg-white shadow-sm text-purple-600" : "text-slate-500"}`}
                  >
                    Texte
                  </button>
                  <button 
                    onClick={() => setInputMethod("upload")} 
                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${inputMethod === "upload" ? "bg-white shadow-sm text-purple-600" : "text-slate-500"}`}
                  >
                    Fichier (PDF/IMG)
                  </button>
                </div>

                {inputMethod === "texte" ? (
                  <textarea 
                    value={courseText}
                    onChange={(e) => setCourseText(e.target.value)}
                    placeholder={sourceType === "cours" ? "Colle ton cours ici..." : "Colle l'examen original ici..."}
                    className="w-full h-32 p-4 bg-slate-50 rounded-2xl focus:outline-none font-medium border-2 border-transparent focus:border-purple-200 transition-all text-black"
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
              disabled={!sourceType || !courseText}
              onClick={handleNext}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-5 rounded-3xl font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
            >
              Suivant
            </button>
          </div>
        )}

        
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className="text-2xl font-black text-slate-800">Configuration ⚙️</h1>

            {sourceType === "cours" ? (
              <div className="space-y-4">
                {Object.entries(exerciseTypes).map(([key, val]) => (
                  key !== 'special' && (
                    <div key={key} className={`bg-white p-4 rounded-3xl border-2 transition-all duration-300 ${val.active ? 'border-purple-500 shadow-md shadow-purple-50' : 'border-transparent'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-3 font-black text-slate-700 capitalize cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={val.active} 
                            onChange={(e) => setExerciseTypes({...exerciseTypes, [key]: {...val, active: e.target.checked}})}
                            className="w-5 h-5 accent-purple-500 cursor-pointer"
                          />
                          {key === 'qcm' ? 'Choix Multiple' : key === 'vraiFaux' ? 'Vrai/Faux' : key === 'ordre' ? 'Mettre en ordre' : 'Saisir un mot'}
                        </label>
                        {val.active && (
                          <input 
                            type="number" 
                            min="1"
                            max="20"
                            value={val.count} 
                            onChange={(e) => setExerciseTypes({...exerciseTypes, [key]: {...val, count: parseInt(e.target.value) || 0}})}
                            className="w-12 h-10 bg-slate-100 rounded-xl text-center font-bold text-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          />
                        )}
                      </div>
                    </div>
                  )
                ))}

                <div className={`bg-white p-4 rounded-3xl border-2 transition-all duration-300 ${exerciseTypes.special.active ? 'border-purple-500 shadow-md shadow-purple-50' : 'border-transparent'}`}>
                   <label className="flex items-center gap-3 font-black text-slate-700 mb-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={exerciseTypes.special.active}
                        onChange={(e) => setExerciseTypes({...exerciseTypes, special: {...exerciseTypes.special, active: e.target.checked}})}
                        className="w-5 h-5 accent-purple-500 cursor-pointer"
                      />
                      Demande spécifique
                   </label>
                   {exerciseTypes.special.active && (
                     <textarea 
                        value={exerciseTypes.special.prompt}
                        onChange={(e) => setExerciseTypes({...exerciseTypes, special: {...exerciseTypes.special, prompt: e.target.value}})}
                        placeholder="Ex: Fais une étude de cas sur..."
                        className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium focus:outline-none border-2 border-transparent focus:border-purple-100 transition-all text-black"
                     />
                   )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl space-y-4 shadow-sm border-2 border-slate-50">
                  <p className="font-black text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span> Mode de l'IA
                  </p>
                  <div className="flex gap-2">
                    {['clone', 'inspo'].map((m) => (
                      <button 
                        key={m}
                        onClick={() => setExamConfig({...examConfig, mode: m})}
                        className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all duration-300 ${examConfig.mode === m ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-[1.02]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {m === 'clone' ? 'Fidèle (Clone)' : 'Inspiration'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-50 text-center space-y-4">
                  <p className="font-black text-slate-700 uppercase text-xs tracking-widest">Nombre d'examens (Max 3)</p>
                  <div className="flex justify-center gap-6">
                    {[1, 2, 3].map((n) => (
                      <button 
                        key={n}
                        onClick={() => setExamConfig({...examConfig, count: n})}
                        className={`w-14 h-14 rounded-full font-black text-lg transition-all duration-300 ${examConfig.count === n ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-110' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-purple-100 active:scale-95 transition-all mt-4"
            >
              {loading ? "Génération en cours..." : "✨ Créer le TAF"}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="text-7xl animate-bounce mb-6">⚡</div>
          <p className="font-black text-slate-800 uppercase tracking-tighter text-2xl px-6 text-center">
            EduGen IA prépare tes exercices...
          </p>
        </div>
      )}
    </main>
  );
}