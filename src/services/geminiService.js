import { dailyDozenCategories } from '../data/constants';

/**
 * Service to generate healthy whole-food recipes based on local pantry stock and active nutritional deficits.
 * Supports exponential backoff to handle rate limits.
 */
export async function fetchAIRecipe(pantry, deficits, selectedPreset, customPrompt = '') {
  const pantryString = pantry.filter(p => p.quantity > 0).map(p => p.name).join(', ');
  const deficitsString = Object.entries(deficits)
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => `${dailyDozenCategories.find(c => c.id === id)?.label} (${qty.toFixed(1)} remaining)`)
    .join(', ');

  const userGoalInstructions = `The user is focused on the target template: "${selectedPreset}".`;
  const systemInstructionPrompt = `You are a world-class plant-based culinary master specializing in Dr. Michael Greger's Daily Dozen. 
  You generate highly detailed, delicious, scientifically optimal recipes matching exact nutrient targets.
  You must strictly return output matching the requested JSON Schema without additional commentary outside the JSON object.`;

  const promptRequest = `Create a brand new plant-based recipe.
  ${pantryString ? `Highly prioritize incorporating these items currently in the user's pantry: [${pantryString}].` : ""}
  ${deficitsString ? `Intentionally formulate this recipe to help fulfill these lacking Daily Dozen groups: [${deficitsString}].` : ""}
  ${customPrompt ? `Incorporate the user's specific craving or goal: "${customPrompt}".` : "Make it a creative, nutrient-dense main or side."}
  ${userGoalInstructions}`;

  const payload = {
    contents: [{ parts: [{ text: promptRequest }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Vibrant culinary name of the dish" },
          tagline: { type: "STRING", description: "One-sentence tagline explaining why this fits Dr. Greger's advice" },
          prepTime: { type: "STRING" },
          cookTime: { type: "STRING" },
          cals: { type: "INTEGER" },
          dozenServings: {
            type: "OBJECT",
            properties: dailyDozenCategories.reduce((acc, cat) => ({
              ...acc,
              [cat.id]: { type: "NUMBER", description: `Portion score for ${cat.label}` }
            }), {})
          },
          ingredients: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                amount: { type: "STRING" },
                category: { type: "STRING", description: "Must exactly match one of the keys: beans, berries, otherFruits, cruciferous, greens, otherVeggies, flaxseeds, nutsSeeds, herbsSpices, wholeGrains, beverages" }
              },
              required: ["name", "amount", "category"]
            }
          },
          steps: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        required: ["name", "tagline", "prepTime", "cookTime", "cals", "dozenServings", "ingredients", "steps"]
      }
    },
    systemInstruction: {
      parts: [{ text: systemInstructionPrompt }]
    }
  };

  // Secure user API key configuration or default platform fallback
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  // Execute fetch with a basic retry system
  let delay = 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Received malformed or empty content from the model.");

      return JSON.parse(rawText);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential Backoff
    }
  }
}