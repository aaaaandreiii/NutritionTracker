import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, Target, ShoppingBag, ChefHat, ChevronDown, CheckCircle2, AlertTriangle, Sparkles 
} from 'lucide-react';

import { DAILY_DOZEN_CATEGORIES, goalPresets, mealSlots, healthyRecipesDB } from './data/constants';
import Dashboard from './components/Dashboard';
import PantryGroceryHub from './components/PantryGroceryHub';
import RecipesHub from './components/RecipesHub';
import MealLoggerModal from './components/MealLoggerModal';
import SugarPAI from './components/SugarPAIApp';

const APP_TABS = ['sugar-pai', 'dashboard', 'pantry', 'recipes'];

function tabFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'sugar-pai' || hash.startsWith('sugar-pai/')) return 'sugar-pai';
  return APP_TABS.includes(hash) ? hash : 'sugar-pai';
}

const sugarPaiMealSlotMap = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
  Snack: 'afternoonSnack',
  Other: 'afternoonSnack'
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return tabFromHash();
  });
  
  const [selectedPreset, setSelectedPreset] = useState('Standard Daily Dozen');
  const [customTargets, setCustomTargets] = useState({ ...goalPresets['Standard Daily Dozen'] });
  const [isConfiguringTargets, setIsConfiguringTargets] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  const [recipes, setRecipes] = useState(() => {
    const saved = localStorage.getItem('daily_dozen_recipes');
    return saved ? JSON.parse(saved) : healthyRecipesDB;
  });

  const [pantry, setPantry] = useState([
    { id: 'p_1', name: 'Oatmeal', cals: 150, servings: { wholeGrains: 2 }, quantity: 4, category: 'wholeGrains' },
    { id: 'p_2', name: 'Blueberries', cals: 80, servings: { berries: 1 }, quantity: 2, category: 'berries' },
    { id: 'p_3', name: 'Lentils', cals: 230, servings: { beans: 2 }, quantity: 3, category: 'beans' },
    { id: 'p_4', name: 'Spinach', cals: 15, servings: { greens: 1 }, quantity: 3, category: 'greens' }
  ]);

  const [groceryList, setGroceryList] = useState([
    { id: 'g_1', name: 'Walnuts', cals: 180, checked: false, category: 'nutsSeeds', quantity: 1 }
  ]);

  const [intake, setIntake] = useState({
    breakfast: [],
    morningSnack: [],
    lunch: [],
    afternoonSnack: [],
    dinner: []
  });

  // Listen to browser URL hash changes for deep-linked tabs and navigation support
  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(tabFromHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Automatically default the hash on boot if nothing is assigned
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#/sugar-pai/scan';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tabName) => {
    window.location.hash = tabName === 'sugar-pai' ? '#/sugar-pai/scan' : `#/${tabName}`;
    setActiveTab(tabName);
  };

  // State-driven Camera Monitor: Automatically turn off camera whenever not on 'sugar-pai' tab
  useEffect(() => {
    if (activeTab !== 'sugar-pai') {
      if (typeof window !== 'undefined' && window.sugarPaiStopCamera) {
        try {
          window.sugarPaiStopCamera();
        } catch (e) {}
      }
      try {
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach(v => {
          if (v.srcObject && v.srcObject.getTracks) {
            v.srcObject.getTracks().forEach(t => {
              t.stop();
              t.enabled = false;
            });
            v.srcObject = null;
          }
        });
      } catch (e) {}
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('daily_dozen_recipes', JSON.stringify(recipes));
  }, [recipes]);

  const triggerToast = (msg, type = 'info') => {
    setAlertMessage({ text: msg, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4500);
  };

  const currentProgress = useMemo(() => {
    let totals = { calories: 0 };
    DAILY_DOZEN_CATEGORIES.forEach(cat => {
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
    DAILY_DOZEN_CATEGORIES.forEach(cat => {
      defs[cat.id] = Math.max(0, (customTargets[cat.id] || 0) - currentProgress[cat.id]);
    });
    return defs;
  }, [currentProgress, customTargets]);

  const sortedDeficits = useMemo(() => {
    return Object.entries(deficits)
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [deficits]);

  const dailyDozenDeficits = useMemo(() => {
    return Object.entries(deficits)
      .filter(([_, amount]) => amount > 0)
      .map(([key, lacking]) => ({ key, lacking }))
      .sort((a, b) => b.lacking - a.lacking);
  }, [deficits]);

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    setCustomTargets({ ...goalPresets[presetName] });
    setIsPresetDropdownOpen(false);
  };

  const handleClearMeal = (slotId) => {
    setIntake(prev => ({ ...prev, [slotId]: [] }));
    triggerToast(`Cleared all items from ${slotId}.`, 'info');
  };

  const handleCookAndLogRecipe = (recipe) => {
    let deducted = [];
    setPantry(prev => {
      return prev.map(pItem => {
        const match = recipe.ingredients.find(ing =>
          ing.name.toLowerCase().includes(pItem.name.toLowerCase()) ||
          pItem.name.toLowerCase().includes(ing.name.toLowerCase())
        );
        if (match) {
          const nextQty = Math.max(0, pItem.quantity - 1);
          if (pItem.quantity > 0) {
            deducted.push(`${pItem.name} (-1)`);
          }
          return { ...pItem, quantity: nextQty };
        }
        return pItem;
      });
    });

    const newMealItem = {
      id: `cooked_${recipe.id}_${Date.now()}`,
      name: recipe.name,
      cals: recipe.cals,
      servings: recipe.dozenServings,
      servingsMultiplier: 1.0,
      tags: ['lunch']
    };

    setIntake(prev => ({
      ...prev,
      lunch: [...prev.lunch, newMealItem]
    }));

    if (deducted.length > 0) {
      triggerToast(`Cooked and logged to Lunch! Pantry deducted: ${deducted.join(', ')}`, 'success');
    } else {
      triggerToast(`Cooked and logged "${recipe.name}" to Lunch!`, 'success');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-gray-800 font-sans selection:bg-emerald-500/10 pb-16">
      {alertMessage && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 transition-all duration-350 ${
          alertMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : alertMessage.type === 'warning'
            ? 'bg-rose-50 border-rose-100 text-rose-800'
            : 'bg-indigo-50 border-indigo-100 text-indigo-850'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} />}
          <span className="text-xs font-bold">{alertMessage.text}</span>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-gray-100/60 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 font-serif flex items-center gap-1.5">
              Sugar pAI <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-sans font-bold">V2</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">Packaged-food evidence and Smart Context research</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-gray-100/65 p-1 rounded-2xl">
          <a 
            href="#/sugar-pai/scan"
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('sugar-pai');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sugar-pai' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Sugar pAI</span>
          </a>
          <a 
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('dashboard');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dashboard' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Target size={14} />
            <span>Dashboard</span>
          </a>
          <a 
            href="#/pantry"
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('pantry');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pantry' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Pantry & Groceries</span>
          </a>
          <a 
            href="#/recipes"
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('recipes');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'recipes' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ChefHat size={14} />
            <span>Recipes</span>
          </a>
        </nav>

        <div className="relative">
          <button 
            onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 hover:bg-gray-50 rounded-2xl text-xs font-bold text-gray-700 shadow-xs transition-all"
          >
            <Target size={14} className="text-emerald-500" />
            <span>{selectedPreset}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          
          {isPresetDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl p-3 z-50">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 pb-2 border-b border-gray-50">
                Choose Target Rule
              </div>
              <div className="space-y-1 mt-2">
                {Object.keys(goalPresets).map(preset => (
                  <button
                    key={preset}
                    onClick={() => handlePresetChange(preset)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all ${
                      selectedPreset === preset ? 'bg-emerald-50/50 text-emerald-800' : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="text-xs font-bold">{preset}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-medium leading-relaxed">
                      {goalPresets[preset].label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-50 mt-2 pt-2 flex justify-between">
                <button 
                  onClick={() => {
                    setIsPresetDropdownOpen(false);
                    setIsConfiguringTargets(!isConfiguringTargets);
                  }}
                  className="w-full text-center text-[10px] text-emerald-600 font-bold hover:underline"
                >
                  Custom Manual Overrides
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <div className={activeTab === 'sugar-pai' ? 'block' : 'hidden'}>
          <SugarPAI 
            triggerToast={triggerToast}
            onLogMeal={(entry) => {
              const slot = sugarPaiMealSlotMap[entry.meal] || 'afternoonSnack';
              const newMealItem = {
                id: `pai_${entry.id}`,
                name: entry.productName,
                cals: 0,
                servings: {},
                servingsMultiplier: 1.0,
                tags: ['sugar-pai', entry.meal.toLowerCase()],
                sugarPai: {
                  logId: entry.id,
                  analysisId: entry.analysisId,
                  meal: entry.meal,
                  consumedServings: entry.consumedServings,
                  loggedAt: entry.loggedAt,
                  totals: entry.totals
                }
              };
              setIntake(prev => ({
                ...prev,
                [slot]: [...prev[slot], newMealItem]
              }));
              triggerToast(`Added "${entry.productName}" Sugar pAI record to ${mealSlots.find(m => m.id === slot)?.label}.`, 'success');
            }}
          />
        </div>

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
            onOpenModal={(mealId) => {
              setEditingMeal(mealId);
              setIsModalOpen(true);
            }}
            handleClearMeal={handleClearMeal}
          />
        )}

        {activeTab === 'pantry' && (
          <PantryGroceryHub 
            pantry={pantry}
            setPantry={setPantry}
            groceryList={groceryList}
            setGroceryList={setGroceryList}
            dailyDozenDeficits={dailyDozenDeficits}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesHub 
            recipes={recipes}
            setRecipes={setRecipes}
            pantry={pantry}
            setGroceryList={setGroceryList}
            groceryList={groceryList}
            handleCookAndLogRecipe={handleCookAndLogRecipe}
            dailyDozenDeficits={dailyDozenDeficits}
          />
        )}
      </main>

      <MealLoggerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingMeal={editingMeal}
        initialDraftItems={intake[editingMeal] || []}
        onSave={(draftItems) => {
          setIntake(prev => ({ ...prev, [editingMeal]: draftItems }));
          setIsModalOpen(false);
          triggerToast(`Logged items for ${mealSlots.find(m => m.id === editingMeal)?.label}!`, 'success');
        }}
      />
    </div>
  );
}
