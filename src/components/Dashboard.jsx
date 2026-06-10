import React, { useState } from 'react';
import { RefreshCw, Settings, X, Info, CheckCircle2, Plus, LogIn, ShoppingCart, Sparkles, Archive } from 'lucide-react';
import { dailyDozenCategories, CategoryIcons, mealSlots, foodDB } from '../data/constants';

export default function Dashboard({
  intake,
  setIntake,
  customTargets,
  setCustomTargets,
  isConfiguringTargets,
  setIsConfiguringTargets,
  currentProgress,
  deficits,
  sortedDeficits,
  pantry,
  setPantry,
  groceryList,
  setGroceryList,
  triggerToast,
  onOpenModal,
  handleClearMeal
}) {
  const [infoPopup, setInfoPopup] = useState(null);

  const updateIndividualTarget = (catId, value) => {
    setCustomTargets(prev => ({
      ...prev,
      [catId]: Math.max(0, Math.min(10, parseFloat(value) || 0))
    }));
  };

  // Dynamic Suggestion algorithm targeting deficiencies and local pantry quantities
  const getSuggestionsForSlot = (slotId) => {
    if (sortedDeficits.length === 0) return [];

    const potentialFoods = foodDB.filter(food => food.tags.includes(slotId));

    const scoredFoods = potentialFoods.map(food => {
      let score = 0;
      let matchesDeficit = false;

      Object.entries(food.servings).forEach(([catId, amount]) => {
        const deficitLeft = deficits[catId] || 0;
        if (deficitLeft > 0) {
          score += amount * (deficitLeft >= 1.5 ? 4 : 2);
          matchesDeficit = true;
        }
      });

      // Reward high priority to pantry ingredients
      const inPantry = pantry.find(p => p.name.toLowerCase() === food.name.toLowerCase() && p.quantity > 0);
      if (inPantry) {
        score += 15;
      }

      return { ...food, score, isStocked: !!inPantry, pantryQty: inPantry ? inPantry.quantity : 0, matchesDeficit };
    });

    return scoredFoods
      .filter(f => f.score > 0 && f.matchesDeficit)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  };

  const handleQuickLogFromPantry = (slotId, pantryItem) => {
    if (pantryItem.quantity <= 0) {
      triggerToast(`"${pantryItem.name}" is out of stock! Buy more from the grocery tab.`, 'warning');
      return;
    }

    setPantry(prev => prev.map(p =>
      p.id === pantryItem.id ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p
    ));

    setIntake(prev => {
      const existsIndex = prev[slotId].findIndex(item => item.name.toLowerCase() === pantryItem.name.toLowerCase());
      if (existsIndex > -1) {
        const updated = [...prev[slotId]];
        updated[existsIndex].servingsMultiplier = (updated[existsIndex].servingsMultiplier || 1.0) + 1.0;
        return { ...prev, [slotId]: updated };
      }
      return {
        ...prev,
        [slotId]: [...prev[slotId], { ...pantryItem, servingsMultiplier: 1.0 }]
      };
    });

    triggerToast(`Logged "${pantryItem.name}" from Pantry stock. Decremented 1 unit from pantry!`, 'success');
  };

  const handleAddToGrocery = (food) => {
    setGroceryList(prev => {
      const exists = prev.find(item => item.name.toLowerCase() === food.name.toLowerCase());
      if (exists) {
        triggerToast(`"${food.name}" is already in your grocery list!`, 'info');
        return prev;
      }
      triggerToast(`Added "${food.name}" to Grocery checkout.`, 'success');
      return [...prev, { ...food, id: food.id || `g_${Date.now()}`, quantity: 1, checked: false }];
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      
      {/* Left Segment: Checklist, Metrics, and Target Configurators */}
      <section className="lg:col-span-7 space-y-8">
        {isConfiguringTargets && (
          <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm animate-in slide-in-from-top duration-300">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Settings size={15} className="text-amber-500" />
                  Customize Target Milestones
                </h3>
                <p className="text-xs text-gray-400">Configure customized Dr. Greger category values.</p>
              </div>
              <button 
                onClick={() => setIsConfiguringTargets(false)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {dailyDozenCategories.map(cat => (
                <div key={cat.id} className="p-2 border border-gray-50 rounded-xl bg-gray-50/50 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-gray-500 truncate">{cat.label}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <input 
                      type="number" 
                      step="0.5"
                      min="0"
                      max="10"
                      value={customTargets[cat.id] || 0}
                      onChange={(e) => updateIndividualTarget(cat.id, e.target.value)}
                      className="w-14 text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-gray-400">{cat.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-serif text-gray-900 font-bold">Daily Progress Tracker</h2>
              <p className="text-xs text-gray-400">Achieve daily balances. Click information cards to learn more.</p>
            </div>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to completely clear today's meal metrics?")) {
                  setIntake({ breakfast: [], morningSnack: [], lunch: [], afternoonSnack: [], dinner: [] });
                  triggerToast("Log reset completed.", "info");
                }
              }}
              className="text-xs text-gray-400 hover:text-rose-500 flex items-center gap-1 font-semibold transition-colors animate-fade-in"
            >
              <RefreshCw size={12} />
              <span>Reset Daily Progress</span>
            </button>
          </div>

          {/* Core Visualized Dozen Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dailyDozenCategories.map(cat => {
              const current = currentProgress[cat.id] || 0;
              const target = customTargets[cat.id] || 0;
              const percent = Math.min(100, Math.round((current / (target || 1)) * 100));
              const Icon = CategoryIcons[cat.id];
              const isComplete = current >= target;

              return (
                <div 
                  key={cat.id}
                  className={`relative bg-white border transition-all duration-300 rounded-3xl p-5 shadow-sm hover:shadow-md ${
                    isComplete ? 'border-emerald-200/60 ring-2 ring-emerald-500/5' : 'border-gray-100/80'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setInfoPopup(infoPopup === cat.id ? null : cat.id)}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                          isComplete ? 'bg-emerald-500 text-white shadow-sm' : `${cat.bg} ${cat.text}`
                        }`}
                        title="View Category Insight"
                      >
                        <Icon />
                      </button>
                      <div>
                        <h4 className="text-xs font-bold text-gray-800 tracking-tight leading-snug">{cat.label}</h4>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                          {current.toFixed(1)} / {target} {cat.unit}
                        </p>
                      </div>
                    </div>

                    {isComplete ? (
                      <span className="text-emerald-500"><CheckCircle2 size={16} className="text-white fill-emerald-500" /></span>
                    ) : (
                      <button 
                        onClick={() => setInfoPopup(infoPopup === cat.id ? null : cat.id)}
                        className="text-gray-300 hover:text-gray-400"
                      >
                        <Info size={14} />
                      </button>
                    )}
                  </div>

                  <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mb-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isComplete ? 'bg-emerald-500' : cat.color
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold">
                    <span>{percent}% Complete</span>
                    {deficits[cat.id] > 0 && (
                      <span className="text-gray-400/90 font-medium">{deficits[cat.id].toFixed(1)} remaining</span>
                    )}
                  </div>

                  {/* Insight Modal Overlay */}
                  {infoPopup === cat.id && (
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-white/95 rounded-3xl p-5 flex flex-col justify-between z-10 border border-gray-100 shadow-xl transition-all duration-300">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <h5 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <span className={cat.text}>{cat.label}</span>
                          </h5>
                          <button onClick={() => setInfoPopup(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed font-serif italic mb-2">
                          "{cat.description}"
                        </p>
                      </div>
                      <button 
                        onClick={() => setInfoPopup(null)}
                        className="w-full text-center text-[10px] text-emerald-600 font-bold pt-1 uppercase tracking-wider"
                      >
                        Dismiss Overlay
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right Segment: Active Meal Slots timeline & Quick-Logs */}
      <section className="lg:col-span-5 space-y-8">
        <div>
          <h2 className="text-xl font-serif text-gray-900 font-bold mb-1">Daily Log Book</h2>
          <p className="text-xs text-gray-400 mb-6">Manage specific segments of your daily nutrition timeline dynamically.</p>
          
          <div className="relative border-l border-gray-100/80 ml-3.5 pl-8 space-y-8 py-2">
            {mealSlots.map((slot) => {
              const loggedItems = intake[slot.id] || [];
              const hasLogged = loggedItems.length > 0;
              
              const relevantPantryInStock = pantry.filter(p => 
                p.quantity > 0 && 
                foodDB.find(db => db.name.toLowerCase() === p.name.toLowerCase())?.tags.includes(slot.id)
              );

              const suggestionList = getSuggestionsForSlot(slot.id);

              return (
                <div key={slot.id} className="relative group">
                  
                  <div className={`absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-4 border-[#FAF9F6] flex items-center justify-center transition-all duration-300 ${
                    hasLogged ? 'bg-emerald-500 shadow-sm' : 'bg-gray-200'
                  }`} />

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 tracking-tight">{slot.label}</span>
                    <div className="flex items-center gap-2">
                      {hasLogged && (
                        <button 
                          onClick={() => handleClearMeal(slot.id)}
                          className="text-[10px] text-gray-400 hover:text-rose-500 font-bold transition-colors"
                        >
                          Clear Slot
                        </button>
                      )}
                      <button 
                        onClick={() => onOpenModal(slot.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-100 rounded-full hover:bg-gray-50 text-gray-500 hover:text-emerald-500 text-[11px] font-bold shadow-sm transition-all"
                      >
                        <Plus size={12} />
                        <span>Log Elements</span>
                      </button>
                    </div>
                  </div>

                  {hasLogged ? (
                    <div className="space-y-2 mb-3">
                      {loggedItems.map((item, idx) => {
                        const multiplier = item.servingsMultiplier || 1.0;
                        return (
                          <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-3 flex justify-between items-center shadow-sm animate-fade-in">
                            <div>
                              <span className="text-xs font-semibold text-gray-800 block leading-tight">{item.name}</span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                {Math.round(item.cals * multiplier)} kcal • {multiplier.toFixed(1)} {multiplier === 1 ? 'serving' : 'servings'}
                              </span>
                              
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(item.servings || {}).map(([catId, amount]) => {
                                  const meta = dailyDozenCategories.find(c => c.id === catId);
                                  if (!meta || amount <= 0) return null;
                                  return (
                                    <span key={catId} className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${meta.bg} ${meta.text}`}>
                                      {meta.label}: {(amount * multiplier).toFixed(1)}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            
                            <button 
                              onClick={() => onOpenModal(slot.id)}
                              className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Edit Servings"
                            >
                              <Settings size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white/50 border border-gray-100/50 border-dashed rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-400 italic font-medium">Nothing logged yet for {slot.label.toLowerCase()}</p>
                    </div>
                  )}

                  {/* Pantry Fast Stocking Quick Actions */}
                  {relevantPantryInStock.length > 0 && (
                    <div className="mt-2 p-2.5 bg-blue-50/20 border border-blue-100/50 rounded-2xl">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <Archive size={11} />
                        Log Straight from Home Pantry:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {relevantPantryInStock.map(pItem => (
                          <button
                            key={pItem.id}
                            onClick={() => handleQuickLogFromPantry(slot.id, pItem)}
                            className="text-[10px] bg-white hover:bg-blue-50/50 border border-blue-100/40 text-gray-700 font-semibold px-2.5 py-1 rounded-xl flex items-center gap-1 transition-all shadow-xs"
                          >
                            <span>{pItem.name}</span>
                            <span className="text-[9px] text-blue-500 bg-blue-50 px-1 rounded-md font-bold">Qty: {pItem.quantity}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Adaptive Recommendations Feed */}
                  {suggestionList.length > 0 && (
                    <div className="mt-2.5 p-3.5 bg-emerald-50/30 border border-emerald-100/60 rounded-2xl animate-in fade-in duration-300">
                      <p className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase mb-2 flex items-center gap-1">
                        <Sparkles size={11} className="text-emerald-500" />
                        Recommended Next Food Items:
                      </p>
                      <div className="space-y-2">
                        {suggestionList.map((sug) => (
                          <div 
                            key={sug.id} 
                            className={`flex items-center justify-between text-xs p-2 bg-white/70 hover:bg-white rounded-xl border transition-all shadow-sm ${
                              sug.isStocked ? 'border-blue-100' : 'border-emerald-100/30'
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-gray-800 leading-tight">{sug.name}</span>
                                {sug.isStocked ? (
                                  <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <CheckCircle2 size={8} /> Pantry Stocked ({sug.pantryQty})
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-400 text-[8px] font-medium px-1.5 py-0.5 rounded-md">
                                    Out of Pantry Stock
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-gray-400 flex flex-wrap gap-1.5 mt-1 font-medium">
                                {Object.entries(sug.servings).map(([catId, amount]) => {
                                  const meta = dailyDozenCategories.find(c => c.id === catId);
                                  if (!meta) return null;
                                  return (
                                    <span key={catId} className={`${meta.text} font-bold`}>
                                      +{amount} {meta.label}
                                    </span>
                                  );
                                })}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {sug.isStocked ? (
                                <button 
                                  onClick={() => {
                                    const matchedPantry = pantry.find(p => p.name.toLowerCase() === sug.name.toLowerCase());
                                    if (matchedPantry) {
                                      handleQuickLogFromPantry(slot.id, matchedPantry);
                                    }
                                  }}
                                  className="p-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                                  title="Utilize Home Stock"
                                >
                                  <LogIn size={12} />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleAddToGrocery(sug)}
                                  className="p-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                                  title="Add to Shopping Checkout"
                                >
                                  <ShoppingCart size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}