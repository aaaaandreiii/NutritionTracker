import React, { useState } from 'react';
import { Archive, Trash2, ShoppingCart, Plus, CheckSquare, Square, Check, Sparkles } from 'lucide-react';
import { dailyDozenCategories, foodDB } from '../data/constants';

export default function PantryGroceryHub({
  pantry,
  setPantry,
  groceryList,
  setGroceryList,
  triggerToast,
  grocerySuggestions,
  handleAddToPantry,
  handleAddToGrocery,
  handleRemovePantryItem,
  handleUpdatePantryQty,
  handleGroceryCheckToggle,
  handleStockCheckedGroceries,
  handleRemoveGroceryItem
}) {
  const [manualGroceryItem, setManualGroceryItem] = useState('');
  
  // Custom manual pantry item creator state
  const [customName, setCustomName] = useState('');
  const [customCals, setCustomCals] = useState('');
  const [customCategoryServings, setCustomCategoryServings] = useState(
    dailyDozenCategories.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {})
  );

  const handleAddManualGrocery = (e) => {
    e.preventDefault();
    if (!manualGroceryItem.trim()) return;

    const matchedFood = foodDB.find(f => f.name.toLowerCase() === manualGroceryItem.trim().toLowerCase());
    
    const newGrocery = {
      id: `g_manual_${Date.now()}`,
      name: manualGroceryItem.trim(),
      cals: matchedFood ? matchedFood.cals : 100,
      servings: matchedFood ? matchedFood.servings : {},
      quantity: 1,
      checked: false
    };

    setGroceryList(prev => [...prev, newGrocery]);
    setManualGroceryItem('');
    triggerToast(`Added "${newGrocery.name}" to the shopping list.`, 'success');
  };

  const handleAddCustomPantrySubmit = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const nonZeroServings = {};
    Object.entries(customCategoryServings).forEach(([catId, val]) => {
      if (val > 0) nonZeroServings[catId] = val;
    });

    const newCustomFood = {
      id: `p_custom_${Date.now()}`,
      name: customName,
      cals: parseInt(customCals) || 0,
      servings: nonZeroServings,
      quantity: 3
    };

    setPantry(prev => [...prev, newCustomFood]);
    
    // Reset form fields
    setCustomName('');
    setCustomCals('');
    setCustomCategoryServings(dailyDozenCategories.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {}));
    
    triggerToast(`Added "${newCustomFood.name}" straight to your Pantry!`, 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-300">
      
      {/* Left Segment: Pantry Management Column */}
      <div className="lg:col-span-7 space-y-8">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-serif text-gray-900 font-bold flex items-center gap-2">
                <Archive size={18} className="text-blue-500" />
                Pantry Inventory
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Maintain home-stocked ingredients. Keeps meal slot recommendations highly accurate.
              </p>
            </div>
          </div>

          {pantry.length === 0 ? (
            <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <Archive size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400 italic">No items logged at home. Use the checkers below to stock up.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {pantry.map(item => (
                <div key={item.id} className="p-3 border border-gray-100 rounded-2xl bg-white flex flex-col justify-between shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block truncate">{item.name}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{item.cals} kcal per item</span>
                    </div>
                    <button 
                      onClick={() => handleRemovePantryItem(item.id)}
                      className="p-1 text-gray-300 hover:text-rose-500 rounded"
                      title="De-stock Pantry Item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 my-2">
                    {Object.entries(item.servings || {}).map(([catId, amt]) => {
                      const catMeta = dailyDozenCategories.find(c => c.id === catId);
                      if (!catMeta) return null;
                      return (
                        <span key={catId} className={`text-[8px] font-bold px-1 py-0.5 rounded ${catMeta.bg} ${catMeta.text}`}>
                          {catMeta.label}: {amt}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-50">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Inventory Qty</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleUpdatePantryQty(item.id, Math.max(0, item.quantity - 1))}
                        className="w-5 h-5 bg-gray-100 rounded text-xs hover:bg-gray-200 font-bold"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-gray-800 px-2">{item.quantity}</span>
                      <button 
                        onClick={() => handleUpdatePantryQty(item.id, item.quantity + 1)}
                        className="w-5 h-5 bg-gray-100 rounded text-xs hover:bg-gray-200 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preset Whole Foods Catalog additions */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Preloaded Whole Foods (Quick Home Stocking)</h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
              {foodDB.map(food => {
                const inPantry = pantry.some(p => p.name.toLowerCase() === food.name.toLowerCase());
                return (
                  <button
                    key={food.id}
                    onClick={() => handleAddToPantry(food, 1)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                      inPantry 
                        ? 'bg-blue-50 border-blue-200 text-blue-800' 
                        : 'bg-white border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <Plus size={10} />
                    <span>{food.name}</span>
                    {inPantry && <span className="text-[8px] bg-blue-100 px-1 rounded font-bold">Have Stock</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form to insert completely custom objects */}
          <div className="border-t border-gray-100 pt-6 mt-6">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">Add Custom Item to Pantry Stock</h3>
            <form onSubmit={handleAddCustomPantrySubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Item Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Organic Black Chia Seeds" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Estimated Calories</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={customCals}
                    onChange={(e) => setCustomCals(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!customName.trim()}
                  className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-blue-500/10"
                >
                  Confirm Stock Entry
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Assign Dozen Portions</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 border border-gray-50 p-2 rounded-xl bg-gray-50/20">
                  {dailyDozenCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-1 bg-white border border-gray-100 rounded-lg">
                      <span className="text-[9px] text-gray-500 truncate mr-1 font-semibold">{cat.label}</span>
                      <input 
                        type="number" 
                        step="0.5"
                        min="0"
                        max="5"
                        value={customCategoryServings[cat.id]}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCustomCategoryServings(prev => ({ ...prev, [cat.id]: val }));
                        }}
                        className="w-8 text-[10px] font-bold text-right border-none p-0 focus:ring-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right Segment: Smart Shopping cart checklist list */}
      <div className="lg:col-span-5 space-y-8">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <ShoppingCart size={15} className="text-indigo-500" />
              Active Grocery List
            </h2>
            <p className="text-xs text-gray-400 mt-1">Cross-reference items to instantly stock your home kitchen pantry.</p>
          </div>

          <form onSubmit={handleAddManualGrocery} className="flex gap-2 my-4">
            <input 
              type="text" 
              placeholder="Add grocery item manually..." 
              value={manualGroceryItem}
              onChange={(e) => setManualGroceryItem(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
            <button 
              type="submit"
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </form>

          {groceryList.length === 0 ? (
            <div className="text-center py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-100">
              <ShoppingCart size={24} className="mx-auto text-gray-300 mb-1" />
              <p className="text-[11px] text-gray-400 italic">No grocery items. Utilize recommendations or add items above!</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
              {groceryList.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2.5 bg-gray-50/30 border border-gray-100 rounded-xl hover:bg-gray-50/70 transition-all">
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={() => handleGroceryCheckToggle(item.id)}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {item.checked ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-300" />}
                    </button>
                    <div>
                      <span className={`text-xs font-semibold text-gray-800 ${item.checked ? 'line-through text-gray-400' : ''}`}>
                        {item.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleRemoveGroceryItem(item.id)}
                      className="text-gray-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groceryList.length > 0 && (
            <button 
              onClick={handleStockCheckedGroceries}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-indigo-500/10"
            >
              <Check size={14} />
              <span>Checkout Checked Ingredients to Pantry</span>
            </button>
          )}
        </div>

        {/* Dynamic grocery advisor segment */}
        <div className="bg-[#EEF2F6] border border-blue-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Sparkles size={14} className="text-blue-600" />
            Deficiency Grocery Assistant
          </h3>
          <p className="text-xs text-blue-700/80 mb-4">
            Highly recommended ingredients missing from your pantry that satisfy active daily dozen deficits:
          </p>

          {grocerySuggestions.length === 0 ? (
            <div className="text-center py-6 bg-white/50 rounded-2xl">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
              <p className="text-[11px] text-gray-500 italic">No items missing. Your home pantry satisfies all deficiencies!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {grocerySuggestions.map(sug => (
                <div key={sug.id} className="bg-white p-3 rounded-2xl border border-blue-100 flex justify-between items-center shadow-xs">
                  <div className="flex-1 pr-2">
                    <span className="text-xs font-bold text-gray-800 block">{sug.name}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1 font-semibold">
                      {sug.matchedCategories.map(({ catId, amt }) => {
                        const meta = dailyDozenCategories.find(c => c.id === catId);
                        return (
                          <span key={catId} className={`text-[8px] px-1 py-0.5 rounded ${meta?.bg} ${meta?.text}`}>
                            +{amt} {meta?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddToGrocery(sug)}
                    className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Plus size={10} />
                    <span>Buy Checklist</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}