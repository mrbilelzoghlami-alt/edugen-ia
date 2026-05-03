// src/app/enfant/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tafService } from "../../services/tafService";
import { authService } from "../../services/authService";

export default function EnfantDashboard() {
  const router = useRouter();
  const [enfantName, setEnfantName] = useState("");
  const [tafs, setTafs]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const profileId = localStorage.getItem("edugen_profile_id");
    const role      = localStorage.getItem("edugen_role");
    const pseudo    = localStorage.getItem("pseudo_enfant");

    // Redirige si pas connecté ou connecté en tant que parent
    if (!profileId || role === "parent") {
      router.push("/login");
      return;
    }

    if (pseudo) setEnfantName(pseudo);

    tafService.getTafsByProfile(profileId)
      .then((data) => { setTafs(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    router.push("/login");
  };

  // ── Couleur selon statut ─────────────────────────────────────────────────
  const statusStyle = (status: string) => {
    if (status === "terminé")  return { bar: "bg-green-100 text-green-600",  dot: "bg-green-400" };
    if (status === "en_cours") return { bar: "bg-orange-100 text-orange-600", dot: "bg-orange-400" };
    return { bar: "bg-blue-100 text-blue-500", dot: "bg-blue-300" };
  };

  // ── Emoji score ──────────────────────────────────────────────────────────
  const scoreEmoji = (score: number) =>
    score >= 16 ? "🏆" : score >= 12 ? "⭐" : score >= 8 ? "👍" : "💪";

  // ── Stats rapides ────────────────────────────────────────────────────────
  const termines  = tafs.filter((t) => t.status === "terminé").length;
  const enCours   = tafs.filter((t) => t.status === "en_cours").length;
  const nonFaits  = tafs.filter((t) => t.status === "créé").length;

  return (
    <main className="bg-violet-50 min-h-screen font-sans pb-24 text-black">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b-4 border-violet-200 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-violet-500 uppercase italic">EduGen IA</h1>
            <p className="text-xs font-bold text-slate-400">Espace Élève</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-violet-100 text-violet-600 px-3 py-1.5 rounded-full text-sm font-bold">
              🎒 {enfantName}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 font-bold hover:text-red-400 transition-colors"
            >
              Déco
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">

        {/* ── Message de bienvenue ────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-violet-200">
          <p className="font-black text-2xl">Salut {enfantName} ! 👋</p>
          <p className="font-bold text-violet-200 mt-1 text-sm">
            {nonFaits > 0
              ? `Tu as ${nonFaits} devoir${nonFaits > 1 ? "s" : ""} à faire !`
              : enCours > 0
              ? `Continue ton devoir en cours ! 💪`
              : "Tous tes devoirs sont faits ! 🏆"}
          </p>
        </div>

        {/* ── Stats rapides ────────────────────────────────────────────── */}
        {tafs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "À faire",   count: nonFaits,  color: "bg-blue-100 text-blue-600",   emoji: "📝" },
              { label: "En cours",  count: enCours,   color: "bg-orange-100 text-orange-600", emoji: "⏳" },
              { label: "Terminés",  count: termines,  color: "bg-green-100 text-green-600",  emoji: "✅" },
            ].map(({ label, count, color, emoji }) => (
              <div key={label} className={`${color} rounded-2xl p-3 text-center`}>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-0.5">{emoji} {label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Liste des TAFs ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📚</span>
            <h2 className="text-xl font-black text-gray-700 uppercase tracking-tight">Mes devoirs</h2>
            <span className="bg-violet-100 text-violet-600 text-xs font-black px-2 py-1 rounded-full">
              {tafs.length}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-gray-400">Chargement...</p>
            </div>

          ) : tafs.length === 0 ? (
            <div className="bg-white rounded-3xl border-4 border-dashed border-gray-200 p-12 text-center">
              <span className="text-5xl">🏖️</span>
              <p className="text-gray-400 font-bold italic mt-4">
                Pas encore de devoirs.<br />
                Ton parent t'en enverra bientôt !
              </p>
            </div>

          ) : (
            <div className="grid gap-4">
              {tafs.map((taf) => {
                const styles   = statusStyle(taf.status);
                const isDone   = taf.status === "terminé";
                const isNew    = taf.status === "créé";

                return (
                  <Link key={taf.id} href={`/taf/${taf.id}`} className="block group">
                    <div className={`bg-white rounded-3xl border-4 border-b-8 transition-all duration-200 shadow-sm group-hover:shadow-xl group-hover:scale-[1.01] overflow-hidden ${
                      isDone ? "border-green-200" : isNew ? "border-violet-200" : "border-orange-200"
                    }`}>

                      {/* Bande colorée en haut */}
                      <div className={`h-1.5 w-full ${styles.dot}`} />

                      <div className="p-5 flex items-center gap-4">

                        {/* Icône statut */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                          isDone ? "bg-green-100" : isNew ? "bg-violet-100" : "bg-orange-100"
                        }`}>
                          {isDone ? "✅" : isNew ? "📝" : "⏳"}
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-lg text-gray-800 truncate group-hover:text-violet-600 transition-colors">
                            {taf.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${styles.bar}`}>
                              {taf.status === "créé" ? "À faire" : taf.status === "en_cours" ? "En cours" : "Terminé"}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">
                              {taf.created_at
                                ? new Date(taf.created_at).toLocaleDateString("fr-FR")
                                : ""}
                            </span>
                          </div>
                        </div>

                        {/* Score ou flèche */}
                        <div className="flex-shrink-0 text-right">
                          {isDone && taf.score_global > 0 ? (
                            <div>
                              <p className={`text-xl font-black ${
                                taf.score_global >= 14 ? "text-green-500" :
                                taf.score_global >= 10 ? "text-orange-500" : "text-red-400"
                              }`}>
                                {taf.score_global}/20
                              </p>
                              <p className="text-lg">{scoreEmoji(taf.score_global)}</p>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-2xl group-hover:text-violet-500 group-hover:translate-x-1 transition-all inline-block">
                              →
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barre de progression si en cours */}
                      {taf.status === "en_cours" && (
                        <div className="px-5 pb-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-orange-100 rounded-full overflow-hidden">
                              <div className="h-2 bg-orange-400 rounded-full w-1/2" />
                            </div>
                            <span className="text-[10px] font-black text-orange-400">EN COURS</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
