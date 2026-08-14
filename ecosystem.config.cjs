const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { loadEnvFile } = require("node:process");

const envFile = resolve(__dirname, ".env");
if (existsSync(envFile)) {
  loadEnvFile(envFile);
}

const frontendPort = process.env.FRONTEND_PORT || "4173";

module.exports = {
  apps: [
    {
      name: "nutrition-backend",
      script: "python3",
      args: "-m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000",
      // If you are using a virtual environment, change script to your venv's python executable
      // e.g., script: "./venv/bin/python"
      env: {
        LLM_PROVIDER: process.env.LLM_PROVIDER,
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
        SUGAR_PAI_VISION_MODEL: process.env.SUGAR_PAI_VISION_MODEL,
        SUGAR_PAI_EXTRACTION_MODEL: process.env.SUGAR_PAI_EXTRACTION_MODEL,
        SUGAR_PAI_VISION_TIMEOUT_SECONDS: process.env.SUGAR_PAI_VISION_TIMEOUT_SECONDS,
        SUGAR_PAI_LLM_TIMEOUT_SECONDS: process.env.SUGAR_PAI_LLM_TIMEOUT_SECONDS,
        SUGAR_PAI_CHAT_MODEL: process.env.SUGAR_PAI_CHAT_MODEL,
        SUGAR_PAI_CHAT_TIMEOUT_SECONDS: process.env.SUGAR_PAI_CHAT_TIMEOUT_SECONDS,
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
        SUGAR_PAI_ENABLE_OFF_LOOKUP: process.env.SUGAR_PAI_ENABLE_OFF_LOOKUP,
        SUGAR_PAI_OFF_DB_PATH: process.env.SUGAR_PAI_OFF_DB_PATH
      }
    },
    {
      name: "nutrition-frontend",
      script: "npm",
      // "preview" serves the production build created by "npm run build"
      args: "run preview -- --host 0.0.0.0 --port " + frontendPort,
      env: {
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL
      }
    }
  ]
};
