"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../services/authService";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    parentPseudo: "",
    parentEmail: "",
    enfantPseudo: "",
  });

  // ── Vérification localStorage (remplace supabase.auth.getSession) ──────────
  useEffect(() => {
    const profileId = localStorage.getItem("edugen_profile_id");
    const role = localStorage.getItem("edugen_role");
    if (profileId) {
      router.push(role === "enfant" ? "/enfant" : "/dashboard");
    } else {
      setLoading(false);
    }
  }, [router]);

  // ── Soumission du formulaire d'inscription ────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await authService.registerParent(
        formData.parentPseudo.trim(),
        formData.parentEmail.trim(),
        formData.enfantPseudo.trim()
      );
      // authService remplit localStorage → redirection directe
      router.push("/dashboard");
    } catch (error: any) {
      setErrorMessage(error.message || "Une erreur inconnue est survenue.");
      setIsSubmitting(false);
    }
  };

  // ── Chargement ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-yellow-50">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Formulaire d'inscription ──────────────────────────────────────────────
  return (
    <main className="bg-yellow-50 flex items-center justify-center min-h-screen p-4 font-sans text-black">
      <div className="bg-white rounded-3xl border-4 border-b-8 border-yellow-400 p-8 w-full max-w-md shadow-xl">
        <h1 className="text-3xl font-black text-yellow-500 uppercase text-center mb-2 italic">
          EduGen IA 🚀
        </h1>
        <p className="text-center text-gray-400 font-bold text-sm mb-6">
          Crée ton compte en 10 secondes
        </p>

        {errorMessage && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 p-3 rounded-xl mb-6 text-sm font-bold">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Pseudo Parent
            </label>
            <input
              required
              type="text"
              placeholder="Ex : SuperPapa"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold transition-colors"
              value={formData.parentPseudo}
              onChange={(e) => setFormData({ ...formData, parentPseudo: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Email (pour récupérer ton compte)
            </label>
            <input
              required
              type="email"
              placeholder="ton@email.com"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold transition-colors"
              value={formData.parentEmail}
              onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Pseudo Enfant
            </label>
            <input
              required
              type="text"
              placeholder="Ex : Champion2025"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-yellow-400 outline-none font-bold transition-colors"
              value={formData.enfantPseudo}
              onChange={(e) => setFormData({ ...formData, enfantPseudo: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-yellow-400 text-white font-black py-4 rounded-xl border-b-4 border-yellow-600 active:border-0 active:translate-y-1 uppercase transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? "Création du compte..." : "C'est parti ! 🚀"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 font-bold mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-yellow-600 underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
