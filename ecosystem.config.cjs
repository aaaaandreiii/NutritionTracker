require('dotenv').config();

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
        SUGAR_PAI_ENABLE_OFF_LOOKUP: "false"
      }
    },
    {
      name: "nutrition-frontend",
      script: "npm",
      // "preview" serves the production build created by "npm run build"
      args: "run preview -- --host 0.0.0.0 --port " + process.env.FRONTEND_PORT,
      env: {
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL
      }
    }
  ]
};
