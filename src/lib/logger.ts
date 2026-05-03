// src/lib/logger.ts
export const logger = {
  info: (msg: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ℹ️ ${msg}`, data || "");
    // Optionnel : Envoyer vers une table "logs" Supabase plus tard
  },
  error: (msg: string, err?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`[${timestamp}] ❌ ${msg}`, err || "");
  }
};