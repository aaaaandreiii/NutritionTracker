import React, { useState } from 'react';
import { X, Search, Check, Trash2 } from 'lucide-react';
import { dailyDozenCategories, foodDB, mealSlots } from '../data/constants';

export default function MealLoggerModal({
  isOpen,
  onClose,
  editingMeal,
  initialDraftItems = [],
  onSave
}) {
  const [draftItems, setDraftItems] = useState([...initialDraftItems]);
  const [customItemMode, setCustomItemMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Custom ingredient builder states
  const [customName, setCustomName] = useState('');
  const [customCals, setCustomCals] = useState('');
  const [customCategoryServings, setCustomCategoryServings] = useState(
    dailyDozenCategories.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {})
  );

  if (!isOpen) return null;

  const toggleDraftItem = (food) => {
    const existsIndex = draftItems.findIndex(item => item.id === food.id);
    if (existsIndex > -1) {
      setDraftItems(prev => prev.filter((_, idx) => idx !== existsIndex));
    } else {
      setDraftItems(prev => [...prev, { ...food, servingsMultiplier: 1.0 }]);
    }
  };

  const updateServingMultiplier = (index, value) => {
    setDraftItems(prev => {
      const updated = [...prev];
      updated[index].servingsMultiplier = Math.max(0.1, Math.min(10, parseFloat(value) || 0.1));
      return updated;
    });
  };

  const deleteDraftIndex = (index) => {
    setDraftItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const resetCustomForm = () => {
    setCustomName('');
    setCustomCals('');
    setCustomCategoryServings(
      dailyDozenCategories.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {})
    );
  };

  const handleAddCustomItemSubmit = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const nonZeroServings = {};
    Object.entries(customCategoryServings).forEach(([catId, val]) => {
      if (val > 0) nonZeroServings[catId] = val;
    });

    const newCustomFood = {
      id: `custom_${Date.now()}`,
      name: customName,
      cals: parseInt(customCals) || 0,
      servings: nonZeroServings,
      servingsMultiplier: 1.0,
      tags: [editingMeal]
    };

    setDraftItems(prev => [...prev, newCustomFood]);
    setCustomItemMode(false);
    resetCustomForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/40 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Modal Head */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-serif capitalize">
              Log Foods into {mealSlots.find(m => m.id === editingMeal)?.label}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Edit portion sizes or define customized whole foods.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - Split Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-hidden flex-1">
          
          {/* Left Segment: Preset Food Search or Custom Addition Creator */}
          <div className="md:col-span-7 p-6 flex flex-col overflow-y-auto max-h-[45vh] md:max-h-[60vh]">
            
            {/* Database Switcher Navigation */}
            <div className="flex border-b border-gray-100 mb-4 text-xs font-bold text-gray-400">
              <button 
                type="button"
                onClick={() => setCustomItemMode(false)}
                className={`pb-2 pr-4 border-b-2 transition-all ${!customItemMode ? 'border-emerald-500 text-emerald-800' : 'border-transparent'}`}
              >
                Preset Foods Directory
              </button>
              <button 
                type="button"
                onClick={() => setCustomItemMode(true)}
                className={`pb-2 px-2 border-b-2 transition-all ${customItemMode ? 'border-emerald-500 text-emerald-800' : 'border-transparent'}`}
              >
                Quick Custom Entry
              </button>
            </div>

            {!customItemMode ? (
              <>
                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search ingredients & dishes..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-emerald-500/20 focus:bg-white transition-all outline-none"
                  />
                </div>

                <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                  {foodDB
                    .filter(food => food.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(food => {
                      const isSelected = draftItems.some(i => i.id === food.id);
                      return (
                        <div 
                          key={food.id}
                          onClick={() => toggleDraftItem(food)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
                            isSelected 
                              ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' 
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-semibold text-gray-800 block">{food.name}</span>
                            <span className="text-[10px] text-gray-400">
                              {food.cals} kcal • {Object.entries(food.servings).map(([cat, amt]) => {
                                const meta = dailyDozenCategories.find(c => c.id === cat);
                                return `${amt} ${meta?.label || cat}`;
                              }).join(', ')}
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </div>
                        </div>
                      );
                  })}
                </div>
              </>
            ) : (
              <form onSubmit={handleAddCustomItemSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dish/Activity Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Mixed Beans Salad Bowl" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Calories</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 350" 
                      value={customCals}
                      onChange={(e) => setCustomCals(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assign Nutrient Servings</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[18vh] overflow-y-auto pr-1">
                    {dailyDozenCategories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50/50 border border-gray-100 rounded-xl">
                        <span className="text-[10px] font-medium text-gray-600 truncate mr-2">{cat.label}</span>
                        <input 
                          type="number" 
                          step="0.5"
                          min="0"
                          max="10"
                          value={customCategoryServings[cat.id]}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCustomCategoryServings(prev => ({ ...prev, [cat.id]: val }));
                          }}
                          className="w-12 text-[11px] font-bold text-right px-1.5 py-0.5 border border-gray-200 bg-white rounded-md"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!customName.trim()}
                  className="w-full py-2 px-4 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-500/10"
                >
                  Log Custom Food Block
                </button>
              </form>
            )}
          </div>

          {/* Right Segment: Active Shopping Cart / Selected Draft Elements */}
          <div className="md:col-span-5 p-6 bg-gray-50/30 flex flex-col overflow-y-auto max-h-[40vh] md:max-h-[60vh]">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Selected Item Checklist</h4>
            
            {draftItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <p className="text-xs text-gray-400 italic">Select food structures from the left panel to configure portion thresholds.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto">
                {draftItems.map((item, index) => (
                  <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm relative group/draft">
                    <div className="flex justify-between items-start pr-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-800 block line-clamp-1 leading-snug">{item.name}</span>
                        <span className="text-[10px] text-gray-400">{Math.round(item.cals * (item.servingsMultiplier || 1.0))} kcal total</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => deleteDraftIndex(index)}
                        className="absolute right-2 top-2 text-gray-300 hover:text-rose-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Portions Scale Multiplier */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-gray-50 pt-2 text-[10px] text-gray-400 font-bold">
                      <span>PORTION WEIGHT:</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          step="0.5"
                          min="0.1"
                          max="10"
                          value={item.servingsMultiplier || 1.0}
                          onChange={(e) => updateServingMultiplier(index, e.target.value)}
                          className="w-12 text-center text-xs font-bold text-gray-800 border border-gray-200 rounded px-1"
                        />
                        <span>x portions</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-gray-700 block">
              {draftItems.length} {draftItems.length === 1 ? 'item' : 'items'} Active
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              Accumulates {draftItems.reduce((acc, curr) => acc + Math.round(curr.cals * (curr.servingsMultiplier || 1.0)), 0)} kcal
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 text-xs font-semibold rounded-full transition-colors"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => onSave(draftItems)}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-full shadow-sm shadow-emerald-500/10 transition-colors"
            >
              Log Foods
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}