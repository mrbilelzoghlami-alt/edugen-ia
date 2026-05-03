// src/app/dashboard/page.tsx — avec pastille notification
"use client";

import { useEffect, useState } from "react";
import { tafService } from "../../services/tafService";
import { authService } from "../../services/authService";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [parentName, setParentName]   = useState("");
  const [enfantName, setEnfantName]   = useState("");
  const [tafs, setTafs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs]   = useState(false);

  useEffect(() => {
    const profileId   = localStorage.getItem("edugen_profile_id");
    const pseudo      = localStorage.getItem("pseudo_parent");
    const pseudoEnfant = localStorage.getItem("pseudo_enfant") || "";
    const role        = localStorage.getItem("edugen_role");

    if (!profileId || role !== "parent") { router.push("/login"); return; }

    if (pseudo)       setParentName(pseudo);
    if (pseudoEnfant) setEnfantName(pseudoEnfant);

    tafService.getTafsByProfile(profileId).then((data) => {
      setTafs(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Compteur pastille
    tafService.getUnreadCount(profileId).then(setUnreadCount);
  }, [router]);

  // ── Ouvre le panneau notifs + marque comme lu ────────────────────────────
  const handleOpenNotifs = async () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs && unreadCount > 0) {
      const profileId = localStorage.getItem("edugen_profile_id")!;
      await tafService.markAllAsRead(profileId);
      setUnreadCount(0);
    }
  };

  const handleCopyLink = async (tafId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/taf/${tafId}`);
    setCopiedId(tafId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleWhatsApp = (tafId: string, tafTitle: string) => {
    const link = `${window.location.origin}/taf/${tafId}`;
    const msg  = encodeURIComponent(`Salut ${enfantName || "toi"} ! 🎒\nTon devoir "${tafTitle}" t'attend ici :\n${link}\nBonne chance ! 💪`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const statusStyle = (status: string) => {
    if (status === "terminé")  return "bg-green-100 text-green-600";
    if (status === "en_cours") return "bg-orange-100 text-orange-600";
    return "bg-gray-100 text-gray-400";
  };

  // TAFs terminés non lus (pour le panneau)
  const newlyDone = tafs.filter((t) => t.status === "terminé" && !t.parent_notified);

  return (
    <main className="bg-blue-50 min-h-screen font-sans pb-20 text-black">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b-4 border-blue-200 p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black text-blue-500 uppercase italic">EduGen IA</h1>
          <div className="flex items-center gap-3">

            {/* 🔔 Cloche avec pastille */}
            <button
              onClick={handleOpenNotifs}
              className="relative w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            <span className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full text-sm font-bold">
              👋 {parentName}
            </span>
            <button onClick={() => { authService.logout(); router.push("/login"); }}
              className="text-xs text-slate-400 font-bold hover:text-red-400 transition-colors">
              Déco
            </button>
          </div>
        </div>

        {/* ── Panneau notifications ──────────────────────────────────────── */}
        {showNotifs && (
          <div className="max-w-2xl mx-auto mt-3">
            <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-xl overflow-hidden">
              <div className="bg-blue-500 px-4 py-3 flex items-center justify-between">
                <p className="font-black text-white text-sm uppercase tracking-widest">🔔 Notifications</p>
                <button onClick={() => setShowNotifs(false)} className="text-blue-200 font-black hover:text-white">✕</button>
              </div>

              {newlyDone.length === 0 && unreadCount === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-400 font-bold text-sm">Aucune nouvelle notification.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tafs
                    .filter((t) => t.status === "terminé")
                    .slice(0, 5)
                    .map((taf) => (
                      <Link key={taf.id} href={`/taf/${taf.id}`} onClick={() => setShowNotifs(false)}>
                        <div className="px-4 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3">
                          <span className="text-2xl">
                            {taf.score_global >= 14 ? "🏆" : taf.score_global >= 10 ? "⭐" : "💪"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-800 truncate">{taf.title}</p>
                            <p className="text-xs text-slate-500 font-bold">
                              {enfantName} a obtenu{" "}
                              <span className={`font-black ${taf.score_global >= 14 ? "text-green-600" : taf.score_global >= 10 ? "text-orange-500" : "text-red-500"}`}>
                                {taf.score_global}/20
                              </span>
                            </p>
                          </div>
                          <span className="text-slate-300 text-sm">→</span>
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">

        {/* Bouton créer */}
        <Link href="/dashboard/create" className="block">
          <button className="w-full bg-emerald-400 hover:bg-emerald-300 text-white p-6 rounded-3xl border-b-8 border-emerald-600 transition-all active:border-b-0 active:translate-y-1 flex items-center justify-center gap-4 shadow-lg">
            <span className="text-4xl">➕</span>
            <span className="text-2xl font-black uppercase tracking-tight">Créer un nouveau TAF</span>
          </button>
        </Link>

        {/* Badge enfant */}
        {enfantName && (
          <div className="bg-white rounded-2xl border-2 border-blue-100 p-3 flex items-center gap-3">
            <span className="text-2xl">🎒</span>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pseudo de ton enfant</p>
              <p className="font-black text-slate-700">{enfantName}</p>
            </div>
          </div>
        )}

        {/* Liste TAFs */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📂</span>
            <h2 className="text-xl font-black text-gray-700 uppercase tracking-tight">Tes travaux</h2>
            <span className="bg-blue-100 text-blue-600 text-xs font-black px-2 py-1 rounded-full">{tafs.length}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-gray-400">Chargement...</p>
            </div>
          ) : tafs.length === 0 ? (
            <div className="bg-white rounded-3xl border-4 border-dashed border-gray-200 p-12 text-center">
              <span className="text-5xl">🏜️</span>
              <p className="text-gray-400 font-bold italic mt-4">
                C'est bien vide ici...<br />Crée ton premier exercice !
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {tafs.map((taf) => (
                <div key={taf.id} className={`bg-white rounded-3xl border-4 border-b-8 shadow-sm overflow-hidden transition-all ${
                  taf.status === "terminé" && !taf.parent_notified
                    ? "border-blue-400 shadow-blue-100"
                    : "border-gray-200"
                }`}>

                  {/* Badge "Nouveau" si pas encore vu */}
                  {taf.status === "terminé" && !taf.parent_notified && (
                    <div className="bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 text-center">
                      ✨ Nouveau résultat disponible
                    </div>
                  )}

                  <Link href={`/taf/${taf.id}`} className="block p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="font-black text-lg text-gray-800 truncate">{taf.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${statusStyle(taf.status)}`}>
                            {taf.status || "créé"}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {taf.created_at ? new Date(taf.created_at).toLocaleDateString("fr-FR") : ""}
                          </span>
                          {taf.status === "en_cours" && taf.last_activity && (
                            <span className="text-[10px] font-bold text-orange-400">
                              Actif le {new Date(taf.last_activity).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {taf.score_global > 0 ? (
                          <p className={`text-lg font-black ${taf.score_global >= 14 ? "text-green-500" : taf.score_global >= 10 ? "text-orange-500" : "text-red-400"}`}>
                            {taf.score_global}/20
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-slate-300">—/20</p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Barre partage */}
                  <div className="border-t-2 border-gray-100 px-5 py-3 flex gap-2">
                    <button onClick={() => handleCopyLink(taf.id)}
                      className={`flex-1 py-2 rounded-2xl font-black text-xs uppercase transition-all ${copiedId === taf.id ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-600"}`}>
                      {copiedId === taf.id ? "✓ Copié !" : "🔗 Copier le lien"}
                    </button>
                    <button onClick={() => handleWhatsApp(taf.id, taf.title)}
                      className="flex-1 py-2 rounded-2xl font-black text-xs uppercase bg-green-100 text-green-600 hover:bg-green-500 hover:text-white transition-all">
                      📱 WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
