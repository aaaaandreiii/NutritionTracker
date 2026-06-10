import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, Archive, ChefHat, Target, ChevronDown, Settings, Sparkles, ShoppingCart 
} from 'lucide-react';

// Import local modularized files
import { dailyDozenCategories, goalPresets, healthyRecipesDB } from './data/constants';
import Dashboard from './components/Dashboard';
import PantryGroceryHub from './components/PantryGroceryHub';
import RecipesHub from './components/RecipesHub';
import MealLoggerModal from './components/MealLoggerModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPreset, setSelectedPreset] = useState('Standard Daily Dozen');
  const [customTargets, setCustomTargets] = useState({ ...goalPresets['Standard Daily Dozen'] });
  const [isConfiguringTargets, setIsConfiguringTargets] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  // Core synchronized global states
  const [recipes, setRecipes] = useState(() => {
    const saved = localStorage.getItem('daily_dozen_recipes');
    return saved ? JSON.parse(saved) : healthyRecipesDB;
  });

  const [pantry, setPantry] = useState([
    { id: 'f1', name: 'Rolled Oats', cals: 150, servings: { wholeGrains: 2 }, quantity: 4 },
    { id: 'f2', name: 'Hummus & Baby Carrots', cals: 160, servings: { beans: 1, otherVeggies: 1 }, quantity: 2 },
    { id: 'f4', name: 'Spinach', cals: 15, servings: { greens: 1 }, quantity: 3 },
    { id: 'f13', name: 'Tall Glass of Pure Water', cals: 0, servings: { beverages: 1 }, quantity: 15 },
    { id: 'f19', name: 'Ground Flaxseeds', cals: 40, servings: { flaxseeds: 1 }, quantity: 8 }
  ]);

  const [groceryList, setGroceryList] = useState([
    { id: 'f3', name: 'Blueberries', cals: 80, servings: { berries: 1 }, quantity: 2, checked: false },
    { id: 'f6', name: 'Brown Lentils', cals: 230, servings: { beans: 2 }, quantity: 1, checked: false }
  ]);

  const [intake, setIntake] = useState({
    breakfast: [],
    morningSnack: [],
    lunch: [],
    afternoonSnack: [],
    dinner: []
  });

  // Local state persistence configuration
  useEffect(() => {
    localStorage.setItem('daily_dozen_recipes', JSON.stringify(recipes));
  }, [recipes]);

  const triggerToast = (msg, type = 'info') => {
    setAlertMessage({ text: msg, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4500);
  };

  // Memoized dynamic nutrition calculation parameters
  const currentProgress = useMemo(() => {
    let totals = { calories: 0 };
    dailyDozenCategories.forEach(cat => {
      totals[cat.id] = 0;
    });

    Object.values(intake).forEach(mealItems => {
      mealItems.forEach(item => {
        const mult = item.servingsMultiplier || 1;
        totals.calories += Math.round(item.cals * mult);
        
        Object.keys(item.servings || {}).forEach(catId => {
          if (totals[catId] !== undefined) {
            totals[catId] += (item.servings[catId] * mult);
          }
        });
      });
    });

    return totals;
  }, [intake]);

  const deficits = useMemo(() => {
    let defs = {};
    dailyDozenCategories.forEach(cat => {
      defs[cat.id] = Math.max(0, (customTargets[cat.id] || 0) - currentProgress[cat.id]);
    });
    return defs;
  }, [currentProgress, customTargets]);

  const sortedDeficits = useMemo(() => {
    return Object.entries(deficits)
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [deficits]);

  // Grocery deficiency dynamic mapping engine
  const grocerySuggestions = useMemo(() => {
    if (sortedDeficits.length === 0) return [];
    
    const inPantryNames = pantry.map(p => p.name.toLowerCase());
    const inGroceryNames = groceryList.map(g => g.name.toLowerCase());

    return pantry
      .filter(food => !inPantryNames.includes(food.name.toLowerCase()))
      .filter(food => !inGroceryNames.includes(food.name.toLowerCase()))
      .map(food => {
        let matchingPower = 0;
        let matchedCategories = [];

        Object.entries(food.servings).forEach(([catId, amt]) => {
          const def = deficits[catId] || 0;
          if (def > 0) {
            matchingPower += amt * def;
            matchedCategories.push({ catId, amt });
          }
        });

        return { ...food, matchingPower, matchedCategories };
      })
      .filter(f => f.matchingPower > 0)
      .sort((a, b) => b.matchingPower - a.matchingPower)
      .slice(0, 5);
  }, [sortedDeficits, pantry, groceryList, deficits]);

  // Global checkout list sync handlers
  const handleAddToPantry = (food, qty = 1) => {
    setPantry(prev => {
      const exists = prev.find(item => item.name.toLowerCase() === food.name.toLowerCase());
      if (exists) {
        return prev.map(item => 
          item.name.toLowerCase() === food.name.toLowerCase() 
            ? { ...item, quantity: item.quantity + qty } 
            : item
        );
      }
      return [...prev, { ...food, id: food.id || `p_${Date.now()}`, quantity: qty }];
    });
    triggerToast(`Added ${qty} unit(s) of "${food.name}" to Pantry!`, 'success');
  };

  const handleAddToGrocery = (food) => {
    setGroceryList(prev => {
      const exists = prev.find(item => item.name.toLowerCase() === food.name.toLowerCase());
      if (exists) {
        triggerToast(`"${food.name}" is already in your grocery shopping list!`, 'info');
        return prev;
      }
      triggerToast(`Added "${food.name}" to Grocery list!`, 'success');
      return [...prev, { ...food, id: food.id || `g_${Date.now()}`, quantity: 1, checked: false }];
    });
  };

  const handleRemovePantryItem = (pantryId) => {
    setPantry(prev => prev.filter(p => p.id !== pantryId));
  };

  const handleUpdatePantryQty = (pantryId, val) => {
    setPantry(prev => prev.map(p => p.id === pantryId ? { ...p, quantity: Math.max(0, parseInt(val) || 0) } : p));
  };

  const handleGroceryCheckToggle = (groceryId) => {
    setGroceryList(prev => prev.map(item => 
      item.id === groceryId ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleStockCheckedGroceries = () => {
    const checkedItems = groceryList.filter(item => item.checked);
    if (checkedItems.length === 0) {
      triggerToast("Please check/select the grocery items you want to stock into your pantry first.", "warning");
      return;
    }

    checkedItems.forEach(item => {
      handleAddToPantry(item, item.quantity || 1);
    });

    setGroceryList(prev => prev.filter(item => !item.checked));
    triggerToast(`Moved ${checkedItems.length} purchased item(s) to Pantry stock!`, 'success');
  };

  const handleRemoveGroceryItem = (groceryId) => {
    setGroceryList(prev => prev.filter(g => g.id !== groceryId));
  };

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    setCustomTargets({ ...goalPresets[presetName] });
    setIsPresetDropdownOpen(false);
  };

  const handleClearMeal = (slotId) => {
    setIntake(prev => ({ ...prev, [slotId]: [] }));
    triggerToast(`Cleared all items from ${slotId}.`, 'info');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-gray-800 font-sans selection:bg-emerald-100 antialiased">
      
      {/* Dynamic Toast System */}
      {alertMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-semibold ${
            alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            alertMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <Sparkles size={16} className={alertMessage.type === 'success' ? 'text-emerald-500' : 'text-amber-500'} />
            <span>{alertMessage.text}</span>
          </div>
        </div>
      )}

      {/* Primary Sticky Header */}
      <nav className="border-b border-gray-100 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-serif font-bold text-xl shadow-md shadow-emerald-500/20">
              12
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-gray-900 block font-serif">Greger's Daily Dozen Hub</span>
              <span className="text-xs text-gray-400 font-medium">Diet, Pantry, Groceries & Healthy Cooking</span>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Activity size={14} className="text-emerald-500" />
              <span>Daily Progress</span>
            </button>
            <button
              onClick={() => setActiveTab('pantry')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'pantry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Archive size={14} className="text-blue-500" />
              <span>Pantry & Groceries</span>
              {pantry.length > 0 && (
                <span className="bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-normal">
                  {pantry.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('recipes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'recipes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ChefHat size={14} className="text-purple-500" />
              <span>Healthy Recipes</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                <Target size={14} className="text-emerald-500" />
                <span>{selectedPreset}</span>
                <ChevronDown size={12} className="text-gray-400" />
              </button>
              
              {isPresetDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden py-2">
                  <div className="px-4 py-2 border-b border-gray-50 mb-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Targets Preset Template</p>
                  </div>
                  {Object.keys(goalPresets).map(preset => (
                    <button
                      key={preset}
                      onClick={() => handlePresetChange(preset)}
                      className={`w-full text-left px-4 py-3 text-xs transition-colors hover:bg-gray-50 ${
                        selectedPreset === preset ? 'bg-emerald-50/60 text-emerald-800 font-bold' : 'text-gray-600'
                      }`}
                    >
                      <span className="block font-medium">{preset}</span>
                      <span className="block text-[10px] text-gray-400 font-normal mt-0.5 line-clamp-1">{goalPresets[preset].label}</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => { setIsConfiguringTargets(!isConfiguringTargets); setIsPresetDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs border-t border-gray-50 text-emerald-600 font-semibold hover:bg-emerald-50/30 flex items-center justify-between"
                  >
                    <span>Custom / Edit Targets</span>
                    <Settings size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {sortedDeficits.length > 0 && activeTab === 'dashboard' && (
          <div className="mb-8 p-4 bg-amber-50/50 border border-amber-100 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-2xl text-amber-700">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Daily Deficit Warning</h4>
                <p className="text-xs text-gray-500 mt-1">
                  You are lagging on <span className="font-bold text-amber-800">{sortedDeficits.slice(0, 2).map(([id]) => dailyDozenCategories.find(c => c.id === id)?.label).join(' & ')}</span>.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('pantry')}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1.5 shrink-0 bg-white border border-amber-200 px-3 py-1.5 rounded-full shadow-xs"
            >
              <span>Verify Grocery Stock</span>
              <ShoppingCart size={12} />
            </button>
          </div>
        )}

        {/* Tab Routers */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            intake={intake}
            setIntake={setIntake}
            customTargets={customTargets}
            setCustomTargets={setCustomTargets}
            isConfiguringTargets={isConfiguringTargets}
            setIsConfiguringTargets={setIsConfiguringTargets}
            currentProgress={currentProgress}
            deficits={deficits}
            sortedDeficits={sortedDeficits}
            pantry={pantry}
            setPantry={setPantry}
            groceryList={groceryList}
            setGroceryList={setGroceryList}
            triggerToast={triggerToast}
            onOpenModal={(mealId) => { setEditingMeal(mealId); setIsModalOpen(true); }}
            handleClearMeal={handleClearMeal}
          />
        )}

        {activeTab === 'pantry' && (
          <PantryGroceryHub 
            pantry={pantry}
            setPantry={setPantry}
            groceryList={groceryList}
            setGroceryList={setGroceryList}
            triggerToast={triggerToast}
            grocerySuggestions={grocerySuggestions}
            handleAddToPantry={handleAddToPantry}
            handleAddToGrocery={handleAddToGrocery}
            handleRemovePantryItem={handleRemovePantryItem}
            handleUpdatePantryQty={handleUpdatePantryQty}
            handleGroceryCheckToggle={handleGroceryCheckToggle}
            handleStockCheckedGroceries={handleStockCheckedGroceries}
            handleRemoveGroceryItem={handleRemoveGroceryItem}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesHub 
            recipes={recipes}
            setRecipes={setRecipes}
            pantry={pantry}
            setPantry={setPantry}
            groceryList={groceryList}
            setGroceryList={setGroceryList}
            deficits={deficits}
            selectedPreset={selectedPreset}
            triggerToast={triggerToast}
            handleAddToGrocery={handleAddToGrocery}
          />
        )}
      </main>

      <footer className="border-t border-gray-100 bg-white py-12 mt-20 text-center text-xs text-gray-400 font-medium">
        <p className="max-w-md mx-auto px-6 leading-relaxed">
          Inspired by Dr. Michael Greger's Daily Dozen. This dynamic localized project tracks home kitchen pantry levels in alignment with dietary deficiencies.
        </p>
      </footer>

      {/* Global Portions Intake Modal */}
      <MealLoggerModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingMeal(null); }}
        editingMeal={editingMeal}
        initialDraftItems={editingMeal ? (intake[editingMeal] || []) : []}
        onSave={(updatedDrafts) => {
          setIntake(prev => ({ ...prev, [editingMeal]: updatedDrafts }));
          setIsModalOpen(false);
          setEditingMeal(null);
          triggerToast("Intake logging updated!", "success");
        }}
      />

    </div>
  );
}