"use client";

import { useEffect, useState } from "react";
import { tafService } from "../../services/tafService";
import Link from "next/link";

export default function Dashboard() {
  const [parentName, setParentName] = useState("");
  const [tafs, setTafs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Récupération sécurisée des données du profil
    const profileId = localStorage.getItem("edugen_profile_id");
    const pseudo = localStorage.getItem("pseudo_parent");
    
    if (pseudo) setParentName(pseudo);

    if (profileId) {
      tafService.getTafsByProfile(profileId)
        .then(data => {
          setTafs(data || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Erreur lors de la récupération des TAFs:", err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <main className="bg-blue-50 min-h-screen font-sans pb-20 text-black">
      {/* Navigation supérieure */}
      <nav className="bg-white border-b-4 border-blue-200 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black text-blue-500 uppercase italic">EduGen IA</h1>
          <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
            Salut, {parentName} ! 👋
          </span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4 space-y-8 mt-6">
        {/* Bouton de création avec Link corrigé */}
        <Link href="/dashboard/create" className="block">
          <button 
            className="w-full bg-emerald-400 hover:bg-emerald-300 text-white p-6 rounded-3xl border-b-8 border-emerald-600 transition-all active:border-b-0 active:translate-y-1 flex items-center justify-center gap-4 shadow-lg"
          >
            <span className="text-4xl text-white">➕</span>
            <span className="text-2xl font-black uppercase tracking-tight">Créer un nouveau TAF</span>
          </button>
        </Link>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📂</span>
            <h2 className="text-xl font-black text-gray-700 uppercase tracking-tight">Tes travaux</h2>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-gray-400">Chargement de tes TAFs...</p>
            </div>
          ) : tafs.length > 0 ? (
            <div className="grid gap-4">
              {tafs.map((taf) => (
                <Link 
                  key={taf.id} 
                  href={`/taf/${taf.id}`} 
                  className="block group"
                >
                  <div className="bg-white p-5 rounded-3xl border-4 border-b-8 border-gray-200 group-hover:border-purple-400 group-hover:scale-[1.01] transition-all duration-200 flex justify-between items-center cursor-pointer shadow-sm group-hover:shadow-xl">
                    <div className="flex-1">
                      <h3 className="font-black text-lg text-gray-800 group-hover:text-purple-600 transition-colors truncate pr-4">
                        {taf.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase px-2 py-1 bg-orange-100 text-orange-600 rounded-lg">
                          {taf.status || "créé"}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 italic">
                          {taf.created_at ? new Date(taf.created_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-sm font-black text-blue-500 italic">
                        Score: {taf.score_global || 0}/20
                      </p>
                      <span className="text-gray-300 text-xl group-hover:text-purple-500 group-hover:translate-x-1 transition-all">
                        ➔
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border-4 border-gray-200 p-12 text-center flex flex-col items-center gap-4 border-dashed">
              <span className="text-5xl">🏜️</span>
              <p className="text-gray-400 font-bold italic">
                C'est bien vide ici...<br/>Commence par créer ton premier exercice !
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}