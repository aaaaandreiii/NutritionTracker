import React, { useState } from 'react';
import { Plus, Trash2, Check, ShoppingBag, PlusCircle, AlertTriangle, Sparkles, ShoppingCart } from 'lucide-react';
import { DAILY_DOZEN_CATEGORIES } from '../data/constants';

export default function PantryGroceryHub({
  pantry,
  setPantry,
  groceryList,
  setGroceryList,
  dailyDozenDeficits,
  addLogFromPantry
}) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('beans');
  const [newItemQty, setNewItemQty] = useState(1);

  const [newGroceryItem, setNewGroceryItem] = useState('');
  const [newGroceryCategory, setNewGroceryCategory] = useState('beans');

  // Add Item to Pantry
  const handleAddPantry = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const existingIndex = pantry.findIndex(
      item => item.name.toLowerCase() === newItemName.trim().toLowerCase()
    );

    if (existingIndex > -1) {
      const updated = [...pantry];
      const calculatedQty = (updated[existingIndex].qty !== undefined ? updated[existingIndex].qty : updated[existingIndex].quantity || 0) + Number(newItemQty);
      updated[existingIndex].qty = calculatedQty;
      updated[existingIndex].quantity = calculatedQty;
      setPantry(updated);
    } else {
      setPantry([
        ...pantry,
        {
          id: Date.now().toString(),
          name: newItemName.trim(),
          category: newItemCategory,
          qty: Number(newItemQty),
          quantity: Number(newItemQty)
        }
      ]);
    }
    setNewItemName('');
    setNewItemQty(1);
  };

  // Delete from Pantry
  const handleDeletePantry = (id) => {
    setPantry(pantry.filter(item => item.id !== id));
  };

  // Adjust Pantry Quantity
  const handleAdjustQty = (id, amount) => {
    setPantry(pantry.map(item => {
      if (item.id === id) {
        const currentVal = item.qty !== undefined ? item.qty : item.quantity || 0;
        const nextQty = currentVal + amount;
        const safeQty = nextQty < 0 ? 0 : nextQty;
        return { ...item, qty: safeQty, quantity: safeQty };
      }
      return item;
    }));
  };

  // Add Item to Grocery List
  const handleAddGrocery = (e) => {
    e.preventDefault();
    if (!newGroceryItem.trim()) return;

    const existing = groceryList.find(
      g => g.name.toLowerCase() === newGroceryItem.trim().toLowerCase()
    );

    if (!existing) {
      setGroceryList([
        ...groceryList,
        {
          id: Date.now().toString(),
          name: newGroceryItem.trim(),
          category: newGroceryCategory,
          checked: false
        }
      ]);
    }
    setNewGroceryItem('');
  };

  // Toggle Grocery Checked status
  const handleToggleGrocery = (id) => {
    setGroceryList(groceryList.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  // Purchase Checked Grocery Items (adds them to pantry, clears from grocery)
  const handlePurchaseChecked = () => {
    const checkedItems = groceryList.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    const updatedPantry = [...pantry];
    checkedItems.forEach(item => {
      const existingIdx = updatedPantry.findIndex(
        p => p.name.toLowerCase() === item.name.toLowerCase()
      );
      const itemQuantity = item.qty || item.quantity || 1;
      if (existingIdx > -1) {
        const calculatedQty = (updatedPantry[existingIdx].qty !== undefined ? updatedPantry[existingIdx].qty : updatedPantry[existingIdx].quantity || 0) + itemQuantity;
        updatedPantry[existingIdx].qty = calculatedQty;
        updatedPantry[existingIdx].quantity = calculatedQty;
      } else {
        updatedPantry.push({
          id: Date.now().toString() + Math.random(),
          name: item.name,
          category: item.category,
          qty: itemQuantity,
          quantity: itemQuantity
        });
      }
    });

    setPantry(updatedPantry);
    setGroceryList(groceryList.filter(item => !item.checked));
  };

  // Add Recommended Deficiency Item to Grocery List
  const handleAddSuggestedToGrocery = (name, category) => {
    const existing = groceryList.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      setGroceryList([
        ...groceryList,
        {
          id: Date.now().toString() + Math.random(),
          name,
          category,
          checked: false
        }
      ]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: PANTRY MANAGEMENT */}
      <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" /> My Pantry
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Ingredients currently stocked in your kitchen</p>
          </div>
          <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 text-xs px-2.5 py-1 rounded-full font-medium">
            {pantry.reduce((acc, curr) => acc + curr.qty, 0)} Items Stocked
          </span>
        </div>

        {/* Add Pantry Item Form */}
        <form onSubmit={handleAddPantry} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 mb-6 flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="e.g., Organic Red Lentils"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-zinc-900 text-white rounded p-2 text-sm border border-zinc-800 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="bg-zinc-900 text-white rounded p-2 text-sm border border-zinc-800"
            >
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              className="w-16 bg-zinc-900 text-white rounded p-2 text-sm border border-zinc-800 text-center"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded text-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </form>

        {/* Pantry List */}
        {pantry.length === 0 ? (
          <div className="text-center py-12 bg-zinc-950 rounded-xl border border-dashed border-zinc-800">
            <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Your pantry is empty.</p>
            <p className="text-xs text-zinc-600 mt-1">Add items above or move purchased items from your grocery list.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {pantry.map(item => {
              const catObj = DAILY_DOZEN_CATEGORIES.find(c => c.key === item.category);
              const displayQty = item.qty !== undefined ? item.qty : item.quantity || 0;
              return (
                <div key={item.id} className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div>
                    <div className="font-medium text-white text-sm">{item.name}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {catObj ? catObj.name : item.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-zinc-900 rounded border border-zinc-800">
                      <button
                        onClick={() => handleAdjustQty(item.id, -1)}
                        className="px-2.5 py-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        -
                      </button>
                      <span className="px-2 text-sm font-semibold text-white">{displayQty}</span>
                      <button
                        onClick={() => handleAdjustQty(item.id, 1)}
                        className="px-2.5 py-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeletePantry(item.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove from pantry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: GROCERY LIST & SMART RECOMMENDATIONS */}
      <div className="lg:col-span-5 space-y-8">
        {/* GROCERY LIST CARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" /> Grocery List
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Manage food items to buy</p>
            </div>
            {groceryList.some(g => g.checked) && (
              <button
                onClick={handlePurchaseChecked}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium shadow"
              >
                <Check className="w-3.5 h-3.5" /> Buy Selected
              </button>
            )}
          </div>

          {/* Quick Add Grocery Form */}
          <form onSubmit={handleAddGrocery} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/85 flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Add item..."
              value={newGroceryItem}
              onChange={(e) => setNewGroceryItem(e.target.value)}
              className="flex-1 bg-zinc-900 text-white rounded p-1.5 text-xs border border-zinc-800 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newGroceryCategory}
              onChange={(e) => setNewGroceryCategory(e.target.value)}
              className="bg-zinc-900 text-white rounded p-1.5 text-xs border border-zinc-800"
            >
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs px-3 rounded flex items-center gap-1 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Grocery List Checkboxes */}
          {groceryList.length === 0 ? (
            <div className="text-center py-8 bg-zinc-950 rounded-xl border border-dashed border-zinc-800">
              <ShoppingCart className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-xs">Your grocery list is empty.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {groceryList.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleToggleGrocery(item.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                    item.checked
                      ? 'bg-indigo-950/20 border-indigo-900/50 opacity-70'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      item.checked ? 'bg-indigo-600 border-indigo-500' : 'border-zinc-700'
                    }`}>
                      {item.checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-xs ${item.checked ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {DAILY_DOZEN_CATEGORIES.find(c => c.key === item.category)?.name || item.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SMART GROCERY SUGGESTIONS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-md font-bold text-white">Smart Grocery Suggestions</h3>
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Items suggested to purchase based on your current Daily Dozen deficits:
          </p>

          {dailyDozenDeficits.length === 0 ? (
            <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-center">
              <p className="text-emerald-400 text-xs font-semibold">Targets Stocked!</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">You are fully on track to achieve all targets today.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dailyDozenDeficits.slice(0, 3).map(def => {
                const targetFood = DAILY_DOZEN_CATEGORIES.find(c => c.key === def.key);
                const suggestedItem = targetFood ? targetFood.pantryItems[0] : null;

                if (!suggestedItem) return null;

                const alreadyInGrocery = groceryList.some(
                  g => g.name.toLowerCase() === suggestedItem.toLowerCase()
                );

                return (
                  <div key={def.key} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div>
                      <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                        <span className="text-rose-400 font-bold">-{def.lacking} serv.</span>
                        lacking in {targetFood?.name}
                      </div>
                      <div className="text-xs font-bold text-white mt-1">👉 Buy {suggestedItem}</div>
                    </div>
                    <button
                      onClick={() => handleAddSuggestedToGrocery(suggestedItem, def.key)}
                      disabled={alreadyInGrocery}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        alreadyInGrocery
                          ? 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700'
                      }`}
                    >
                      {alreadyInGrocery ? 'Added' : 'Add to List'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}