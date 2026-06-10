import React from 'react';

export const CategoryIcons = {
  beans: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c0-3 3-5 6-5s6 2 6 5-3 5-6 5-6-2-6-5Z" />
      <path d="M13 12c0-2.2 2.2-4 5-4s5 1.8 5 4-2.2 4-5 4-5-1.8-5-4Z" />
    </svg>
  ),
  berries: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="11" r="3" />
      <circle cx="17" cy="11" r="3" />
      <circle cx="12" cy="17" r="3" />
      <path d="M12 8V4c0-1.1.9-2 2-2" />
    </svg>
  ),
  otherFruits: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 2a3 3 0 0 0-3 3M12 12c2.5-2.5 5-2.5 5-2.5" />
    </svg>
  ),
  cruciferous: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-4-3-4-8 2-6 4-6 4 1 4 6-4 8-4 8Z" />
      <path d="M6 12c0-3 2-4 4-4M18 12c0-3-2-4-4-4" />
    </svg>
  ),
  greens: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2-2 3c-1.5 2-3 3-5 3.5C3 9 2 11 2 13c0 4 3 7 7 7h6c4 0 7-3 7-7 0-2-1-4-3-4.5-2-.5-3.5-1.5-5-3.5l-2-3Z" />
      <path d="M12 8v12" />
    </svg>
  ),
  otherVeggies: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M12 6l-6 6M18 12l-6 6" />
      <path d="M22 2s-4.5 1-7 3.5c-4 4-6.5 9.5-7 11.5L3 21l4-5c2-.5 7.5-3 11.5-7C21 6.5 22 2 22 2Z" />
    </svg>
  ),
  flaxseeds: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  nutsSeeds: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 0 0-9 9c0 1.5.5 3 1.3 4.2L3 21l4.8-1.3c1.2.8 2.7 1.3 4.2 1.3a9 9 0 0 0 9-9c0-5-4-9-9-9Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  herbsSpices: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a15 15 0 0 0-3.5 10.5C8.5 18 12 22 12 22s3.5-4 3.5-9.5A15 15 0 0 0 12 2Z" />
      <path d="M12 12h.01" />
    </svg>
  ),
  wholeGrains: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V10M18 22V10M12 22V2" />
      <path d="M12 6c1.5-1.5 3-1.5 3 0s-1.5 1.5-3 0c-1.5 1.5-3 1.5-3 0s1.5-1.5 3 0" />
      <path d="M12 14c1.5-1.5 3-1.5 3 0s-1.5 1.5-3 0c-1.5 1.5-3 1.5-3 0s1.5-1.5 3 0" />
    </svg>
  ),
  beverages: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v4M10 2v4M14 2v4" />
    </svg>
  ),
  exercise: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h.01M6 8h.01M2 12h20M12 2v20" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
};

