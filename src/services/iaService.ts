import { logger } from "../lib/logger";

const OPENROUTER_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

// ✅ Modèles fiables OpenRouter — mis à jour Mai 2026
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",  // ✅ Confirmé disponible
  "openai/gpt-oss-120b:free",                 // ✅ Confirmé disponible
  "google/gemma-3-27b-it:free",               // ✅ Confirmé disponible
  "qwen/qwen3-next-80b-a3b-instruct:free",    // ✅ Confirmé disponible
];

// ─── CONSTRUCTION DU PROMPT ──────────────────────────────────────────────────
function buildPrompt(description: string, config: any): string {
  const lines: string[] = [];

  if (config.type === "cours") {
    const d = config.details;
    const exerciseInstructions: string[] = [];

    if (d.qcm?.active && d.qcm.count > 0)
      exerciseInstructions.push(`- EXACTEMENT ${d.qcm.count} QCM : type="qcm", "options":[4 choix], "answer": texte exact de la bonne option`);
    if (d.vraiFaux?.active && d.vraiFaux.count > 0)
      exerciseInstructions.push(`- EXACTEMENT ${d.vraiFaux.count} Vrai/Faux : type="vraiFaux", "answer":"Vrai" ou "Faux"`);
    if (d.ordre?.active && d.ordre.count > 0)
      exerciseInstructions.push(`- EXACTEMENT ${d.ordre.count} Remise en ordre : type="ordre", "items":[mots mélangés], "answer":[ordre correct]`);
    if (d.saisie?.active && d.saisie.count > 0)
      exerciseInstructions.push(`- EXACTEMENT ${d.saisie.count} Saisie : type="saisie", "answer": le mot attendu`);
    if (d.special?.active && d.special.prompt)
      exerciseInstructions.push(`- 1 question ouverte : type="libre", consigne="${d.special.prompt}", "answer":"LIBRE"`);

    lines.push(`Tu es un enseignant expert. Génère des exercices sur : "${description}".`);
    lines.push(`Génère EXACTEMENT :\n${exerciseInstructions.join("\n")}`);
  } else {
    const mode = config.details.mode === "clone"
      ? "Mêmes types de questions, change les valeurs et chiffres."
      : "Questions totalement nouvelles sur les mêmes compétences.";
    lines.push(`Tu es un enseignant. Voici un examen : "${description}". Mode : ${mode}. Génère ${config.details.count} variante(s).`);
  }

  lines.push(`
Réponds UNIQUEMENT avec ce JSON, rien d'autre, pas de backticks :
{"exercises":[{"id":1,"type":"qcm","question":"...","options":["A","B","C","D"],"answer":"A"},{"id":2,"type":"vraiFaux","question":"...","answer":"Vrai"},{"id":3,"type":"saisie","question":"Complète : Le chat ___ du lait.","answer":"boit"},{"id":4,"type":"ordre","question":"Remets dans l'ordre.","items":["mange","le","chat"],"answer":["le","chat","mange"]}]}`);

  return lines.join("\n");
}

// ─── EXTRACTION JSON ROBUSTE ─────────────────────────────────────────────────
function extractJson(raw: string): any {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Aucun JSON dans la réponse IA.");
  return JSON.parse(raw.slice(start, end + 1));
}

// ─── APPEL UN MODÈLE ─────────────────────────────────────────────────────────
async function callModel(prompt: string, model: string): Promise<any> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
      "X-Title": "EduGen IA",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content || "";
  if (!raw.trim()) throw new Error("Réponse vide");
  return extractJson(raw);
}

// ─── ÉVALUATION RÉPONSE LIBRE ────────────────────────────────────────────────
async function evaluateFreeAnswer(question: string, userAnswer: string): Promise<{ correct: boolean; comment: string }> {
  const prompt = `Correcteur pédagogique. Question: "${question}" | Réponse élève: "${userAnswer}"
Évalue si acceptable sur le fond. Réponds UNIQUEMENT avec ce JSON :
{"correct":true,"comment":"Bravo."} ou {"correct":false,"comment":"Ce qui manque."}`;

  for (const model of MODELS) {
    try { return await callModel(prompt, model); } catch { continue; }
  }
  return { correct: false, comment: "Évaluation indisponible." };
}

// ─── SERVICE PRINCIPAL ───────────────────────────────────────────────────────
export const iaService = {
  async generateExercises(description: string, configStr: string) {
    if (!OPENROUTER_KEY || OPENROUTER_KEY.includes("ta_cle")) {
      throw new Error("Clé API manquante dans .env.local");
    }

    const config = JSON.parse(configStr);
    const prompt = buildPrompt(description, config);
    const errors: string[] = [];

    logger.info("Génération démarrée", { description });

    for (const model of MODELS) {
      try {
        logger.info(`Essai : ${model}`);
        const result = await callModel(prompt, model);
        logger.info(`✅ ${model} — ${result.exercises?.length ?? 0} exercice(s)`);
        return result;
      } catch (err: any) {
        const msg = `${model} → ${err.message}`;
        errors.push(msg);
        logger.error(`❌ ${msg}`);
      }
    }

    // Affiche tous les échecs dans la console pour diagnostic
    console.error("=== TOUS LES MODÈLES ONT ÉCHOUÉ ===\n" + errors.join("\n"));
    throw new Error(`Tous les modèles indisponibles. Détails console.\n${errors.join(" | ")}`);
  },

  evaluateFreeAnswer,
};
