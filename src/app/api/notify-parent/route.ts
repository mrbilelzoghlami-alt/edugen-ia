// src/app/api/notify-parent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Client Supabase côté serveur (avec service role pour contourner RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { tafId } = await req.json();
    if (!tafId) return NextResponse.json({ error: "tafId manquant" }, { status: 400 });

    // ── Récupérer le TAF + profil parent ──────────────────────────────────
    const { data: taf, error: tafError } = await supabase
      .from("tafs")
      .select("id, title, score_global, score_detail, profile_id, parent_notified")
      .eq("id", tafId)
      .single();

    if (tafError || !taf) return NextResponse.json({ error: "TAF introuvable" }, { status: 404 });
    if (taf.parent_notified) return NextResponse.json({ message: "Déjà notifié" });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email_parent, pseudo_parent, pseudo_enfant")
      .eq("id", taf.profile_id)
      .single();

    if (profileError || !profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

    const detail = taf.score_detail as any;
    const percentage = detail?.percentage ?? 0;
    const scoreLabel = taf.score_global >= 14 ? "🏆 Excellent !" : taf.score_global >= 10 ? "👍 Bien !" : "💪 À retravailler";

    // ── Envoi email via Resend ────────────────────────────────────────────
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EduGen IA <onboarding@resend.dev>",
        to: profile.email_parent,
        subject: `📚 ${profile.pseudo_enfant} a terminé "${taf.title}"`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:16px">
            <h1 style="color:#7c3aed;font-size:24px;margin-bottom:4px">EduGen IA 🚀</h1>
            <p style="color:#6b7280;font-size:13px;margin-top:0">Notification de devoir terminé</p>
            <hr style="border:none;border-top:2px solid #e5e7eb;margin:16px 0"/>
            <p style="font-size:16px">Bonjour <strong>${profile.pseudo_parent}</strong> 👋</p>
            <p style="font-size:15px"><strong>${profile.pseudo_enfant}</strong> vient de terminer son devoir :</p>

            <div style="background:white;border:2px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0">
              <p style="font-weight:900;font-size:17px;margin:0 0 8px;color:#1e293b">📚 ${taf.title}</p>
              <p style="font-size:28px;font-weight:900;color:${taf.score_global >= 14 ? "#22c55e" : taf.score_global >= 10 ? "#f97316" : "#ef4444"};margin:0">
                ${taf.score_global}/20
              </p>
              <p style="color:#6b7280;font-size:14px;margin:4px 0 0">${percentage}% de bonnes réponses — ${scoreLabel}</p>
            </div>

            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://edugen-ia.vercel.app"}/taf/${tafId}"
               style="display:inline-block;background:#7c3aed;color:white;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:8px;font-size:14px">
              Voir le détail des réponses →
            </a>

            <p style="color:#9ca3af;font-size:12px;margin-top:24px">
              EduGen IA — Application de révision intelligente
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error("Erreur Resend:", err);
      // On ne bloque pas — on marque quand même comme notifié en app
    }

    // ── Marquer comme notifié dans Supabase ──────────────────────────────
    await supabase
      .from("tafs")
      .update({ parent_notified: true })
      .eq("id", tafId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Erreur notify-parent:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