export const dailyDozenCategories = [
  { id: 'beans', label: 'Beans & Legumes', target: 3, unit: 'servings', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50/75', description: 'Chickpeas, black beans, lentils, edamame, tofu, hummus.' },
  { id: 'berries', label: 'Berries', target: 1, unit: 'serving', color: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50/75', description: 'Blueberries, raspberries, strawberries, blackberries, cherries.' },
  { id: 'otherFruits', label: 'Other Fruits', target: 3, unit: 'servings', color: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-50/75', description: 'Apples, bananas, citrus fruits, grapes, pears, mangoes.' },
  { id: 'cruciferous', label: 'Cruciferous Veg', target: 1, unit: 'serving', color: 'bg-green-600', text: 'text-green-800', bg: 'bg-green-50/75', description: 'Broccoli, kale, cabbage, brussels sprouts, cauliflower, arugula.' },
  { id: 'greens', label: 'Salad Greens', target: 2, unit: 'servings', color: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50/75', description: 'Spinach, mixed greens, Swiss chard, romaine lettuce.' },
  { id: 'otherVeggies', label: 'Other Veggies', target: 2, unit: 'servings', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50/75', description: 'Carrots, bell peppers, tomatoes, mushrooms, garlic, onions.' },
  { id: 'flaxseeds', label: 'Flaxseeds', target: 1, unit: 'serving', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50/75', description: '1 tbsp ground flaxseeds daily.' },
  { id: 'nutsSeeds', label: 'Nuts & Seeds', target: 1, unit: 'serving', color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50/75', description: 'Walnuts, almonds, chia seeds, pumpkin seeds, hemp seeds.' },
  { id: 'herbsSpices', label: 'Herbs & Spices', target: 1, unit: 'serving', color: 'bg-yellow-600', text: 'text-yellow-800', bg: 'bg-yellow-50/75', description: '1/4 tsp turmeric plus any other fresh/dry herbs.' },
  { id: 'wholeGrains', label: 'Whole Grains', target: 3, unit: 'servings', color: 'bg-amber-600', text: 'text-amber-800', bg: 'bg-amber-50/75', description: 'Oatmeal, brown rice, quinoa, wild rice, whole wheat pasta.' },
  { id: 'beverages', label: 'Beverages', target: 5, unit: 'servings', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50/75', description: 'Water, green tea, hibiscus tea (approx. 12 oz / 350ml per serving).' },
  { id: 'exercise', label: 'Exercise', target: 1, unit: 'session', color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50/75', description: '40 mins of vigorous or 90 mins of moderate physical activity.' }
];

export const foodDB = [
  { id: 'f1', name: 'Power Oats w/ Flax & Berries', cals: 320, servings: { wholeGrains: 2, berries: 1, flaxseeds: 1 }, tags: ['breakfast', 'morningSnack'] },
  { id: 'f2', name: 'Hummus & Baby Carrots', cals: 160, servings: { beans: 1, otherVeggies: 1 }, tags: ['morningSnack', 'afternoonSnack'] },
  { id: 'f3', name: 'Tofu & Broccoli Stir-Fry with Quinoa', cals: 440, servings: { beans: 1.5, cruciferous: 1, otherVeggies: 1, wholeGrains: 2, herbsSpices: 0.5 }, tags: ['lunch', 'dinner'] },
  { id: 'f4', name: 'Spinach Berry Walnut Salad', cals: 280, servings: { greens: 2, berries: 1, nutsSeeds: 1 }, tags: ['lunch', 'dinner', 'afternoonSnack'] },
  { id: 'f5', name: 'Antioxidant Hibiscus Green Tea', cals: 5, servings: { beverages: 2, herbsSpices: 0.5 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack', 'lunch', 'dinner'] },
  { id: 'f6', name: 'Lentil Veggie Soup with Kale', cals: 240, servings: { beans: 2, greens: 1, cruciferous: 0.5, otherVeggies: 1 }, tags: ['lunch', 'dinner'] },
  { id: 'f7', name: 'Daily Dozen Green Smoothie', cals: 310, servings: { berries: 1, otherFruits: 1, greens: 1, flaxseeds: 1, nutsSeeds: 0.5, beverages: 1 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack'] },
  { id: 'f8', name: 'Turmeric Ginger Latte (Soy Milk)', cals: 130, servings: { herbsSpices: 1, beverages: 1, beans: 0.5 }, tags: ['breakfast', 'afternoonSnack'] },
  { id: 'f9', name: '30-min Brisk Walking', cals: 140, servings: { exercise: 0.35 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack', 'lunch', 'dinner'] },
  { id: 'f10', name: '90-min Moderate Exercise Flow', cals: 350, servings: { exercise: 1 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack', 'lunch', 'dinner'] },
  { id: 'f11', name: 'Steamed Edamame Bowl', cals: 150, servings: { beans: 1.5 }, tags: ['morningSnack', 'afternoonSnack', 'lunch'] },
  { id: 'f12', name: 'Apple slices with Almond Butter', cals: 220, servings: { otherFruits: 1, nutsSeeds: 1 }, tags: ['morningSnack', 'afternoonSnack'] },
  { id: 'f13', name: 'Tall Glass of Pure Water', cals: 0, servings: { beverages: 1 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack', 'lunch', 'dinner'] },
  { id: 'f14', name: 'Three-Bean Chili with Brown Rice', cals: 480, servings: { beans: 2.5, wholeGrains: 1.5, otherVeggies: 1.5, herbsSpices: 0.5 }, tags: ['lunch', 'dinner'] },
  { id: 'f15', name: 'Mashed Avocado on Whole Wheat Toast', cals: 260, servings: { wholeGrains: 1, nutsSeeds: 0.5, otherVeggies: 0.5 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack'] },
  { id: 'f16', name: 'Steamed Brussels Sprouts with Turmeric', cals: 90, servings: { cruciferous: 1.5, herbsSpices: 0.5 }, tags: ['lunch', 'dinner', 'afternoonSnack'] },
  { id: 'f17', name: 'Chia Seed Pudding with Strawberries', cals: 180, servings: { nutsSeeds: 1, berries: 1, beverages: 0.5 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack'] },
  { id: 'f18', name: 'Mixed Roasted Seeds Mix', cals: 140, servings: { nutsSeeds: 1 }, tags: ['morningSnack', 'afternoonSnack'] },
  { id: 'f19', name: 'Ground Flaxseed Spoonful', cals: 40, servings: { flaxseeds: 1 }, tags: ['breakfast', 'morningSnack', 'afternoonSnack', 'lunch', 'dinner'] },
  { id: 'f20', name: 'Steamed Asparagus & Garlic', cals: 60, servings: { otherVeggies: 1.5 }, tags: ['lunch', 'dinner'] }
];

export const healthyRecipesDB = [
  {
    id: 'rec1',
    name: "Dr. Greger's Anti-Inflammatory Lentil Bowl",
    tagline: "High-protein recovery stew containing daily servings of legumes, greens, and turmeric.",
    prepTime: "10 mins",
    cookTime: "25 mins",
    cals: 380,
    dozenServings: { beans: 2, cruciferous: 0.5, greens: 1, otherVeggies: 1, herbsSpices: 1 },
    ingredients: [
      { name: "Brown Lentils", amount: "1 cup", category: "beans" },
      { name: "Spinach", amount: "2 cups", category: "greens" },
      { name: "Broccoli Florets", amount: "1/2 cup", category: "cruciferous" },
      { name: "Carrots", amount: "1 medium", category: "otherVeggies" },
      { name: "Ground Turmeric", amount: "1/4 tsp", category: "herbsSpices" }
    ],
    steps: [
      "In a medium pot, boil the brown lentils in 3 cups of water for 20 minutes until tender.",
      "Steam the broccoli florets and sliced carrots for the last 5 minutes over the boiling lentils using a steam basket.",
      "Drain lentils, then toss together in a large bowl with the fresh spinach leaves (they will wilt naturally from the warmth).",
      "Dust with the ground turmeric and a pinch of black pepper (to activate the curcumin) before serving."
    ]
  },
  {
    id: 'rec2',
    name: "Gut-Biome Booster Berry Oatmeal",
    tagline: "Rich in beta-glucans and prebiotics to maximize digestion health and natural energy levels.",
    prepTime: "5 mins",
    cookTime: "8 mins",
    cals: 340,
    dozenServings: { wholeGrains: 2, berries: 1, flaxseeds: 1, nutsSeeds: 0.5 },
    ingredients: [
      { name: "Rolled Oats", amount: "1/2 cup", category: "wholeGrains" },
      { name: "Blueberries", amount: "1/2 cup", category: "berries" },
      { name: "Ground Flaxseeds", amount: "1 tbsp", category: "flaxseeds" },
      { name: "Walnuts", amount: "2 tbsp", category: "nutsSeeds" }
    ],
    steps: [
      "Combine rolled oats with 1 cup of water or unsweetened soy milk in a saucepan. Bring to a boil, then simmer for 5 minutes.",
      "Remove from heat and stir in the fresh or frozen blueberries.",
      "Top with ground flaxseeds and crushed walnuts to provide a dense fiber matrix for gut microbes."
    ]
  },
  {
    id: 'rec3',
    name: "Antioxidant Rich Cruciferous Power Salad",
    tagline: "A crunchy, satisfying raw salad optimized for sulforaphane intake and cellular defense.",
    prepTime: "15 mins",
    cookTime: "0 mins",
    cals: 290,
    dozenServings: { cruciferous: 1, greens: 1, otherFruits: 1, nutsSeeds: 1 },
    ingredients: [
      { name: "Chopped Kale", amount: "2 cups", category: "greens" },
      { name: "Shredded Brussels Sprouts", amount: "1/2 cup", category: "cruciferous" },
      { name: "Apple", amount: "1 medium, chopped", category: "otherFruits" },
      { name: "Pumpkin Seeds", amount: "2 tbsp", category: "nutsSeeds" }
    ],
    steps: [
      "Wash and finely chop kale leaves, then massage them with a squeeze of fresh lemon juice for 2 minutes to soften.",
      "Add the shredded Brussels sprouts and chopped apple slices.",
      "Toss with pumpkin seeds and a touch of balsamic vinegar. Serve cold."
    ]
  },
  {
    id: 'rec4',
    name: "Heart-Protective Spiced Chia Drink",
    tagline: "Rich in omega-3 fatty acids and heart-protective polyphenols.",
    prepTime: "5 mins",
    cookTime: "5 mins (steeping)",
    cals: 160,
    dozenServings: { nutsSeeds: 1, beverages: 1, herbsSpices: 0.5 },
    ingredients: [
      { name: "Chia Seeds", amount: "2 tbsp", category: "nutsSeeds" },
      { name: "Hibiscus Tea Bag", amount: "1 bag", category: "beverages" },
      { name: "Ginger Root", amount: "1/2 inch slice", category: "herbsSpices" }
    ],
    steps: [
      "Steep the Hibiscus tea bag and ginger slice in 12 oz of boiling water for 5 minutes.",
      "Let cool, remove tea bag/ginger, then whisk in the chia seeds vigorously.",
      "Allow to sit for 10 minutes until a gel forms. Serve chilled or room temperature."
    ]
  }
];

export const goalPresets = {
  'Standard Daily Dozen': { beans: 3, berries: 1, otherFruits: 3, cruciferous: 1, greens: 2, otherVeggies: 2, flaxseeds: 1, nutsSeeds: 1, herbsSpices: 1, wholeGrains: 3, beverages: 5, exercise: 1, label: "Dr. Greger's Standard recommendations for optimal life expectancy." },
  'Athletic Fuel': { beans: 4, berries: 1.5, otherFruits: 4, cruciferous: 1, greens: 2.5, otherVeggies: 2.5, flaxseeds: 1.5, nutsSeeds: 1.5, herbsSpices: 1, wholeGrains: 5, beverages: 7, exercise: 1.5, label: "Slightly boosted macros, extra hydration, and grain servings for energy." },
  'Gut Microbiome Booster': { beans: 4, berries: 2, otherFruits: 3, cruciferous: 2, greens: 3, otherVeggies: 3, flaxseeds: 1, nutsSeeds: 1, herbsSpices: 1.5, wholeGrains: 3, beverages: 5, exercise: 1, label: "Increased diversity, higher fiber counts, and cruciferous leafy greens." },
  'Heart Protective / Low Carb': { beans: 2.5, berries: 1.5, otherFruits: 2, cruciferous: 2, greens: 3, otherVeggies: 3, flaxseeds: 1.5, nutsSeeds: 1.5, herbsSpices: 1.5, wholeGrains: 1.5, beverages: 6, exercise: 1, label: "Focused heavily on healthy fats, antioxidants, and dark leafy greens." }
};

export const mealSlots = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'morningSnack', label: 'Morning Snack' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'afternoonSnack', label: 'Afternoon Snack' },
  { id: 'dinner', label: 'Dinner' }
];