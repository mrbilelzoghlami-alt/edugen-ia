// Lance avec : node test_models.js
// Lecture manuelle du .env.local sans dépendance externe
const fs = require('fs');

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const API_KEY = env['NEXT_PUBLIC_OPENROUTER_API_KEY'];

async function listFreeModels() {
  console.log("🔍 Récupération des modèles gratuits OpenRouter...\n");

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { "Authorization": `Bearer ${API_KEY}` }
  });

  const data = await response.json();

  const free = data.data.filter(m =>
    m.pricing &&
    parseFloat(m.pricing.prompt) === 0 &&
    parseFloat(m.pricing.completion) === 0
  );

  console.log(`✅ ${free.length} modèles GRATUITS :\n`);
  free.forEach(m => console.log(`  "${m.id}"`));

  // Test rapide du 1er modèle
  if (free.length > 0) {
    const testModel = free[0].id;
    console.log(`\n⚡ Test avec : ${testModel}`);
    const testRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: 'Réponds uniquement : {"ok":true}' }],
        max_tokens: 20
      })
    });
    const testData = await testRes.json();
    const reply = testData.choices?.[0]?.message?.content || JSON.stringify(testData.error);
    console.log(`  Réponse : ${reply}`);
  }
}

listFreeModels().catch(console.error);
