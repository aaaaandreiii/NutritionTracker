import React, { useState } from 'react';
import { ShoppingBag, Plus, Trash2, ShoppingCart, Check, PlusCircle, Sparkles } from 'lucide-react';
import { DAILY_DOZEN_CATEGORIES } from '../data/constants';

export default function PantryGroceryHub({ pantry, setPantry, groceryList, setGroceryList, dailyDozenDeficits }) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('beans');
  const [newItemQty, setNewItemQty] = useState(1);

  const [newGroceryItem, setNewGroceryItem] = useState('');
  const [newGroceryCategory, setNewGroceryCategory] = useState('beans');

  const handleAddPantry = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const existingIndex = pantry.findIndex(
      item => item.name.toLowerCase() === newItemName.trim().toLowerCase()
    );

    if (existingIndex > -1) {
      const updated = [...pantry];
      updated[existingIndex].quantity += Number(newItemQty);
      setPantry(updated);
    } else {
      setPantry([
        ...pantry,
        {
          id: `p_${Date.now()}`,
          name: newItemName.trim(),
          category: newItemCategory,
          quantity: Number(newItemQty),
          cals: 120,
          servings: { [newItemCategory]: 1 }
        }
      ]);
    }
    setNewItemName('');
    setNewItemQty(1);
  };

  const handleDeletePantry = (id) => {
    setPantry(pantry.filter(item => item.id !== id));
  };

  const handleAdjustQty = (id, amount) => {
    setPantry(pantry.map(item => {
      if (item.id === id) {
        const nextQty = item.quantity + amount;
        return { ...item, quantity: nextQty < 0 ? 0 : nextQty };
      }
      return item;
    }));
  };

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
          id: `g_${Date.now()}`,
          name: newGroceryItem.trim(),
          category: newGroceryCategory,
          quantity: 1,
          checked: false
        }
      ]);
    }
    setNewGroceryItem('');
  };

  const handleToggleGrocery = (id) => {
    setGroceryList(groceryList.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const handlePurchaseChecked = () => {
    const checkedItems = groceryList.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    const updatedPantry = [...pantry];
    checkedItems.forEach(item => {
      const existingIdx = updatedPantry.findIndex(
        p => p.name.toLowerCase() === item.name.toLowerCase()
      );
      if (existingIdx > -1) {
        updatedPantry[existingIdx].quantity += item.quantity || 1;
      } else {
        updatedPantry.push({
          id: `p_${Date.now()}_${Math.random()}`,
          name: item.name,
          category: item.category || 'otherVeggies',
          quantity: item.quantity || 1,
          cals: 100,
          servings: item.servings || { [item.category || 'otherVeggies']: 1 }
        });
      }
    });

    setPantry(updatedPantry);
    setGroceryList(groceryList.filter(item => !item.checked));
  };

  const handleAddSuggestedToGrocery = (name, category) => {
    const existing = groceryList.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      setGroceryList([
        ...groceryList,
        {
          id: `g_sug_${Date.now()}_${Math.random()}`,
          name,
          category,
          quantity: 1,
          checked: false
        }
      ]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" /> My Pantry Stock
            </h2>
            <p className="text-xs text-gray-400 mt-1">Ingredients stocked in your kitchen</p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-medium">
            {pantry.reduce((acc, curr) => acc + (curr.quantity || 0), 0)} Items Stocked
          </span>
        </div>

        <form onSubmit={handleAddPantry} className="bg-gray-50 p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-3 border border-gray-100">
          <div className="flex-1">
            <input
              type="text"
              placeholder="e.g., Organic Red Lentils"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-white text-gray-800 rounded-xl p-2 text-sm border border-gray-100 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="bg-white text-gray-800 rounded-xl p-2 text-sm border border-gray-100"
            >
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              className="w-16 bg-white text-gray-800 rounded-xl p-2 text-sm border border-gray-100 text-center"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </form>

        {pantry.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm italic">Your pantry is currently empty.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {pantry.map(item => {
              const catObj = DAILY_DOZEN_CATEGORIES.find(c => c.id === item.category);
              return (
                <div key={item.id} className="flex items-center justify-between bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {catObj ? catObj.label : item.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white rounded-lg border border-gray-100 shadow-sm">
                      <button
                        onClick={() => handleAdjustQty(item.id, -1)}
                        className="px-2.5 py-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => handleAdjustQty(item.id, 1)}
                        className="px-2.5 py-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeletePantry(item.id)}
                      className="text-gray-300 hover:text-rose-500 p-1 transition-colors"
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

      <div className="lg:col-span-5 space-y-8">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-500" /> Grocery List
              </h2>
              <p className="text-xs text-gray-400 mt-1">Manage shopping needs</p>
            </div>
            {groceryList.some(g => g.checked) && (
              <button
                onClick={handlePurchaseChecked}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold shadow"
              >
                <Check className="w-3.5 h-3.5" /> Buy Checked
              </button>
            )}
          </div>

          <form onSubmit={handleAddGrocery} className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100 flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Add item..."
              value={newGroceryItem}
              onChange={(e) => setNewGroceryItem(e.target.value)}
              className="flex-1 bg-white text-gray-800 rounded-xl p-1.5 text-xs border border-gray-100 focus:outline-none"
            />
            <select
              value={newGroceryCategory}
              onChange={(e) => setNewGroceryCategory(e.target.value)}
              className="bg-white text-gray-800 rounded-xl p-1.5 text-xs border border-gray-100"
            >
              {DAILY_DOZEN_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 rounded-xl flex items-center justify-center shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </form>

          {groceryList.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-xs italic">Your grocery list is empty.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {groceryList.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleToggleGrocery(item.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    item.checked
                      ? 'bg-indigo-50/40 border-indigo-100 opacity-70'
                      : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      item.checked ? 'bg-indigo-600 border-indigo-500' : 'border-gray-200 bg-white'
                    }`}>
                      {item.checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-xs font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    {DAILY_DOZEN_CATEGORIES.find(c => c.id === item.category)?.label || item.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-md font-bold text-gray-900 font-serif">Smart Grocery Suggestions</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Suggested items based on your Daily Dozen deficits:
          </p>

          {dailyDozenDeficits.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
              <p className="text-emerald-700 text-xs font-semibold">Targets Fulfilling!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dailyDozenDeficits.slice(0, 3).map(def => {
                const targetFood = DAILY_DOZEN_CATEGORIES.find(c => c.id === def.key);
                const suggestedItem = targetFood ? targetFood.pantryItems[0] : null;

                if (!suggestedItem) return null;

                const alreadyInGrocery = groceryList.some(
                  g => g.name.toLowerCase() === suggestedItem.toLowerCase()
                );

                return (
                  <div key={def.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                        <span className="text-rose-500 font-bold">-{def.lacking} serv.</span>
                        lacking in {targetFood?.label}
                      </div>
                      <div className="text-xs font-bold text-gray-800 mt-1">👉 Buy {suggestedItem}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSuggestedToGrocery(suggestedItem, def.key);
                      }}
                      disabled={alreadyInGrocery}
                      className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold transition-colors ${
                        alreadyInGrocery
                          ? 'bg-gray-100 text-gray-400 border border-gray-200'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
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