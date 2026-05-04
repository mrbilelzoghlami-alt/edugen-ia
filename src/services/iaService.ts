import { logger } from "../lib/logger";

const OPENROUTER_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

// ─── EXTRACTION JSON ROBUSTE ─────────────────────────────────────────────────
function extractJson(raw: string): any {
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Aucun JSON dans la réponse.");
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
      temperature: 0.3,
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

// ─── APPEL AVEC CASCADE ───────────────────────────────────────────────────────
async function callWithFallback(prompt: string, skipFirst = false): Promise<{ result: any; modelUsed: string }> {
  const models = skipFirst ? MODELS.slice(1) : MODELS;
  const errors: string[] = [];
  for (const model of models) {
    try {
      logger.info(`Essai : ${model}`);
      const result = await callModel(prompt, model);
      return { result, modelUsed: model };
    } catch (err: any) {
      errors.push(`${model} → ${err.message}`);
      logger.error(`Échec ${model} : ${err.message}`);
    }
  }
  throw new Error("Tous les modèles indisponibles.\n" + errors.join("\n"));
}

// ─── CONSTRUCTION DU PROMPT DE GÉNÉRATION ────────────────────────────────────
function buildGenerationPrompt(description: string, config: any): string {
  const lines: string[] = [];

  if (config.type === "cours") {
    const d = config.details;
    const instructions: string[] = [];
    if (d.qcm?.active && d.qcm.count > 0)
      instructions.push(`- EXACTEMENT ${d.qcm.count} QCM : type="qcm", "options":[4 choix], "answer": texte exact de la bonne option`);
    if (d.vraiFaux?.active && d.vraiFaux.count > 0)
      instructions.push(`- EXACTEMENT ${d.vraiFaux.count} Vrai/Faux : type="vraiFaux", "answer":"Vrai" ou "Faux"`);
    if (d.ordre?.active && d.ordre.count > 0)
      instructions.push(`- EXACTEMENT ${d.ordre.count} Remise en ordre : type="ordre", "items":[mots mélangés], "answer":[ordre correct]`);
    if (d.saisie?.active && d.saisie.count > 0)
      instructions.push(`- EXACTEMENT ${d.saisie.count} Saisie : type="saisie", "answer": le mot ou groupe de mots exact`);
    if (d.special?.active && d.special.prompt)
      instructions.push(`- 1 question ouverte : type="libre", consigne="${d.special.prompt}", "answer":"LIBRE"`);

    lines.push(`Tu es un enseignant expert. Génère des exercices pédagogiques sur : "${description}".`);
    lines.push(`Génère EXACTEMENT :\n${instructions.join("\n")}`);
  } else {
    const mode = config.details.mode === "clone"
      ? "Mêmes types de questions, change les valeurs et chiffres."
      : "Questions totalement nouvelles sur les mêmes compétences.";
    lines.push(`Tu es un enseignant. Examen : "${description}". Mode : ${mode}. Génère ${config.details.count} variante(s).`);
  }

  lines.push(`
Réponds UNIQUEMENT avec ce JSON brut, sans backticks :
{"exercises":[
  {"id":1,"type":"qcm","question":"...","options":["A","B","C","D"],"answer":"A"},
  {"id":2,"type":"vraiFaux","question":"...","answer":"Vrai"},
  {"id":3,"type":"saisie","question":"Complète : Le chat ___ du lait.","answer":"boit"},
  {"id":4,"type":"ordre","question":"Remets dans l'ordre.","items":["mange","le","chat"],"answer":["le","chat","mange"]}
]}`);

  return lines.join("\n");
}

// ─── CONSTRUCTION DU PROMPT DE VÉRIFICATION ──────────────────────────────────
function buildVerificationPrompt(exercises: any[]): string {
  return `Tu es un enseignant correcteur expert et rigoureux.
Voici une liste d'exercices générés par une IA. Vérifie CHAQUE réponse ("answer") et corrige-la si elle est fausse.

Exercices à vérifier :
${JSON.stringify(exercises, null, 2)}

RÈGLES :
- Pour chaque exercice, vérifie si "answer" est factuellement correct.
- Si une réponse est fausse, remplace-la par la bonne réponse.
- Pour type="qcm" : "answer" doit être le texte EXACT d'une des options dans "options". Si tu corriges, choisis une option existante.
- Pour type="vraiFaux" : "answer" doit être "Vrai" ou "Faux" (avec majuscule).
- Pour type="saisie" : "answer" doit être le mot ou groupe exact attendu.
- Pour type="ordre" : "answer" doit être le tableau dans l'ordre correct.
- Ne modifie PAS les questions, seulement les réponses si nécessaire.
- Conserve EXACTEMENT la même structure JSON.

Réponds UNIQUEMENT avec le JSON corrigé, sans backticks, sans explication :
{"exercises":[...]}`;
}

// ─── SERVICE PRINCIPAL ───────────────────────────────────────────────────────
export const iaService = {

  async generateExercises(description: string, configStr: string) {
    if (!OPENROUTER_KEY || OPENROUTER_KEY.includes("ta_cle")) {
      throw new Error("Clé API manquante dans .env.local");
    }

    const config = JSON.parse(configStr);
    logger.info("=== ÉTAPE 1 : Génération ===", { description });

    // ── Étape 1 : Génération par le modèle 1 ─────────────────────────────
    const generationPrompt = buildGenerationPrompt(description, config);
    const { result: generated, modelUsed: genModel } = await callWithFallback(generationPrompt, false);
    logger.info(`✅ Généré par ${genModel} — ${generated.exercises?.length ?? 0} exercice(s)`);

    // ── Étape 2 : Vérification par un modèle différent ───────────────────
    logger.info("=== ÉTAPE 2 : Vérification ===");
    try {
      const verificationPrompt = buildVerificationPrompt(generated.exercises);
      // On saute le premier modèle (déjà utilisé en génération) pour avoir un 2ème avis
      const skipFirst = genModel === MODELS[0];
      const { result: verified, modelUsed: verModel } = await callWithFallback(verificationPrompt, skipFirst);
      logger.info(`✅ Vérifié par ${verModel}`);

      // Sécurité : si la vérification retourne moins d'exercices, on garde l'original
      if (verified.exercises?.length >= generated.exercises.length) {
        return verified;
      }
      logger.error("Vérification incomplète — on garde la version originale");
      return generated;
    } catch (err: any) {
      // Si la vérification échoue, on retourne quand même la version générée
      logger.error("Vérification échouée (non bloquant) :", err.message);
      return generated;
    }
  },

  // ─── ÉVALUATION RÉPONSE LIBRE ──────────────────────────────────────────
  async evaluateFreeAnswer(question: string, userAnswer: string): Promise<{ correct: boolean; comment: string }> {
    const prompt = `Correcteur pédagogique. Question: "${question}" | Réponse élève: "${userAnswer}"
Évalue si acceptable sur le fond. Réponds UNIQUEMENT avec ce JSON :
{"correct":true,"comment":"Bravo."} ou {"correct":false,"comment":"Ce qui manque."}`;

    for (const model of MODELS) {
      try { return await callModel(prompt, model); } catch { continue; }
    }
    return { correct: false, comment: "Évaluation indisponible." };
  },
};
