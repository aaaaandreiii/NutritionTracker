import React, { useState } from 'react';
import { ChefHat, Plus, Check, Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { DAILY_DOZEN_CATEGORIES } from '../data/constants';

export default function RecipesHub({
  recipes,
  setRecipes,
  pantry,
  setGroceryList,
  groceryList,
  handleCookAndLogRecipe,
  dailyDozenDeficits
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add' | 'ai'
  const [loading, setLoading] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    ingredients: '',
    instructions: '',
    prepTime: '20 mins',
    difficulty: 'Easy',
    servings: {}
  });

  // Local Offline Recipe Generation Engine (No API Keys needed!)
  const handleGenerateLocalRecipe = () => {
    setLoading(true);

    setTimeout(() => {
      // Find what category is most deficient to customize the result
      const topDeficits = dailyDozenDeficits.length > 0 ? dailyDozenDeficits : [{ key: 'beans', lacking: 1 }];
      const focusCategory = topDeficits[0].key;
      const categoryLabel = DAILY_DOZEN_CATEGORIES.find(c => c.key === focusCategory)?.name || "Superfoods";

      // Prepare a pool of Dr. Greger friendly recipes matching different categories
      const recipesPool = [
        {
          name: "Golden Turmeric Lentil Stew",
          focus: "beans",
          servings: { beans: 2, spices: 1, other_veggies: 1 },
          ingredients: ["Red Lentils", "Spinach", "Carrots", "Turmeric", "Black Pepper", "Garlic", "Vegetable Broth"],
          instructions: [
            "Rinse 1 cup red lentils under cold water.",
            "In a large pot, simmer carrots, garlic, red lentils, and vegetable broth for 15 minutes.",
            "Stir in 1 tsp turmeric and a pinch of black pepper (to activate curcumin absorption).",
            "Fold in fresh spinach and let wilt for 2 minutes before serving."
          ],
          prepTime: "20 mins",
          difficulty: "Easy"
        },
        {
          name: "Powerhouse Antioxidant Oatmeal Bowl",
          focus: "berries",
          servings: { berries: 1, other_fruits: 1, nuts_seeds: 1, whole_grains: 1 },
          ingredients: ["Rolled Oats", "Blueberries", "Banana", "Flaxseed (ground)", "Walnuts", "Soy Milk"],
          instructions: [
            "Combine rolled oats and soy milk in a saucepan; cook over medium heat for 5 minutes.",
            "Pour oats into a bowl and stir in 1 tbsp of ground flaxseed immediately.",
            "Top with wild blueberries, sliced banana, and walnut halves."
          ],
          prepTime: "10 mins",
          difficulty: "Easy"
        },
        {
          name: "Crispy Cruciferous Ginger Tofu Stir-Fry",
          focus: "cruciferous",
          servings: { cruciferous: 2, beans: 1.5, spices: 0.5, other_veggies: 1 },
          ingredients: ["Extra Firm Tofu", "Broccoli Florets", "Brussels Sprouts", "Ginger", "Bell Pepper", "Tamari"],
          instructions: [
            "Press and cube the tofu, baking or air-frying at 400°F (200°C) until golden.",
            "Sauté chopped broccoli and shredded Brussels sprouts with a splash of water and ginger.",
            "Add sliced bell peppers and the cooked tofu.",
            "Drizzle with tamari and stir-fry for 3-4 minutes."
          ],
          prepTime: "15 mins",
          difficulty: "Medium"
        },
        {
          name: "Mediterranean Greens & Bean Salad",
          focus: "greens",
          servings: { greens: 2, beans: 1.5, other_veggies: 1 },
          ingredients: ["Kale (shredded)", "Garbanzo Beans (chickpeas)", "Cherry Tomatoes", "Cucumber", "Lemon Juice", "Tahini"],
          instructions: [
            "Massage shredded kale with a squeeze of lemon juice to soften.",
            "Rinse and drain canned garbanzo beans, then toss with the massaged kale.",
            "Toss in sliced tomatoes and diced cucumbers.",
            "Whisk tahini and lemon juice with water to make a creamy oil-free dressing, and toss."
          ],
          prepTime: "12 mins",
          difficulty: "Easy"
        }
      ];

      // Find best match or default
      const recipeMatch = recipesPool.find(r => r.focus === focusCategory) || recipesPool[0];

      // Build recipe object incorporating local pantry items if matching names exist
      const enrichedIngredients = recipeMatch.ingredients.map(ing => {
        const matchesPantry = pantry.some(p => p.name.toLowerCase().includes(ing.toLowerCase()));
        return matchesPantry ? `${ing} (In Pantry)` : ing;
      });

      const generatedRecipe = {
        id: 'local-' + Date.now(),
        name: `💡 Local Chef's ${recipeMatch.name}`,
        ingredients: enrichedIngredients,
        instructions: recipeMatch.instructions,
        servings: recipeMatch.servings,
        prepTime: recipeMatch.prepTime,
        difficulty: recipeMatch.difficulty
      };

      setRecipes([generatedRecipe, ...recipes]);
      setActiveTab('list');
      setLoading(false);
    }, 900);
  };

  // Check how many ingredients are present in current pantry
  const checkPantryCoverage = (recipeIngredients) => {
    let owned = 0;
    recipeIngredients.forEach(ing => {
      const isStocked = pantry.some(p => 
        ing.toLowerCase().includes(p.name.toLowerCase()) || 
        p.name.toLowerCase().includes(ing.toLowerCase())
      );
      if (isStocked) owned++;
    });
    return { owned, total: recipeIngredients.length };
  };

  // Add all missing ingredients to grocery list
  const handleAddMissingToGrocery = (recipeIngredients) => {
    const missing = recipeIngredients.filter(ing => {
      return !pantry.some(p => 
        ing.toLowerCase().includes(p.name.toLowerCase()) || 
        p.name.toLowerCase().includes(ing.toLowerCase())
      );
    });

    const newGroceryItems = missing.map(name => {
      // clean pantry tag
      const cleanName = name.replace('(In Pantry)', '').trim();
      return {
        id: Date.now() + Math.random().toString(),
        name: cleanName,
        category: 'other_veggies', // default category
        checked: false
      };
    });

    setGroceryList([...groceryList, ...newGroceryItems]);
  };

  // Manual Recipe Form Handler
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!newRecipe.name || !newRecipe.ingredients) return;

    const parsedIngredients = newRecipe.ingredients.split(',').map(i => i.trim());
    const parsedInstructions = newRecipe.instructions.split('\n').filter(i => i.trim());

    const createdRecipe = {
      id: Date.now().toString(),
      name: newRecipe.name,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      prepTime: newRecipe.prepTime,
      difficulty: newRecipe.difficulty,
      servings: newRecipe.servings
    };

    setRecipes([createdRecipe, ...recipes]);
    setNewRecipe({
      name: '',
      ingredients: '',
      instructions: '',
      prepTime: '20 mins',
      difficulty: 'Easy',
      servings: {}
    });
    setActiveTab('list');
  };

  const handleServingsChange = (catKey, value) => {
    const valNum = parseFloat(value) || 0;
    setNewRecipe({
      ...newRecipe,
      servings: {
        ...newRecipe.servings,
        [catKey]: valNum
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-500" /> Recipes & Healthy Cooking
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Cook whole-food, plant-based recipes with dynamic serving calculations</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === 'list'
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1" /> Recipe Catalog
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === 'add'
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Recipe
          </button>
        </div>
      </div>

      {/* QUICK OFFLINE RECIPE RECOMMENDER */}
      {activeTab === 'list' && (
        <div className="bg-gradient-to-r from-amber-950/20 to-zinc-900 border border-amber-900/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Local AI Chef Suggestion</h3>
            </div>
            <p className="text-xs text-zinc-300">
              Instantly create a dynamic recipe tailored to your current 
              <span className="text-rose-400 font-semibold"> Daily Dozen deficits</span>. Zero setup needed!
            </p>
          </div>
          <button
            onClick={handleGenerateLocalRecipe}
            disabled={loading}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 text-white text-xs px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing Kitchen...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Suggest Recipe
              </>
            )}
          </button>
        </div>
      )}

      {/* RENDER MODES */}
      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map(recipe => {
            const { owned, total } = checkPantryCoverage(recipe.ingredients);
            const missingCount = total - owned;
            const isFullyStocked = missingCount === 0;

            return (
              <div key={recipe.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-bold text-white">{recipe.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                      isFullyStocked 
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800' 
                        : 'bg-amber-950/40 text-amber-400 border-amber-900'
                    }`}>
                      {isFullyStocked ? 'Pantry Fully Stocked' : `${owned}/${total} Ingredients`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400 mb-4">
                    <span>⏱ {recipe.prepTime}</span>
                    <span>•</span>
                    <span>📈 {recipe.difficulty}</span>
                  </div>

                  {/* Daily Dozen Portions Box */}
                  <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 mb-4">
                    <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Serving Contribution:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(recipe.servings).map(([key, val]) => {
                        const label = DAILY_DOZEN_CATEGORIES.find(c => c.key === key)?.name || key;
                        return (
                          <span key={key} className="text-[10px] bg-zinc-900 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded">
                            {label}: <strong className="text-white">+{val}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ingredients Listing */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-zinc-300 mb-1.5">Ingredients:</div>
                    <ul className="text-xs text-zinc-400 space-y-1">
                      {recipe.ingredients.map((ing, idx) => {
                        const inStock = pantry.some(p => 
                          ing.toLowerCase().includes(p.name.toLowerCase()) || 
                          p.name.toLowerCase().includes(ing.toLowerCase())
                        );
                        return (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-zinc-700'}`}></span>
                            <span className={inStock ? 'text-zinc-200' : 'text-zinc-500'}>{ing}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Instructions */}
                  <div className="mb-5">
                    <div className="text-xs font-semibold text-zinc-300 mb-1.5">Instructions:</div>
                    <ol className="text-xs text-zinc-500 space-y-1.5 list-decimal pl-4">
                      {recipe.instructions.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-zinc-800/80 pt-4">
                  {!isFullyStocked && (
                    <button
                      onClick={() => handleAddMissingToGrocery(recipe.ingredients)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs py-2 rounded-xl transition-colors font-medium border border-zinc-700/60"
                    >
                      Buy Missing (+{missingCount})
                    </button>
                  )}
                  <button
                    onClick={() => handleCookAndLogRecipe(recipe)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-xl transition-colors font-semibold shadow"
                  >
                    Cook & Log Meal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MANUAL CREATOR TAB */
        <form onSubmit={handleManualSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5 max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Recipe Name</label>
              <input
                type="text"
                placeholder="e.g., Savory Tempeh Quinoa"
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-800 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Prep Time</label>
                <input
                  type="text"
                  placeholder="e.g., 20 mins"
                  value={newRecipe.prepTime}
                  onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })}
                  className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-800 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Difficulty</label>
                <select
                  value={newRecipe.difficulty}
                  onChange={(e) => setNewRecipe({ ...newRecipe, difficulty: e.target.value })}
                  className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-800 focus:outline-none focus:border-amber-500"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Ingredients (Comma Separated)</label>
            <textarea
              rows="2"
              placeholder="e.g., 1 cup Quinoa, 1 cup Black Beans, Handful of spinach"
              value={newRecipe.ingredients}
              onChange={(e) => setNewRecipe({ ...newRecipe, ingredients: e.target.value })}
              className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-800 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Cooking Instructions (One per line)</label>
            <textarea
              rows="3"
              placeholder="e.g., Boil quinoa for 15 minutes.&#10;Stir in rinsed black beans.&#10;Fold in raw spinach."
              value={newRecipe.instructions}
              onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
              className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-800 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5">Assign Daily Dozen Servings (Portions)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <div key={cat.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-zinc-400 truncate">{cat.name}</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0"
                    value={newRecipe.servings[cat.key] || ''}
                    onChange={(e) => handleServingsChange(cat.key, e.target.value)}
                    className="w-full bg-zinc-900 text-white rounded p-1.5 text-xs border border-zinc-800 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs py-2.5 rounded-lg font-medium border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs py-2.5 rounded-lg font-bold"
            >
              Save Recipe
            </button>
          </div>
        </form>
      )}
    </div>
  );
}