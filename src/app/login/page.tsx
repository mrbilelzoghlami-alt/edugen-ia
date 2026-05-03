"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../../services/authService";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"parent" | "enfant" | "recover">("parent");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoverResult, setRecoverResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = (newTab: "parent" | "enfant" | "recover") => {
    setTab(newTab);
    setError(null);
    setRecoverResult(null);
    setPseudo("");
    setEmail("");
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "parent") {
        const profile = await authService.loginByParentPseudo(pseudo.trim());
        localStorage.setItem("edugen_profile_id", profile.id);
        localStorage.setItem("pseudo_parent", profile.pseudo_parent);
        localStorage.setItem("edugen_role", "parent");
        router.push("/dashboard");
      } else {
        const profile = await authService.loginByChildPseudo(pseudo.trim());
        localStorage.setItem("edugen_profile_id", profile.id);
        localStorage.setItem("pseudo_enfant", profile.pseudo_enfant);
        localStorage.setItem("edugen_role", "enfant");
        router.push("/enfant");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.recoverPseudo(email.trim());
      setRecoverResult(
        `👨‍👩‍👧 Parent : "${result.pseudo_parent}" | 🎒 Enfant : "${result.pseudo_enfant}"`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-yellow-50 flex items-center justify-center min-h-screen p-4 font-sans text-black">
      <div className="bg-white rounded-3xl border-4 border-b-8 border-yellow-400 p-8 w-full max-w-md shadow-xl">
        <h1 className="text-3xl font-black text-yellow-500 uppercase text-center mb-6 italic">
          EduGen IA 🚀
        </h1>

        {/* Onglets */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
          {[
            { key: "parent", label: "👨‍👩‍👧 Parent" },
            { key: "enfant", label: "🎒 Enfant" },
            { key: "recover", label: "🔑 Récupérer" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => resetForm(key as "parent" | "enfant" | "recover")}
              className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                tab === key
                  ? "bg-white shadow text-yellow-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold">
            ⚠️ {error}
          </div>
        )}

        {/* Formulaire login */}
        {tab !== "recover" ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder={tab === "parent" ? "Ton pseudo parent" : "Ton pseudo enfant"}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && pseudo.trim() && handleLogin()}
            />
            <button
              onClick={handleLogin}
              disabled={!pseudo.trim() || loading}
              className="w-full bg-yellow-400 text-white font-black py-4 rounded-xl border-b-4 border-yellow-600 uppercase disabled:opacity-40 transition-all active:border-b-0 active:translate-y-1"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        ) : (
          /* Formulaire récupération */
          <div className="space-y-4">
            {recoverResult ? (
              <div className="bg-green-100 border-2 border-green-400 text-green-800 p-4 rounded-xl font-bold text-center text-sm">
                ✅ Compte retrouvé !<br />
                <br />
                {recoverResult}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 font-medium text-center">
                  Entre l&apos;email du compte parent pour retrouver les pseudos.
                </p>
                <input
                  type="email"
                  placeholder="Email du parent"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  onClick={handleRecover}
                  disabled={!email.trim() || loading}
                  className="w-full bg-yellow-400 text-white font-black py-4 rounded-xl border-b-4 border-yellow-600 uppercase disabled:opacity-40 transition-all active:border-b-0"
                >
                  {loading ? "Recherche..." : "Retrouver mes pseudos"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ✅ CORRIGÉ : lien vers / (page d'inscription) au lieu de /register */}
        <p className="text-center text-sm text-gray-400 font-bold mt-6">
          Pas encore de compte ?{" "}
          <Link href="/" className="text-yellow-600 underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
