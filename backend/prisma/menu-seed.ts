/**
 * RestroCloud — Full Menu Seed
 * 10 categories · 5 items each · modifier groups · add-ons · nested options · food images
 * Run: npx ts-node prisma/menu-seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Image bank (Unsplash CDN) ────────────────────────────────────────────────
const IMG = {
  // Starters
  samosa:        'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80&fit=crop',
  chickenSoup:   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80&fit=crop',
  chickenTikkaS: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80&fit=crop',
  prawnCocktail: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80&fit=crop',
  onionRings:    'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80&fit=crop',
  // Main Course
  beefBhuna:     'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80&fit=crop',
  muttonCurry:   'https://images.unsplash.com/photo-1631292784640-2b24be784d5d?w=600&q=80&fit=crop',
  chickenRogan:  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80&fit=crop',
  dalMakhani:    'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&q=80&fit=crop',
  fishCurry:     'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&q=80&fit=crop',
  // Biryani
  chickenBiryani:'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80&fit=crop',
  muttonBiryani: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80&fit=crop',
  beefBiryani:   'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80&fit=crop',
  vegFriedRice:  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80&fit=crop',
  plainRice:     'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=600&q=80&fit=crop',
  // Grill & BBQ
  mixedGrill:    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80&fit=crop',
  seekhKebab:    'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&q=80&fit=crop',
  tandooriChkn:  'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=600&q=80&fit=crop',
  shishTawook:   'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&q=80&fit=crop',
  bbqRibs:       'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80&fit=crop',
  // Bread & Roti
  naan:          'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80&fit=crop',
  garlicNaan:    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80&fit=crop',
  paratha:       'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&q=80&fit=crop',
  puri:          'https://images.unsplash.com/photo-1631788004538-d3e5e64aaa81?w=600&q=80&fit=crop',
  chapati:       'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&q=80&fit=crop',
  // Seafood
  fishChips:     'https://images.unsplash.com/photo-1597284702961-8a41453b0ce5?w=600&q=80&fit=crop',
  prawnMasala:   'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80&fit=crop',
  hilsa:         'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&q=80&fit=crop',
  crabCurry:     'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=600&q=80&fit=crop',
  grilledFish:   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80&fit=crop',
  // Vegetarian
  paneerButter:  'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80&fit=crop',
  chanaMasala:   'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80&fit=crop',
  alooGobi:      'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&q=80&fit=crop',
  mixedVeg:      'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80&fit=crop',
  lentilSoup:    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80&fit=crop',
  // Burgers
  beefBurger:    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80&fit=crop',
  chickenBurger: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&q=80&fit=crop',
  clubSandwich:  'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=600&q=80&fit=crop',
  cheeseBurger:  'https://images.unsplash.com/photo-1586816001966-79b736744398?w=600&q=80&fit=crop',
  fishBurger:    'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=600&q=80&fit=crop',
  // Desserts
  gulabJamun:    'https://images.unsplash.com/photo-1589931788940-ffe5df28a9db?w=600&q=80&fit=crop',
  rasmalai:      'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop',
  firni:         'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop',
  iceCream:      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80&fit=crop',
  faluda:        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80&fit=crop',
  // Drinks
  borhani:       'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80&fit=crop',
  mangoLassi:    'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80&fit=crop',
  water:         'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=80&fit=crop',
  softDrink:     'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80&fit=crop',
  limeSoda:      'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=600&q=80&fit=crop',
};

async function main() {
  console.log('🍽️  Menu seed starting...\n');

  // ── Find existing restaurant ──────────────────────────────────────────────
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: 'spice-garden-gulshan' },
  });
  if (!restaurant) {
    console.error('❌ Restaurant not found. Run the main seed first: npm run db:seed');
    process.exit(1);
  }
  const { id: restaurantId, tenantId } = restaurant;
  console.log(`✅ Restaurant: ${restaurant.name} (${restaurantId})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORIES (10)
  // ═══════════════════════════════════════════════════════════════════════════
  const catDefs = [
    { id: 'cat-starters',   name: 'Starters & Soups',      sortOrder: 1 },
    { id: 'cat-mains',      name: 'Main Course',            sortOrder: 2 },
    { id: 'cat-biryani',    name: 'Biryani & Rice',         sortOrder: 3 },
    { id: 'cat-grill',      name: 'Grills & BBQ',           sortOrder: 4 },
    { id: 'cat-bread',      name: 'Bread & Roti',           sortOrder: 5 },
    { id: 'cat-seafood',    name: 'Seafood',                sortOrder: 6 },
    { id: 'cat-veg',        name: 'Vegetarian',             sortOrder: 7 },
    { id: 'cat-burgers',    name: 'Burgers & Sandwiches',   sortOrder: 8 },
    { id: 'cat-desserts',   name: 'Desserts',               sortOrder: 9 },
    { id: 'cat-drinks',     name: 'Drinks & Beverages',     sortOrder: 10 },
  ];

  const cats: Record<string, string> = {};
  for (const c of catDefs) {
    const cat = await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { id: c.id, tenantId, restaurantId, name: c.name, sortOrder: c.sortOrder },
    });
    cats[c.id] = cat.id;
  }
  console.log(`✅ ${catDefs.length} categories created\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // MODIFIER GROUPS + MODIFIERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Portion Size (Required) ────────────────────────────────────────────
  const mgSize = await prisma.modifierGroup.upsert({
    where: { id: 'mg-size' },
    update: {},
    create: { id: 'mg-size', tenantId, restaurantId, name: 'Portion Size', minSelect: 1, maxSelect: 1, isRequired: true },
  });
  const modSizeHalf = await prisma.modifier.upsert({
    where: { id: 'mod-size-half' }, update: {},
    create: { id: 'mod-size-half', tenantId, modifierGroupId: mgSize.id, name: 'Half Portion', priceAdjustment: -80, sortOrder: 1 },
  });
  const modSizeReg = await prisma.modifier.upsert({
    where: { id: 'mod-size-reg' }, update: {},
    create: { id: 'mod-size-reg', tenantId, modifierGroupId: mgSize.id, name: 'Regular', priceAdjustment: 0, isDefault: true, sortOrder: 2 },
  });
  const modSizeLarge = await prisma.modifier.upsert({
    where: { id: 'mod-size-large' }, update: {},
    create: { id: 'mod-size-large', tenantId, modifierGroupId: mgSize.id, name: 'Large (+extra)', priceAdjustment: 100, sortOrder: 3 },
  });

  // ── 2. Spice Level (Optional) ─────────────────────────────────────────────
  const mgSpice = await prisma.modifierGroup.upsert({
    where: { id: 'mg-spice' },
    update: {},
    create: { id: 'mg-spice', tenantId, restaurantId, name: 'Spice Level', minSelect: 0, maxSelect: 1, isRequired: false },
  });
  for (const [id, name, adj, def] of [
    ['mod-spice-mild',   'Mild',       0, false],
    ['mod-spice-med',    'Medium',     0, true],
    ['mod-spice-hot',    'Hot',        0, false],
    ['mod-spice-xhot',   'Extra Hot',  0, false],
  ] as [string, string, number, boolean][]) {
    await prisma.modifier.upsert({
      where: { id }, update: {},
      create: { id, tenantId, modifierGroupId: mgSpice.id, name, priceAdjustment: adj, isDefault: def, sortOrder: ['mild','med','hot','xhot'].indexOf(id.split('-')[2]) + 1 },
    });
  }

  // ── 3. Add-ons (Optional, multi-select) ───────────────────────────────────
  const mgAddons = await prisma.modifierGroup.upsert({
    where: { id: 'mg-addons' },
    update: {},
    create: { id: 'mg-addons', tenantId, restaurantId, name: 'Add-ons', minSelect: 0, maxSelect: 5, isRequired: false },
  });
  const addonItems = [
    { id: 'mod-addon-rice',   name: 'Extra Rice',          price: 60 },
    { id: 'mod-addon-sauce',  name: 'Extra Sauce',         price: 30 },
    { id: 'mod-addon-salad',  name: 'Garden Salad',        price: 80 },
    { id: 'mod-addon-raita',  name: 'Raita',               price: 50 },
    { id: 'mod-addon-papad',  name: 'Papad',               price: 25 },
    { id: 'mod-addon-egg',    name: 'Fried Egg',           price: 40 },
    { id: 'mod-addon-cheese', name: 'Extra Cheese',        price: 60 },
    { id: 'mod-addon-protein','name': 'Protein Upgrade',   price: 0  },  // triggers nested group
  ];
  for (let i = 0; i < addonItems.length; i++) {
    const a = addonItems[i];
    await prisma.modifier.upsert({
      where: { id: a.id }, update: {},
      create: { id: a.id, tenantId, modifierGroupId: mgAddons.id, name: a.name, priceAdjustment: a.price, sortOrder: i + 1 },
    });
  }

  // ── 3a. NESTED: Choose Protein (child of "Protein Upgrade") ──────────────
  const modProtein = await prisma.modifier.findUnique({ where: { id: 'mod-addon-protein' } });
  const mgProtein = await prisma.modifierGroup.upsert({
    where: { id: 'mg-protein-type' },
    update: {},
    create: {
      id: 'mg-protein-type',
      tenantId,
      restaurantId,
      name: 'Choose Protein',
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      parentModifierId: modProtein!.id,
    },
  });
  for (const [id, name, price] of [
    ['mod-prot-chicken', 'Chicken',  80],
    ['mod-prot-beef',    'Beef',    120],
    ['mod-prot-mutton',  'Mutton',  150],
    ['mod-prot-prawn',   'Prawn',   180],
  ] as [string, string, number][]) {
    await prisma.modifier.upsert({
      where: { id }, update: {},
      create: { id, tenantId, modifierGroupId: mgProtein.id, name, priceAdjustment: price, sortOrder: 1 },
    });
  }

  // ── 4. Cooking Style (Optional, single) ──────────────────────────────────
  const mgStyle = await prisma.modifierGroup.upsert({
    where: { id: 'mg-style' },
    update: {},
    create: { id: 'mg-style', tenantId, restaurantId, name: 'Cooking Style', minSelect: 0, maxSelect: 1, isRequired: false },
  });
  await prisma.modifier.upsert({ where: { id: 'mod-style-dry'   }, update: {}, create: { id: 'mod-style-dry',   tenantId, modifierGroupId: mgStyle.id, name: 'Dry',       priceAdjustment: 0, isDefault: true, sortOrder: 1 } });
  await prisma.modifier.upsert({ where: { id: 'mod-style-gravy' }, update: {}, create: { id: 'mod-style-gravy', tenantId, modifierGroupId: mgStyle.id, name: 'With Gravy', priceAdjustment: 0, sortOrder: 2 } });

  // ── 5. Drink Size (Required) ───────────────────────────────────────────────
  const mgDrinkSize = await prisma.modifierGroup.upsert({
    where: { id: 'mg-drink-size' },
    update: {},
    create: { id: 'mg-drink-size', tenantId, restaurantId, name: 'Size', minSelect: 1, maxSelect: 1, isRequired: true },
  });
  await prisma.modifier.upsert({ where: { id: 'mod-ds-small'  }, update: {}, create: { id: 'mod-ds-small',  tenantId, modifierGroupId: mgDrinkSize.id, name: 'Small (250ml)',  priceAdjustment: -30, sortOrder: 1 } });
  await prisma.modifier.upsert({ where: { id: 'mod-ds-reg'    }, update: {}, create: { id: 'mod-ds-reg',    tenantId, modifierGroupId: mgDrinkSize.id, name: 'Regular (400ml)', priceAdjustment: 0,   isDefault: true, sortOrder: 2 } });
  await prisma.modifier.upsert({ where: { id: 'mod-ds-large'  }, update: {}, create: { id: 'mod-ds-large',  tenantId, modifierGroupId: mgDrinkSize.id, name: 'Large (600ml)',   priceAdjustment: 40,  sortOrder: 3 } });

  // ── 6. Ice Preference (Optional) ─────────────────────────────────────────
  const mgIce = await prisma.modifierGroup.upsert({
    where: { id: 'mg-ice' },
    update: {},
    create: { id: 'mg-ice', tenantId, restaurantId, name: 'Ice', minSelect: 0, maxSelect: 1, isRequired: false },
  });
  await prisma.modifier.upsert({ where: { id: 'mod-ice-no'    }, update: {}, create: { id: 'mod-ice-no',    tenantId, modifierGroupId: mgIce.id, name: 'No Ice',     priceAdjustment: 0, sortOrder: 1 } });
  await prisma.modifier.upsert({ where: { id: 'mod-ice-reg'   }, update: {}, create: { id: 'mod-ice-reg',   tenantId, modifierGroupId: mgIce.id, name: 'Regular Ice', priceAdjustment: 0, isDefault: true, sortOrder: 2 } });
  await prisma.modifier.upsert({ where: { id: 'mod-ice-extra' }, update: {}, create: { id: 'mod-ice-extra', tenantId, modifierGroupId: mgIce.id, name: 'Extra Ice',   priceAdjustment: 0, sortOrder: 3 } });

  // ── 7. Burger Toppings (Optional, multi) ─────────────────────────────────
  const mgToppings = await prisma.modifierGroup.upsert({
    where: { id: 'mg-toppings' },
    update: {},
    create: { id: 'mg-toppings', tenantId, restaurantId, name: 'Extra Toppings', minSelect: 0, maxSelect: 5, isRequired: false },
  });
  for (const [id, name, price, sortOrder] of [
    ['mod-top-cheese',   'Extra Cheese', 40, 1],
    ['mod-top-jalap',    'Jalapeños',    20, 2],
    ['mod-top-onion',    'Caramelised Onion', 20, 3],
    ['mod-top-mushroom', 'Mushrooms',    35, 4],
    ['mod-top-bacon',    'Crispy Onion', 30, 5],
  ] as [string, string, number, number][]) {
    await prisma.modifier.upsert({
      where: { id }, update: {},
      create: { id, tenantId, modifierGroupId: mgToppings.id, name, priceAdjustment: price, sortOrder },
    });
  }

  // ── 7a. NESTED: Extra Cheese sub-options ─────────────────────────────────
  const modExtraCheese = await prisma.modifier.findUnique({ where: { id: 'mod-top-cheese' } });
  const mgCheeseType = await prisma.modifierGroup.upsert({
    where: { id: 'mg-cheese-type' },
    update: {},
    create: {
      id: 'mg-cheese-type',
      tenantId,
      restaurantId,
      name: 'Cheese Type',
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      parentModifierId: modExtraCheese!.id,
    },
  });
  for (const [id, name] of [
    ['mod-cheese-cheddar',  'Cheddar'],
    ['mod-cheese-mozzarella','Mozzarella'],
    ['mod-cheese-processed','Processed Slice'],
  ]) {
    await prisma.modifier.upsert({
      where: { id }, update: {},
      create: { id, tenantId, modifierGroupId: mgCheeseType.id, name, priceAdjustment: 0, sortOrder: 1 },
    });
  }

  // ── 8. Dessert Temperature ────────────────────────────────────────────────
  const mgTemp = await prisma.modifierGroup.upsert({
    where: { id: 'mg-temp' },
    update: {},
    create: { id: 'mg-temp', tenantId, restaurantId, name: 'Serving Temperature', minSelect: 0, maxSelect: 1, isRequired: false },
  });
  await prisma.modifier.upsert({ where: { id: 'mod-temp-warm' }, update: {}, create: { id: 'mod-temp-warm', tenantId, modifierGroupId: mgTemp.id, name: 'Warm', priceAdjustment: 0, isDefault: true, sortOrder: 1 } });
  await prisma.modifier.upsert({ where: { id: 'mod-temp-cold' }, update: {}, create: { id: 'mod-temp-cold', tenantId, modifierGroupId: mgTemp.id, name: 'Chilled', priceAdjustment: 0, sortOrder: 2 } });

  console.log(`✅ 8 modifier groups + nested sub-groups created\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEMS (10 × 5 = 50)
  // ═══════════════════════════════════════════════════════════════════════════

  type ItemDef = {
    id: string; name: string; price: number; categoryId: string;
    description?: string; imageUrl?: string; preparationTime?: number;
    calories?: number; allergens?: string[]; dietaryTags?: string[];
    groups?: string[]; // modifier group IDs to attach
    sortOrder: number;
  };

  const items: ItemDef[] = [
    // ── STARTERS & SOUPS ─────────────────────────────────────────────────
    { id: 'item-veg-singara',   name: 'Vegetable Singara (4 pcs)',  price: 80,  categoryId: cats['cat-starters'], description: 'Crispy golden pastry filled with spiced potato & vegetables, served with mint chutney.', imageUrl: IMG.samosa,        preparationTime: 8,  calories: 180, dietaryTags: ['vegetarian'], allergens: ['gluten'],        groups: ['mg-spice', 'mg-addons'], sortOrder: 1 },
    { id: 'item-chkn-soup',     name: 'Spicy Chicken Soup',        price: 150, categoryId: cats['cat-starters'], description: 'Hearty broth with tender chicken pieces, vegetables and fragrant spices.', imageUrl: IMG.chickenSoup,   preparationTime: 10, calories: 220,                            allergens: [],                groups: ['mg-spice'],             sortOrder: 2 },
    { id: 'item-chkn-tikka-s',  name: 'Chicken Tikka Starter',     price: 280, categoryId: cats['cat-starters'], description: 'Tender chicken marinated in yogurt and spices, cooked in clay oven. Served with salad.', imageUrl: IMG.chickenTikkaS, preparationTime: 15, calories: 310,                            allergens: ['dairy'],           groups: ['mg-spice', 'mg-addons'], sortOrder: 3 },
    { id: 'item-prawn-cktl',    name: 'Prawn Cocktail',            price: 320, categoryId: cats['cat-starters'], description: 'Juicy tiger prawns tossed in zesty cocktail sauce on a bed of crisp lettuce.', imageUrl: IMG.prawnCocktail, preparationTime: 10, calories: 195,                            allergens: ['shellfish'],       groups: ['mg-addons'],            sortOrder: 4 },
    { id: 'item-onion-rings',   name: 'Crispy Onion Rings',        price: 120, categoryId: cats['cat-starters'], description: 'Beer-battered thick onion rings, fried to golden perfection. Served with dipping sauce.', imageUrl: IMG.onionRings,   preparationTime: 8,  calories: 250, dietaryTags: ['vegetarian'], allergens: ['gluten'],          groups: ['mg-addons'],            sortOrder: 5 },

    // ── MAIN COURSE ───────────────────────────────────────────────────────
    { id: 'item-beef-bhuna',    name: 'Beef Bhuna',                price: 420, categoryId: cats['cat-mains'], description: 'Rich slow-cooked beef in a thick aromatic sauce with caramelised onions and spices.', imageUrl: IMG.beefBhuna,    preparationTime: 25, calories: 480,                            allergens: [],                groups: ['mg-size', 'mg-spice', 'mg-addons', 'mg-style'], sortOrder: 1 },
    { id: 'item-mutton-curry',  name: 'Mutton Curry',              price: 480, categoryId: cats['cat-mains'], description: 'Bone-in mutton cooked slowly in a fragrant Bengali curry sauce.', imageUrl: IMG.muttonCurry,  preparationTime: 35, calories: 520,                            allergens: [],                groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 2 },
    { id: 'item-chkn-rogan',    name: 'Chicken Rogan Josh',        price: 350, categoryId: cats['cat-mains'], description: 'Kashmiri-style chicken curry with whole spices, bright red colour and deep flavours.', imageUrl: IMG.chickenRogan, preparationTime: 20, calories: 420,                            allergens: [],                groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 3 },
    { id: 'item-dal-makhani',   name: 'Dal Makhani',               price: 280, categoryId: cats['cat-mains'], description: 'Black lentils slow-cooked overnight with butter, cream and aromatic spices.', imageUrl: IMG.dalMakhani,   preparationTime: 15, calories: 350, dietaryTags: ['vegetarian'], allergens: ['dairy'],           groups: ['mg-size', 'mg-addons'],                         sortOrder: 4 },
    { id: 'item-fish-curry',    name: 'Bengali Fish Curry',        price: 380, categoryId: cats['cat-mains'], description: 'Fresh river fish cooked in a light mustard-turmeric gravy, Bangladeshi style.', imageUrl: IMG.fishCurry,    preparationTime: 20, calories: 390,                            allergens: ['fish'],            groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 5 },

    // ── BIRYANI & RICE ────────────────────────────────────────────────────
    { id: 'item-chkn-biryani',  name: 'Chicken Biryani',           price: 380, categoryId: cats['cat-biryani'], description: 'Aromatic long-grain basmati rice layered with tender chicken, saffron and crispy onions.', imageUrl: IMG.chickenBiryani, preparationTime: 30, calories: 620,                            allergens: ['dairy'],           groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 1 },
    { id: 'item-mutton-biryani',name: 'Mutton Biryani',            price: 480, categoryId: cats['cat-biryani'], description: 'Royal dum biryani with succulent mutton pieces, whole spices, rose water and kewra.', imageUrl: IMG.muttonBiryani, preparationTime: 40, calories: 720,                            allergens: ['dairy'],           groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 2 },
    { id: 'item-beef-biryani',  name: 'Beef Kacchi Biryani',       price: 420, categoryId: cats['cat-biryani'], description: 'Traditional kacchi style biryani — raw marinated beef layered with rice and slow cooked.', imageUrl: IMG.beefBiryani,  preparationTime: 45, calories: 680,                            allergens: ['dairy'],           groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 3 },
    { id: 'item-veg-fried-rice',name: 'Vegetable Fried Rice',      price: 220, categoryId: cats['cat-biryani'], description: 'Wok-tossed fragrant rice with seasonal vegetables, eggs and soy glaze.', imageUrl: IMG.vegFriedRice, preparationTime: 15, calories: 420, dietaryTags: ['vegetarian'], allergens: ['eggs', 'soy'],     groups: ['mg-size', 'mg-addons'],                         sortOrder: 4 },
    { id: 'item-plain-rice',    name: 'Steamed Basmati Rice',      price: 90,  categoryId: cats['cat-biryani'], description: 'Fluffy long-grain basmati rice, steamed to perfection.', imageUrl: IMG.plainRice,    preparationTime: 10, calories: 320, dietaryTags: ['vegetarian', 'vegan'], allergens: [], groups: ['mg-size'],                                       sortOrder: 5 },

    // ── GRILLS & BBQ ──────────────────────────────────────────────────────
    { id: 'item-mixed-grill',   name: 'Mixed Grill Platter',       price: 680, categoryId: cats['cat-grill'], description: 'Feast platter: chicken tikka, seekh kebab, boti kebab, shish tawook with mint chutney & naan.', imageUrl: IMG.mixedGrill,  preparationTime: 25, calories: 850,                            allergens: [],                groups: ['mg-spice', 'mg-style', 'mg-addons'],            sortOrder: 1 },
    { id: 'item-seekh-kebab',   name: 'Seekh Kebab (4 pcs)',       price: 320, categoryId: cats['cat-grill'], description: 'Minced lamb skewers seasoned with fresh herbs and spices, grilled over charcoal.', imageUrl: IMG.seekhKebab,  preparationTime: 20, calories: 380,                            allergens: [],                groups: ['mg-spice', 'mg-addons'],                        sortOrder: 2 },
    { id: 'item-tandoori-chkn', name: 'Tandoori Chicken (Half)',   price: 450, categoryId: cats['cat-grill'], description: 'Half chicken marinated 24h in yogurt, ginger, garlic and tandoori spices. Char-grilled.', imageUrl: IMG.tandooriChkn, preparationTime: 25, calories: 520,                            allergens: ['dairy'],           groups: ['mg-spice', 'mg-addons'],                        sortOrder: 3 },
    { id: 'item-shish-tawook',  name: 'Shish Tawook',             price: 380, categoryId: cats['cat-grill'], description: 'Lebanese-style skewered chicken marinated in garlic, lemon and mild spices.', imageUrl: IMG.shishTawook, preparationTime: 20, calories: 400,                            allergens: ['dairy'],           groups: ['mg-spice', 'mg-addons'],                        sortOrder: 4 },
    { id: 'item-bbq-ribs',      name: 'BBQ Beef Ribs',             price: 780, categoryId: cats['cat-grill'], description: 'Slow-smoked beef ribs glazed with our house BBQ sauce. Fall-off-the-bone tender.', imageUrl: IMG.bbqRibs,    preparationTime: 35, calories: 920,                            allergens: [],                groups: ['mg-spice', 'mg-style', 'mg-addons'],            sortOrder: 5 },

    // ── BREAD & ROTI ──────────────────────────────────────────────────────
    { id: 'item-naan',          name: 'Butter Naan',               price: 60,  categoryId: cats['cat-bread'], description: 'Soft leavened bread baked in clay oven, brushed with butter.', imageUrl: IMG.naan,        preparationTime: 5,  calories: 180, dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'],  groups: ['mg-addons'],                                    sortOrder: 1 },
    { id: 'item-garlic-naan',   name: 'Garlic Naan',              price: 80,  categoryId: cats['cat-bread'], description: 'Naan bread loaded with roasted garlic, butter and fresh coriander.', imageUrl: IMG.garlicNaan, preparationTime: 5,  calories: 210, dietaryTags: ['vegetarian'], allergens: ['gluten', 'dairy'],  groups: ['mg-addons'],                                    sortOrder: 2 },
    { id: 'item-paratha',       name: 'Layered Paratha',           price: 50,  categoryId: cats['cat-bread'], description: 'Whole wheat flatbread with flaky layers, cooked on a griddle.', imageUrl: IMG.paratha,    preparationTime: 5,  calories: 200, dietaryTags: ['vegetarian'], allergens: ['gluten'],          groups: ['mg-addons'],                                    sortOrder: 3 },
    { id: 'item-puri',          name: 'Puri (2 pcs)',             price: 60,  categoryId: cats['cat-bread'], description: 'Deep-fried puffed whole wheat bread — crispy outside, airy inside.', imageUrl: IMG.puri,       preparationTime: 5,  calories: 220, dietaryTags: ['vegetarian'], allergens: ['gluten'],          groups: ['mg-addons'],                                    sortOrder: 4 },
    { id: 'item-chapati',       name: 'Chapati (2 pcs)',          price: 40,  categoryId: cats['cat-bread'], description: 'Thin unleavened whole wheat flatbread, classic accompaniment to curries.', imageUrl: IMG.chapati,    preparationTime: 5,  calories: 140, dietaryTags: ['vegan'],      allergens: ['gluten'],          groups: ['mg-addons'],                                    sortOrder: 5 },

    // ── SEAFOOD ───────────────────────────────────────────────────────────
    { id: 'item-fish-chips',    name: 'Fish & Chips',              price: 350, categoryId: cats['cat-seafood'], description: 'Beer-battered snapper fillet with thick-cut fries, mushy peas and tartare sauce.', imageUrl: IMG.fishChips,   preparationTime: 15, calories: 650,                            allergens: ['fish', 'gluten'],  groups: ['mg-addons'],                                    sortOrder: 1 },
    { id: 'item-prawn-masala',  name: 'King Prawn Masala',         price: 480, categoryId: cats['cat-seafood'], description: 'Jumbo tiger prawns in a thick tomato-onion masala with coastal spices.', imageUrl: IMG.prawnMasala, preparationTime: 20, calories: 380,                            allergens: ['shellfish'],       groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 2 },
    { id: 'item-hilsa',         name: 'Hilsa (Ilish) Curry',       price: 550, categoryId: cats['cat-seafood'], description: 'The pride of Bangladesh — Hilsa fish cooked in fragrant mustard and turmeric gravy.', imageUrl: IMG.hilsa,       preparationTime: 20, calories: 420,                            allergens: ['fish'],            groups: ['mg-spice', 'mg-addons'],                        sortOrder: 3 },
    { id: 'item-crab-curry',    name: 'Crab Curry',                price: 620, categoryId: cats['cat-seafood'], description: 'Whole mud crab slow-cooked in coconut milk, tomatoes and Bengali spice blend.', imageUrl: IMG.crabCurry,   preparationTime: 30, calories: 340,                            allergens: ['shellfish'],       groups: ['mg-spice', 'mg-addons'],                        sortOrder: 4 },
    { id: 'item-grilled-fish',  name: 'Grilled Fish Fillet',       price: 420, categoryId: cats['cat-seafood'], description: 'Fresh sea bass fillet marinated in lemon-herb butter, grilled to perfection.', imageUrl: IMG.grilledFish, preparationTime: 20, calories: 310,                            allergens: ['fish'],            groups: ['mg-spice', 'mg-style', 'mg-addons'],            sortOrder: 5 },

    // ── VEGETARIAN ────────────────────────────────────────────────────────
    { id: 'item-paneer-butter', name: 'Paneer Butter Masala',      price: 320, categoryId: cats['cat-veg'], description: 'Soft cottage cheese cubes in a rich, creamy tomato sauce with butter and kasuri methi.', imageUrl: IMG.paneerButter, preparationTime: 15, calories: 480, dietaryTags: ['vegetarian'], allergens: ['dairy'],           groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 1 },
    { id: 'item-chana-masala',  name: 'Chana Masala',              price: 240, categoryId: cats['cat-veg'], description: 'Hearty chickpea curry simmered in tangy tomato-onion base with Punjabi spices.', imageUrl: IMG.chanaMasala, preparationTime: 15, calories: 380, dietaryTags: ['vegetarian', 'vegan'], allergens: [],  groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 2 },
    { id: 'item-aloo-gobi',     name: 'Aloo Gobi',                 price: 220, categoryId: cats['cat-veg'], description: 'Potatoes and cauliflower stir-fried with cumin, turmeric and fresh coriander.', imageUrl: IMG.alooGobi,   preparationTime: 15, calories: 290, dietaryTags: ['vegetarian', 'vegan'], allergens: [],  groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 3 },
    { id: 'item-mixed-veg',     name: 'Mixed Vegetable Curry',     price: 200, categoryId: cats['cat-veg'], description: 'Seasonal vegetables cooked in a mildly spiced tomato-based sauce.', imageUrl: IMG.mixedVeg,   preparationTime: 15, calories: 260, dietaryTags: ['vegetarian', 'vegan'], allergens: [],  groups: ['mg-size', 'mg-spice', 'mg-addons'],             sortOrder: 4 },
    { id: 'item-lentil-soup',   name: 'Masoor Dal Soup',           price: 160, categoryId: cats['cat-veg'], description: 'Silky red lentil soup with tempered cumin, garlic and fresh lemon. Comforting and nutritious.', imageUrl: IMG.lentilSoup, preparationTime: 15, calories: 210, dietaryTags: ['vegetarian', 'vegan'], allergens: [],  groups: ['mg-spice'],                                     sortOrder: 5 },

    // ── BURGERS & SANDWICHES ──────────────────────────────────────────────
    { id: 'item-beef-burger',   name: 'Classic Beef Burger',       price: 380, categoryId: cats['cat-burgers'], description: 'Juicy 180g beef patty with lettuce, tomato, pickles and our secret burger sauce in a brioche bun.', imageUrl: IMG.beefBurger,   preparationTime: 12, calories: 680,                            allergens: ['gluten', 'eggs'],  groups: ['mg-toppings', 'mg-addons'],                     sortOrder: 1 },
    { id: 'item-chkn-burger',   name: 'Crispy Chicken Burger',     price: 320, categoryId: cats['cat-burgers'], description: 'Crispy fried chicken thigh with coleslaw, pickled jalapeños and honey-mustard mayo.', imageUrl: IMG.chickenBurger, preparationTime: 12, calories: 620,                            allergens: ['gluten'],          groups: ['mg-toppings', 'mg-addons'],                     sortOrder: 2 },
    { id: 'item-club-sandwich', name: 'Club Sandwich',             price: 280, categoryId: cats['cat-burgers'], description: 'Triple-decker with chicken, bacon strips, fried egg, fresh vegetables and mustard.', imageUrl: IMG.clubSandwich, preparationTime: 10, calories: 560,                            allergens: ['gluten', 'eggs'],  groups: ['mg-toppings', 'mg-addons'],                     sortOrder: 3 },
    { id: 'item-cheese-burger', name: 'Double Cheeseburger',       price: 420, categoryId: cats['cat-burgers'], description: 'Two smash beef patties stacked with double cheese, caramelised onion and chipotle sauce.', imageUrl: IMG.cheeseBurger, preparationTime: 12, calories: 820,                            allergens: ['gluten', 'dairy'], groups: ['mg-toppings', 'mg-addons'],                     sortOrder: 4 },
    { id: 'item-fish-burger',   name: 'Fish Fillet Burger',        price: 300, categoryId: cats['cat-burgers'], description: 'Panko-crusted fish fillet with tartar sauce, shredded cabbage and lemon zest.', imageUrl: IMG.fishBurger,   preparationTime: 12, calories: 540,                            allergens: ['fish', 'gluten'],  groups: ['mg-toppings', 'mg-addons'],                     sortOrder: 5 },

    // ── DESSERTS ──────────────────────────────────────────────────────────
    { id: 'item-gulab-jamun',   name: 'Gulab Jamun (3 pcs)',       price: 160, categoryId: cats['cat-desserts'], description: 'Soft milk-solid dumplings soaked in rose-cardamom sugar syrup. Served warm.', imageUrl: IMG.gulabJamun, preparationTime: 5,  calories: 380, dietaryTags: ['vegetarian'], allergens: ['dairy', 'gluten'], groups: ['mg-temp'],                                     sortOrder: 1 },
    { id: 'item-rasmalai',      name: 'Rasmalai (2 pcs)',          price: 180, categoryId: cats['cat-desserts'], description: 'Soft chenna patties soaked in thickened saffron-pistachio milk. Bengali specialty.', imageUrl: IMG.rasmalai,  preparationTime: 5,  calories: 350, dietaryTags: ['vegetarian'], allergens: ['dairy'],          groups: ['mg-temp'],                                     sortOrder: 2 },
    { id: 'item-firni',         name: 'Firni',                     price: 140, categoryId: cats['cat-desserts'], description: 'Creamy rice flour pudding with rose water, pistachios and cardamom. Served chilled.', imageUrl: IMG.firni,     preparationTime: 5,  calories: 290, dietaryTags: ['vegetarian'], allergens: ['dairy'],          groups: ['mg-temp'],                                     sortOrder: 3 },
    { id: 'item-ice-cream',     name: 'Ice Cream (3 scoops)',      price: 220, categoryId: cats['cat-desserts'], description: 'Premium ice cream. Choose from vanilla, chocolate, mango or pistachio.', imageUrl: IMG.iceCream,  preparationTime: 3,  calories: 420, dietaryTags: ['vegetarian'], allergens: ['dairy', 'eggs'],   groups: [],                                              sortOrder: 4 },
    { id: 'item-faluda',        name: 'Rose Faluda',               price: 200, categoryId: cats['cat-desserts'], description: 'Chilled rose-flavoured dessert drink with basil seeds, vermicelli, ice cream and nuts.', imageUrl: IMG.faluda,    preparationTime: 5,  calories: 480, dietaryTags: ['vegetarian'], allergens: ['dairy', 'gluten'], groups: ['mg-temp'],                                     sortOrder: 5 },

    // ── DRINKS & BEVERAGES ────────────────────────────────────────────────
    { id: 'item-borhani',       name: 'Borhani',                   price: 80,  categoryId: cats['cat-drinks'], description: 'Traditional Bangladeshi savoury yogurt drink with black salt, mint and spices.', imageUrl: IMG.borhani,   preparationTime: 3,  calories: 90,  dietaryTags: ['vegetarian'], allergens: ['dairy'],          groups: ['mg-drink-size', 'mg-ice'],                     sortOrder: 1 },
    { id: 'item-mango-lassi',   name: 'Mango Lassi',               price: 120, categoryId: cats['cat-drinks'], description: 'Rich yogurt blended with Alphonso mango pulp, touch of cardamom and honey.', imageUrl: IMG.mangoLassi, preparationTime: 3,  calories: 240, dietaryTags: ['vegetarian'], allergens: ['dairy'],          groups: ['mg-drink-size', 'mg-ice'],                     sortOrder: 2 },
    { id: 'item-water',         name: 'Mineral Water (500ml)',     price: 40,  categoryId: cats['cat-drinks'], description: 'Chilled premium mineral water.', imageUrl: IMG.water,      preparationTime: 1,  calories: 0,   dietaryTags: ['vegan'],      allergens: [],                groups: [],                                              sortOrder: 3 },
    { id: 'item-soft-drink',    name: 'Soft Drink (Can)',          price: 60,  categoryId: cats['cat-drinks'], description: 'Pepsi, 7Up, Mirinda, or Mountain Dew — your choice.', imageUrl: IMG.softDrink, preparationTime: 1,  calories: 140, dietaryTags: ['vegan'],      allergens: [],                groups: ['mg-ice'],                                      sortOrder: 4 },
    { id: 'item-lime-soda',     name: 'Fresh Lime Soda',           price: 90,  categoryId: cats['cat-drinks'], description: 'Freshly squeezed lime juice topped with sparkling water. Sweet or salted.', imageUrl: IMG.limeSoda,  preparationTime: 3,  calories: 50,  dietaryTags: ['vegan'],      allergens: [],                groups: ['mg-drink-size', 'mg-ice'],                     sortOrder: 5 },
  ];

  // ─── Upsert all items ─────────────────────────────────────────────────────
  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        preparationTime: item.preparationTime,
        calories: item.calories,
        dietaryTags: item.dietaryTags ?? [],
        allergens: item.allergens ?? [],
        sortOrder: item.sortOrder,
      },
      create: {
        id: item.id,
        tenantId,
        restaurantId,
        categoryId: item.categoryId,
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        preparationTime: item.preparationTime,
        calories: item.calories,
        dietaryTags: item.dietaryTags ?? [],
        allergens: item.allergens ?? [],
        isAvailable: true,
        sortOrder: item.sortOrder,
      },
    });
  }
  console.log(`✅ ${items.length} items created\n`);

  // ─── Attach modifier groups to items ─────────────────────────────────────
  // Map group shorthand to actual IDs
  const groupIdMap: Record<string, string> = {
    'mg-size':       mgSize.id,
    'mg-spice':      mgSpice.id,
    'mg-addons':     mgAddons.id,
    'mg-style':      mgStyle.id,
    'mg-drink-size': mgDrinkSize.id,
    'mg-ice':        mgIce.id,
    'mg-toppings':   mgToppings.id,
    'mg-temp':       mgTemp.id,
  };

  let attachCount = 0;
  for (const item of items) {
    for (let i = 0; i < (item.groups ?? []).length; i++) {
      const groupId = groupIdMap[item.groups![i]];
      if (!groupId) continue;
      await prisma.itemModifierGroup.upsert({
        where: { itemId_modifierGroupId: { itemId: item.id, modifierGroupId: groupId } },
        update: { sortOrder: i },
        create: { itemId: item.id, modifierGroupId: groupId, sortOrder: i },
      });
      attachCount++;
    }
  }
  console.log(`✅ ${attachCount} modifier group attachments created\n`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  const [itemCount, catCount, mgCount] = await Promise.all([
    prisma.item.count({ where: { restaurantId } }),
    prisma.category.count({ where: { restaurantId } }),
    prisma.modifierGroup.count({ where: { restaurantId } }),
  ]);

  console.log('🎉 Menu seed complete!');
  console.log(`   Categories  : ${catCount}`);
  console.log(`   Menu Items  : ${itemCount}`);
  console.log(`   Modifier Groups (incl. nested) : ${mgCount}`);
  console.log(`\n   Login: owner@spicegarden.bd / Admin@SpiceGarden2026`);
}

main()
  .catch((e) => {
    console.error('❌ Menu seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
