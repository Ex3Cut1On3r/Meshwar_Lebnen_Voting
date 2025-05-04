// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },

  // Add other Nuxt config options if you have them

  runtimeConfig: {
    // Variables defined here are available server-side
    googleSheetsClientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    googleSheetsPrivateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    googleSheetId: process.env.GOOGLE_SHEET_ID,
    webhookSecretToken: process.env.WEBHOOK_SECRET_TOKEN, // Expose webhook secret

    // Public variables (accessible client-side) - Keep empty if not needed
    public: {}
  },

  compatibilityDate: "2025-05-04"
})