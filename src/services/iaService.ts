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
      max_tokens: 8000,
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

// ─── APPEL AVEC CASCADE ───────────────────────────────────────────────────────
async function callWithFallback(prompt: string): Promise<{ result: any; modelUsed: string }> {
  const errors: string[] = [];
  for (const model of MODELS) {
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

// ─── CONSTRUCTION DU PROMPT ───────────────────────────────────────────────────
function buildGenerationPrompt(description: string, config: any): string {
  const lines: string[] = [];

  if (config.type === "cours") {
    const d = config.details;
    const instructions: string[] = [];

    if (d.qcm?.active && d.qcm.count > 0)
      instructions.push(`- EXACTEMENT ${d.qcm.count} QCM : type="qcm", "options": 4 choix OBLIGATOIREMENT DIFFÉRENTS ET PLAUSIBLES (même famille grammaticale ou même registre, formes proches mais distinctes — JAMAIS deux options identiques ou quasi-identiques), "answer": texte exact de la bonne option`);
    if (d.vraiFaux?.active && d.vraiFaux.count > 0)
      instructions.push(`- EXACTEMENT ${d.vraiFaux.count} Vrai/Faux : type="vraiFaux", "answer":"Vrai" ou "Faux"`);
    if (d.ordre?.active && d.ordre.count > 0)
      instructions.push(`- EXACTEMENT ${d.ordre.count} Remise en ordre : type="ordre", "items":[mots mélangés], "answer":[ordre correct]`);
    if (d.saisie?.active && d.saisie.count > 0)
      instructions.push(`- EXACTEMENT ${d.saisie.count} Saisie : type="saisie", "answer": le mot ou groupe de mots exact attendu`);
    if (d.special?.active && d.special.prompt)
      instructions.push(`- 1 question ouverte : type="libre", consigne="${d.special.prompt}", "answer":"LIBRE"`);

    lines.push(`Tu es un enseignant expert. Génère des exercices pédagogiques variés sur : "${description}".`);
    lines.push(`Génère EXACTEMENT :\n${instructions.join("\n")}`);
    lines.push(`
RÈGLES IMPORTANTES :
1. QCM — Les 4 options doivent être TOUTES DIFFÉRENTES et PLAUSIBLES.
   Exemple correct pour conjugaison : ["il a mangé", "il mangeait", "il mange", "il mangera"]
   Exemple INTERDIT : ["il a mangé", "il a mangé", "il a manger", "il a mangé"] ← options quasi-identiques
   Les mauvaises options doivent être des erreurs courantes ou des formes voisines, pas des copies.

2. CONTEXTE DE TEMPS — Si le sujet porte sur plusieurs temps ou conjugaisons, PRÉCISE le temps dans chaque question.
   Exemple correct : "Conjugue au passé composé : elle ___ (partir)"
   Exemple INTERDIT : "Conjugue : elle ___ (partir)" ← temps non précisé

3. VARIÉTÉ — Chaque question doit porter sur un verbe ou un cas différent. Ne répète pas le même verbe.

4. Vrai/Faux — Vérifie que ta réponse est factuellement correcte avant de l'écrire.`);

  } else {
    const mode = config.details.mode === "clone"
      ? "Mêmes types de questions, change les valeurs et chiffres."
      : "Questions totalement nouvelles sur les mêmes compétences.";
    lines.push(`Tu es un enseignant. Examen : "${description}". Mode : ${mode}. Génère ${config.details.count} variante(s).`);
  }

  lines.push(`
Réponds UNIQUEMENT avec ce JSON brut, sans backticks, sans texte avant ou après :
{"exercises":[
  {"id":1,"type":"qcm","question":"Conjugue au passé composé : il ___ (finir)","options":["il a fini","il finissait","il finira","il finit"],"answer":"il a fini"},
  {"id":2,"type":"vraiFaux","question":"Le verbe 'partir' se conjugue avec l'auxiliaire 'avoir' au passé composé.","answer":"Faux"},
  {"id":3,"type":"saisie","question":"Conjugue au présent : nous ___ (venir)","answer":"venons"},
  {"id":4,"type":"ordre","question":"Remets dans l'ordre.","items":["sommes","nous","partis"],"answer":["nous","sommes","partis"]}
]}`);

  return lines.join("\n");
}

// ─── SERVICE PRINCIPAL ───────────────────────────────────────────────────────
export const iaService = {

  async generateExercises(description: string, configStr: string) {
    if (!OPENROUTER_KEY || OPENROUTER_KEY.includes("ta_cle")) {
      throw new Error("Clé API manquante dans .env.local");
    }

    const config = JSON.parse(configStr);
    logger.info("Génération démarrée", { description });

    // ✅ Une seule étape : génération directe (vérification supprimée)
    const prompt = buildGenerationPrompt(description, config);
    const { result, modelUsed } = await callWithFallback(prompt);
    logger.info(`✅ Généré par ${modelUsed} — ${result.exercises?.length ?? 0} exercice(s)`);
    return result;
  },

  // ─── ÉVALUATION RÉPONSE LIBRE ─────────────────────────────────────────
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
