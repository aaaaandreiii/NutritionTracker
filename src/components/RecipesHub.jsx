import React, { useState } from 'react';
import { ChefHat, Plus, X, Sparkles, RefreshCw, Clock, CheckCircle2, Check, ListPlus, Play, Trash2 } from 'lucide-react';
import { dailyDozenCategories, mealSlots } from '../data/constants';
import { fetchAIRecipe } from '../services/geminiService';

export default function RecipesHub({
  recipes,
  setRecipes,
  pantry,
  setPantry,
  groceryList,
  setGroceryList,
  deficits,
  selectedPreset,
  triggerToast,
  handleAddToGrocery
}) {
  const [isAddingManualRecipe, setIsAddingManualRecipe] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  // Manual Recipe state definition
  const [manualRecipeForm, setManualRecipeForm] = useState({
    name: '',
    tagline: '',
    prepTime: '10 mins',
    cookTime: '15 mins',
    cals: 250,
    dozenServings: dailyDozenCategories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}),
    ingredients: [{ name: '', amount: '', category: '' }],
    steps: ['']
  });

  const handleGenerateAIRecipe = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      const parsedRecipe = await fetchAIRecipe(pantry, deficits, selectedPreset, aiCustomPrompt);
      
      if (parsedRecipe) {
        parsedRecipe.id = `ai_rec_${Date.now()}`;
        
        // Sanitize servings multiplier structure
        const safeDozen = {};
        dailyDozenCategories.forEach(cat => {
          safeDozen[cat.id] = Number(parsedRecipe.dozenServings[cat.id]) || 0;
        });
        parsedRecipe.dozenServings = safeDozen;

        setRecipes(prev => [parsedRecipe, ...prev]);
        setAiCustomPrompt('');
        triggerToast(`Connected! Formulated & unlocked: "${parsedRecipe.name}"!`, "success");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to connect to the dynamic AI kitchen. Double check your API configuration.", "warning");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveManualRecipe = (e) => {
    e.preventDefault();
    const { name, tagline, prepTime, cookTime, cals, dozenServings, ingredients, steps } = manualRecipeForm;
    if (!name.trim()) return;

    const formattedIngredients = ingredients.filter(i => i.name.trim());
    const formattedSteps = steps.filter(s => s.trim());

    const newRecipe = {
      id: `manual_rec_${Date.now()}`,
      name,
      tagline: tagline || "A customized diet formula.",
      prepTime,
      cookTime,
      cals: Number(cals) || 200,
      dozenServings: { ...dozenServings },
      ingredients: formattedIngredients,
      steps: formattedSteps
    };

    setRecipes(prev => [newRecipe, ...prev]);
    setIsAddingManualRecipe(false);
    
    // Reset structural state
    setManualRecipeForm({
      name: '',
      tagline: '',
      prepTime: '10 mins',
      cookTime: '15 mins',
      cals: 250,
      dozenServings: dailyDozenCategories.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}),
      ingredients: [{ name: '', amount: '', category: '' }],
      steps: ['']
    });
    triggerToast(`Added custom recipe "${newRecipe.name}" successfully!`, "success");
  };

  const handleDeleteRecipe = (recipeId) => {
    if (window.confirm("Delete this recipe from your collection?")) {
      setRecipes(prev => prev.filter(r => r.id !== recipeId));
      triggerToast("Recipe deleted.", "info");
    }
  };

  const handleAddMissingRecipeIngredientsToGrocery = (recipe) => {
    let addedCount = 0;
    recipe.ingredients.forEach(ing => {
      const isStocked = pantry.some(p => p.name.toLowerCase() === ing.name.toLowerCase() && p.quantity > 0);
      const inGrocery = groceryList.some(g => g.name.toLowerCase() === ing.name.toLowerCase());
      
      if (!isStocked && !inGrocery) {
        const servingsMap = {};
        if (ing.category) {
          servingsMap[ing.category] = 1;
        }

        const foodObj = {
          id: `g_ing_${Date.now()}_${Math.random()}`,
          name: ing.name,
          cals: 100,
          servings: servingsMap,
          quantity: 1
        };
        handleAddToGrocery(foodObj);
        addedCount++;
      }
    });

    if (addedCount === 0) {
      triggerToast("All required ingredients already stocked locally!", "info");
    } else {
      triggerToast(`Added ${addedCount} missing ingredients to the grocery list.`, "success");
    }
  };

  const handleCookAndLogRecipe = (recipe, mealSlotId, setIntake) => {
    let deductedFromPantry = [];
    
    setPantry(prev => {
      return prev.map(pItem => {
        const match = recipe.ingredients.find(ing => ing.name.toLowerCase() === pItem.name.toLowerCase());
        if (match && pItem.quantity > 0) {
          deductedFromPantry.push(pItem.name);
          return { ...pItem, quantity: Math.max(0, pItem.quantity - 1) };
        }
        return pItem;
      });
    });

    const mealObj = {
      id: `logged_recipe_${recipe.id}_${Date.now()}`,
      name: recipe.name,
      cals: recipe.cals,
      servings: recipe.dozenServings,
      servingsMultiplier: 1.0
    };

    setIntake(prev => ({
      ...prev,
      [mealSlotId]: [...prev[mealSlotId], mealObj]
    }));

    if (deductedFromPantry.length > 0) {
      triggerToast(`Cooking complete! Deducted (${deductedFromPantry.join(', ')}) from Pantry stock.`, "success");
    } else {
      triggerToast(`Cooking complete! Logged recipe to ${mealSlotId}.`, "success");
    }
  };

  // Helper form functions
  const handleUpdateFormIngredient = (index, key, value) => {
    setManualRecipeForm(prev => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, ingredients: updated };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-serif text-gray-900 font-bold flex items-center gap-2">
            <ChefHat className="text-purple-500" />
            Healthy Culinary Hub
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Discover plant-based cooking. Run AI infinite kitchen cycles to dynamically adapt recipes to active goals.
          </p>
        </div>
        <button 
          onClick={() => setIsAddingManualRecipe(!isAddingManualRecipe)}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-purple-500/10 shrink-0"
        >
          {isAddingManualRecipe ? <X size={14} /> : <Plus size={14} />}
          <span>{isAddingManualRecipe ? "Collapse Builder" : "Create Manual Recipe"}</span>
        </button>
      </div>

      {isAddingManualRecipe && (
        <form onSubmit={handleSaveManualRecipe} className="bg-white border border-purple-100 rounded-3xl p-6 shadow-md animate-in slide-in-from-top-4 duration-300 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Recipe Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Grandma's Garden Lentil Stew" 
                  value={manualRecipeForm.name}
                  onChange={(e) => setManualRecipeForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tagline Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rich in therapeutic fibers and anti-inflammatory spices." 
                  value={manualRecipeForm.tagline}
                  onChange={(e) => setManualRecipeForm(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prep Time</label>
                  <input 
                    type="text" 
                    placeholder="10 mins" 
                    value={manualRecipeForm.prepTime}
                    onChange={(e) => setManualRecipeForm(prev => ({ ...prev, prepTime: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cook Time</label>
                  <input 
                    type="text" 
                    placeholder="20 mins" 
                    value={manualRecipeForm.cookTime}
                    onChange={(e) => setManualRecipeForm(prev => ({ ...prev, cookTime: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Calories</label>
                  <input 
                    type="number" 
                    placeholder="320" 
                    value={manualRecipeForm.cals}
                    onChange={(e) => setManualRecipeForm(prev => ({ ...prev, cals: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Ingredients List</label>
                  <button 
                    type="button" 
                    onClick={() => setManualRecipeForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { name: '', amount: '', category: '' }] }))}
                    className="text-[9px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
                  >
                    + Add Ingredient
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {manualRecipeForm.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <input 
                        type="text" 
                        placeholder="Ingredient Name" 
                        value={ing.name}
                        onChange={(e) => handleUpdateFormIngredient(idx, 'name', e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Qty" 
                        value={ing.amount}
                        onChange={(e) => handleUpdateFormIngredient(idx, 'amount', e.target.value)}
                        className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                      />
                      <select 
                        value={ing.category}
                        onChange={(e) => handleUpdateFormIngredient(idx, 'category', e.target.value)}
                        className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 text-[10px] text-gray-500"
                      >
                        <option value="">No Group</option>
                        {dailyDozenCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button 
              type="button" 
              onClick={() => setIsAddingManualRecipe(false)}
              className="px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-purple-500 text-white text-xs font-bold rounded-xl"
            >
              Save Custom Formula
            </button>
          </div>
        </form>
      )}

      {/* AI Infinite Kitchen Generator UI */}
      <div className="bg-gradient-to-r from-purple-50/60 to-emerald-50/40 border border-purple-100/60 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1 font-serif">
              AI Infinite Kitchen System
              <span className="text-[8px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Dynamic Feed</span>
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5 max-w-xl">
              Construct customized, nutrient-dense recipes leveraging items currently at home in your <span className="font-bold text-blue-700">pantry</span> mapped to active daily deficiencies.
            </p>

            <form onSubmit={handleGenerateAIRecipe} className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <input 
                type="text" 
                placeholder="Target specific themes (e.g. 'high protein breakfast', 'anti-inflammatory stew')..." 
                value={aiCustomPrompt}
                onChange={(e) => setAiCustomPrompt(e.target.value)}
                disabled={isGenerating}
                className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <button 
                type="submit"
                disabled={isGenerating}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Analyzing Portions...</span>
                  </>
                ) : (
                  <>
                    <ChefHat size={14} />
                    <span>Run AI Recipe Assembly</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Dynamic Recipes Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recipes.map(recipe => {
          const ingredientsWithStockStatus = recipe.ingredients.map(ing => {
            const pantryMatch = pantry.find(p => p.name.toLowerCase() === ing.name.toLowerCase() && p.quantity > 0);
            return { ...ing, isStocked: !!pantryMatch, stockQty: pantryMatch ? pantryMatch.quantity : 0 };
          });

          const stockedCount = ingredientsWithStockStatus.filter(i => i.isStocked).length;
          const totalCount = recipe.ingredients.length;

          return (
            <div key={recipe.id} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative">
              {recipe.id.startsWith('manual_rec_') || recipe.id.startsWith('ai_rec_') ? (
                <button 
                  onClick={() => handleDeleteRecipe(recipe.id)}
                  className="absolute right-4 top-4 p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="Purge recipe"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}

              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    {recipe.id.startsWith('ai_rec_') && <Sparkles size={10} />}
                    {recipe.id.startsWith('ai_rec_') ? 'AI Generation' : 'Local Formula'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold pr-8">
                    <Clock size={13} />
                    <span>{recipe.prepTime} prep • {recipe.cookTime} cook</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 font-serif leading-snug mb-1 pr-6">{recipe.name}</h3>
                <p className="text-xs text-gray-500 italic mb-4 leading-relaxed">"{recipe.tagline}"</p>

                {/* Categories Hit Checklist */}
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 font-semibold">Targets Fulfillments:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(recipe.dozenServings).map(([catId, amount]) => {
                      const cat = dailyDozenCategories.find(c => c.id === catId);
                      if (!cat || amount <= 0) return null;
                      return (
                        <span key={catId} className={`text-[9px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${cat.bg} ${cat.text}`}>
                          <CheckCircle2 size={10} />
                          {cat.label}: +{amount}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Stock status indicator details */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-semibold">Ingredients Required:</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      {stockedCount} / {totalCount} Stocked
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {ingredientsWithStockStatus.map((ing, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-gray-700 flex items-center gap-1.5 font-medium">
                          <span className="text-gray-400">•</span>
                          {ing.name} <span className="text-gray-400 text-[10px]">({ing.amount})</span>
                        </span>
                        
                        {ing.isStocked ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <Check size={10} /> In Stock ({ing.stockQty})
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                            Missing
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 font-semibold font-serif">Directions:</span>
                  <ol className="list-decimal list-inside text-[11px] text-gray-600 space-y-1 leading-relaxed">
                    {recipe.steps.map((step, idx) => (
                      <li key={idx} className="pl-1">
                        <span className="font-serif text-gray-800">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Integrated Kitchen Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleAddMissingRecipeIngredientsToGrocery(recipe)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <ListPlus size={14} className="text-blue-500" />
                  <span>Get Ingredients</span>
                </button>

                <div className="relative group/log flex-1">
                  <button
                    className="w-full bg-purple-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-purple-600 flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Cook & Log Intake</span>
                  </button>
                  
                  {/* Select target meal slot dropdown */}
                  <div className="absolute bottom-full left-0 right-0 mb-1 hidden group-hover/log:block bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden py-1 z-20">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-50">Select Slot:</p>
                    {mealSlots.map(slot => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleCookAndLogRecipe(recipe, slot.id, setPantry)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-purple-50 text-gray-700 font-semibold"
                      >
                        Add to {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}