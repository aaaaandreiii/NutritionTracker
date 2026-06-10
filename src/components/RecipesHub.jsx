import React, { useState } from 'react';
import { ChefHat, Sparkles, Plus, Trash2, Check, ShoppingCart } from 'lucide-react';
import { DAILY_DOZEN_CATEGORIES } from '../data/constants';

export default function RecipesHub({ recipes, setRecipes, pantry, setGroceryList, groceryList, handleCookAndLogRecipe, dailyDozenDeficits }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add'
  const [loading, setLoading] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    tagline: '',
    ingredients: '',
    instructions: '',
    prepTime: '20 mins',
    cookTime: '15 mins',
    cals: 250,
    servings: {}
  });

  const handleGenerateLocalRecipe = () => {
    setLoading(true);

    setTimeout(() => {
      const topDeficits = dailyDozenDeficits.length > 0 ? dailyDozenDeficits : [{ key: 'beans', lacking: 1 }];
      const focusCategory = topDeficits[0].key;

      const recipesPool = [
        {
          name: "Golden Turmeric Lentil Stew",
          focus: "beans",
          servings: { beans: 2, herbsSpices: 1, otherVeggies: 1 },
          ingredients: [
            { name: "Lentils", amount: "1 cup", category: "beans" },
            { name: "Spinach", amount: "2 cups", category: "greens" },
            { name: "Carrots", amount: "1 medium", category: "otherVeggies" },
            { name: "Turmeric", amount: "1/4 tsp", category: "herbsSpices" }
          ],
          instructions: [
            "Rinse red lentils under cold water.",
            "Simmer carrots, red lentils, and vegetable broth for 15 minutes.",
            "Stir in 1 tsp turmeric and a pinch of black pepper.",
            "Fold in fresh spinach and let wilt."
          ],
          prepTime: "10 mins",
          cookTime: "25 mins",
          cals: 320
        },
        {
          name: "Powerhouse Antioxidant Oatmeal Bowl",
          focus: "berries",
          servings: { berries: 1, otherFruits: 1, nutsSeeds: 1, wholeGrains: 2 },
          ingredients: [
            { name: "Oatmeal", amount: "1/2 cup", category: "wholeGrains" },
            { name: "Blueberries", amount: "1/2 cup", category: "berries" },
            { name: "Ground Flaxseeds", amount: "1 tbsp", category: "flaxseeds" },
            { name: "Walnuts", amount: "2 tbsp", category: "nutsSeeds" }
          ],
          instructions: [
            "Cook rolled oats in soy milk or water for 5 minutes.",
            "Stir in ground flaxseeds.",
            "Top with blueberries and walnuts."
          ],
          prepTime: "5 mins",
          cookTime: "8 mins",
          cals: 340
        }
      ];

      const recipeMatch = recipesPool.find(r => r.focus === focusCategory) || recipesPool[0];

      const generatedRecipe = {
        id: `local_rec_${Date.now()}`,
        name: `💡 Chef's ${recipeMatch.name}`,
        tagline: `Lower your deficits in ${focusCategory}`,
        ingredients: recipeMatch.ingredients,
        steps: recipeMatch.instructions,
        dozenServings: recipeMatch.servings,
        prepTime: recipeMatch.prepTime,
        cookTime: recipeMatch.cookTime,
        cals: recipeMatch.cals
      };

      setRecipes(prev => [generatedRecipe, ...prev]);
      setActiveTab('list');
      setLoading(false);
    }, 900);
  };

  const checkPantryCoverage = (recipeIngredients) => {
    let owned = 0;
    recipeIngredients.forEach(ing => {
      const isStocked = pantry.some(p => 
        ing.name.toLowerCase().includes(p.name.toLowerCase()) || 
        p.name.toLowerCase().includes(ing.name.toLowerCase())
      );
      if (isStocked) owned++;
    });
    return { owned, total: recipeIngredients.length };
  };

  const handleAddMissingToGrocery = (recipeIngredients) => {
    const missing = recipeIngredients.filter(ing => {
      return !pantry.some(p => 
        ing.name.toLowerCase().includes(p.name.toLowerCase()) || 
        p.name.toLowerCase().includes(ing.name.toLowerCase())
      );
    });

    const newGroceryItems = missing.map(ing => ({
      id: `g_missing_${Date.now()}_${Math.random()}`,
      name: ing.name,
      category: ing.category || 'otherVeggies',
      quantity: 1,
      checked: false
    }));

    setGroceryList(prev => [...prev, ...newGroceryItems]);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!newRecipe.name || !newRecipe.ingredients) return;

    const parsedIngredients = newRecipe.ingredients.split(',').map(i => ({
      name: i.trim(),
      category: 'otherVeggies',
      amount: '1 unit'
    }));
    const parsedInstructions = newRecipe.instructions.split('\n').filter(i => i.trim());

    const createdRecipe = {
      id: `manual_rec_${Date.now()}`,
      name: newRecipe.name,
      tagline: newRecipe.tagline || 'Custom plant-based energy source',
      ingredients: parsedIngredients,
      steps: parsedInstructions,
      prepTime: newRecipe.prepTime,
      cookTime: newRecipe.cookTime,
      cals: newRecipe.cals,
      dozenServings: newRecipe.servings
    };

    setRecipes(prev => [createdRecipe, ...prev]);
    setNewRecipe({
      name: '',
      tagline: '',
      ingredients: '',
      instructions: '',
      prepTime: '20 mins',
      cookTime: '15 mins',
      cals: 250,
      servings: {}
    });
    setActiveTab('list');
  };

  const handleServingsChange = (catId, value) => {
    const valNum = parseFloat(value) || 0;
    setNewRecipe(prev => ({
      ...prev,
      servings: {
        ...prev.servings,
        [catId]: valNum
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-500" /> Recipes & Cooking
          </h2>
          <p className="text-xs text-gray-400 mt-1">Cook whole-food, plant-based recipes and auto-deduct ingredients</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeTab === 'list'
                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
            }`}
          >
            Catalog
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeTab === 'add'
                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
            }`}
          >
            Create
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-700 font-serif">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold">Dynamic Recipe Builder</h3>
            </div>
            <p className="text-xs text-gray-500">
              Instantly compile a recipe targeted for your current 
              <span className="text-rose-500 font-semibold"> Daily Dozen deficits</span>.
            </p>
          </div>
          <button
            onClick={handleGenerateLocalRecipe}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-5 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? <span className="animate-spin">🌀</span> : 'Auto-Build Recipe'}
          </button>
        </div>
      )}

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map(recipe => {
            const { owned, total } = checkPantryCoverage(recipe.ingredients);
            const missingCount = total - owned;
            const isFullyStocked = missingCount === 0;

            return (
              <div key={recipe.id} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-bold text-gray-900 font-serif leading-snug">{recipe.name}</h3>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 ${
                      isFullyStocked 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {isFullyStocked ? 'Pantry Fully Stocked' : `${owned}/${total} in stock`}
                    </span>
                  </div>

                  <div className="text-xs text-gray-550 font-medium italic mb-3 leading-relaxed">
                    "{recipe.tagline}"
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400 font-medium mb-4">
                    <span>⏱ {recipe.prepTime} prep • {recipe.cookTime} cook</span>
                    <span>🔥 {recipe.cals} kcal</span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-4">
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Yields:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(recipe.dozenServings || {}).map(([key, val]) => {
                        const label = DAILY_DOZEN_CATEGORIES.find(c => c.id === key)?.label || key;
                        if (val <= 0) return null;
                        return (
                          <span key={key} className="text-[10px] bg-white text-gray-700 border border-gray-100 px-2.5 py-0.5 rounded-lg shadow-xs font-semibold">
                            {label}: <strong className="text-emerald-600">+{val}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs font-bold text-gray-700 mb-1.5">Ingredients:</div>
                    <ul className="text-xs text-gray-500 space-y-1">
                      {recipe.ingredients.map((ing, idx) => {
                        const inStock = pantry.some(p => 
                          ing.name.toLowerCase().includes(p.name.toLowerCase()) || 
                          p.name.toLowerCase().includes(ing.name.toLowerCase())
                        );
                        return (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                            <span className={inStock ? 'text-gray-700 font-medium' : 'text-gray-400'}>{ing.name} ({ing.amount})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mb-5">
                    <div className="text-xs font-bold text-gray-700 mb-1.5">Instructions:</div>
                    <ol className="text-xs text-gray-500 space-y-1.5 list-decimal pl-4 leading-relaxed font-serif">
                      {recipe.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-gray-50 pt-4 mt-auto">
                  {!isFullyStocked && (
                    <button
                      onClick={() => handleAddMissingToGrocery(recipe.ingredients)}
                      className="flex-1 bg-white hover:bg-gray-50 text-indigo-700 text-xs py-2 rounded-xl font-semibold border border-indigo-100 shadow-xs"
                    >
                      Buy Missing (+{missingCount})
                    </button>
                  )}
                  <button
                    onClick={() => handleCookAndLogRecipe(recipe)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-xl transition-colors font-semibold"
                  >
                    Cook & Log to Lunch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5 max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Recipe Name</label>
              <input
                type="text"
                placeholder="e.g., Savory Tempeh Quinoa"
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                className="w-full bg-gray-50 text-gray-800 rounded-xl p-2.5 text-sm border border-gray-100 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tagline</label>
              <input
                type="text"
                placeholder="Brief description"
                value={newRecipe.tagline}
                onChange={(e) => setNewRecipe({ ...newRecipe, tagline: e.target.value })}
                className="w-full bg-gray-50 text-gray-800 rounded-xl p-2.5 text-sm border border-gray-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Prep Time</label>
              <input
                type="text"
                value={newRecipe.prepTime}
                onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })}
                className="w-full bg-gray-50 text-gray-800 rounded-xl p-2 text-sm border border-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cook Time</label>
              <input
                type="text"
                value={newRecipe.cookTime}
                onChange={(e) => setNewRecipe({ ...newRecipe, cookTime: e.target.value })}
                className="w-full bg-gray-50 text-gray-800 rounded-xl p-2 text-sm border border-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Calories</label>
              <input
                type="number"
                value={newRecipe.cals}
                onChange={(e) => setNewRecipe({ ...newRecipe, cals: Number(e.target.value) || 0 })}
                className="w-full bg-gray-50 text-gray-800 rounded-xl p-2 text-sm border border-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ingredients (Comma Separated)</label>
            <textarea
              rows="2"
              placeholder="e.g., Quinoa, Black Beans, Spinach"
              value={newRecipe.ingredients}
              onChange={(e) => setNewRecipe({ ...newRecipe, ingredients: e.target.value })}
              className="w-full bg-gray-50 text-gray-800 rounded-xl p-2.5 text-sm border border-gray-100 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Instructions (One step per line)</label>
            <textarea
              rows="3"
              placeholder="Boil quinoa.&#10;Stir in black beans."
              value={newRecipe.instructions}
              onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
              className="w-full bg-gray-50 text-gray-800 rounded-xl p-2.5 text-sm border border-gray-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Assign Servings</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <div key={cat.id} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 truncate">{cat.label}</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0"
                    value={newRecipe.servings[cat.id] || ''}
                    onChange={(e) => handleServingsChange(cat.id, e.target.value)}
                    className="w-full bg-white text-gray-800 rounded-lg p-1 text-xs border border-gray-100 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs py-2.5 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-bold"
            >
              Save Custom Recipe
            </button>
          </div>
        </form>
      )}
    </div>
  );
}