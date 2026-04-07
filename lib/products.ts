export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  description: string;
  details: string;
  inStock: boolean;
  stock: number;
  tags: string[];
  isNew?: boolean;
  isSale?: boolean;
  isBestSeller?: boolean;
  onOffer?: boolean;
  offerBadge?: string;
  offerDescription?: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  badge_text: string;
  discount_text?: string;
  product_id?: string;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  sort_order: number;
  created_at: string;
}

export const CIRCLE_CATEGORIES = [
  { label: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=240&q=80&fit=crop', href: '/shop?category=Fruits+%26+Vegetables' },
  { label: 'Dairy & Eggs',       image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=240&q=80&fit=crop', href: '/shop?category=Dairy+%26+Eggs' },
  { label: 'Meat & Seafood',     image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=240&q=80&fit=crop', href: '/shop?category=Meat+%26+Seafood' },
  { label: 'Bakery',             image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=240&q=80&fit=crop', href: '/shop?category=Bakery' },
  { label: 'Beverages',          image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=240&q=80&fit=crop', href: '/shop?category=Beverages' },
  { label: 'Pantry Staples',     image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=240&q=80&fit=crop', href: '/shop?category=Pantry+Staples' },
];

export const CATEGORY_LIST = ['All', 'Fruits & Vegetables', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Beverages', 'Pantry Staples', 'Snacks', 'Frozen Foods', 'Household'];

export const products: Product[] = [
  // ─── Fruits & Vegetables ───
  {
    id: 'fresh-bananas',
    name: 'Fresh Bananas (1kg)',
    price: 120,
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Perfectly ripe bananas sourced from local farms. Rich in potassium and great for smoothies, baking, or snacking.',
    details: 'Weight: 1kg (approx 6-8 bananas). Origin: Local farms. Store at room temperature.',
    inStock: true, stock: 50,
    tags: ['Fresh', 'Organic', 'Popular'],
    isBestSeller: true,
  },
  {
    id: 'red-tomatoes',
    name: 'Red Tomatoes (1kg)',
    price: 80, originalPrice: 100,
    image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Juicy, vine-ripened red tomatoes. Perfect for salads, sauces, and cooking.',
    details: 'Weight: 1kg. Origin: Local. Store in a cool, dry place. Best consumed within 5 days.',
    inStock: true, stock: 40,
    tags: ['Fresh', 'Daily Supply'],
    isSale: true,
  },
  {
    id: 'fresh-avocados',
    name: 'Fresh Avocados (4-Pack)',
    price: 200,
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Creamy Hass avocados, perfect for guacamole, salads, or spreading on toast.',
    details: 'Pack of 4. Origin: Kenya highlands. Ripen at room temperature.',
    inStock: true, stock: 30,
    tags: ['Fresh', 'Healthy'],
    isNew: true, isBestSeller: true,
  },
  {
    id: 'green-spinach',
    name: 'Fresh Spinach Bunch',
    price: 50,
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Fresh, crisp spinach leaves packed with iron and vitamins. Great for salads and cooking.',
    details: 'Weight: ~300g bunch. Wash before use. Store refrigerated.',
    inStock: true, stock: 25,
    tags: ['Fresh', 'Leafy Greens'],
  },
  {
    id: 'fresh-oranges',
    name: 'Navel Oranges (1kg)',
    price: 150, originalPrice: 180,
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Sweet and juicy navel oranges. Rich in Vitamin C. Perfect for juicing or snacking.',
    details: 'Weight: 1kg (approx 4-5 oranges). Store at room temperature or refrigerate.',
    inStock: true, stock: 35,
    tags: ['Fresh', 'Citrus'],
    isSale: true,
  },
  {
    id: 'fresh-potatoes',
    name: 'Irish Potatoes (2kg)',
    price: 180,
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82ber7a0?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Versatile Irish potatoes ideal for mashing, roasting, frying, or boiling.',
    details: 'Weight: 2kg. Origin: Kenya highlands. Store in a cool, dark place.',
    inStock: true, stock: 60,
    tags: ['Staple', 'Popular'],
    isBestSeller: true,
  },
  {
    id: 'fresh-onions',
    name: 'Red Onions (1kg)',
    price: 100,
    image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Aromatic red onions. Essential for everyday cooking and salads.',
    details: 'Weight: 1kg. Store in a cool, dry place.',
    inStock: true, stock: 45,
    tags: ['Staple', 'Daily'],
  },
  {
    id: 'fresh-carrots',
    name: 'Fresh Carrots (500g)',
    price: 60,
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80&fit=crop',
    category: 'Fruits & Vegetables',
    description: 'Crunchy, sweet carrots. Perfect for salads, soups, juicing, and snacking.',
    details: 'Weight: 500g. Store refrigerated. Shelf life: 7-10 days.',
    inStock: true, stock: 40,
    tags: ['Fresh', 'Healthy'],
  },
  // ─── Dairy & Eggs ───
  {
    id: 'whole-milk',
    name: 'Fresh Whole Milk (1L)',
    price: 70,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80&fit=crop',
    category: 'Dairy & Eggs',
    description: 'Farm-fresh whole milk, pasteurized for safety. Rich, creamy taste for drinking, cooking, and baking.',
    details: 'Volume: 1 litre. Keep refrigerated. Best before date on pack.',
    inStock: true, stock: 80,
    tags: ['Fresh', 'Daily'],
    isBestSeller: true,
  },
  {
    id: 'farm-eggs',
    name: 'Farm Fresh Eggs (Tray of 30)',
    price: 450, originalPrice: 500,
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&q=80&fit=crop',
    category: 'Dairy & Eggs',
    description: 'Farm-fresh eggs from free-range hens. Perfect for breakfast, baking, and cooking.',
    details: 'Tray of 30 eggs. Store refrigerated. Origin: Local farms.',
    inStock: true, stock: 20,
    tags: ['Farm Fresh', 'Popular'],
    isSale: true, isBestSeller: true,
  },
  {
    id: 'natural-yoghurt',
    name: 'Natural Yoghurt (500ml)',
    price: 120,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80&fit=crop',
    category: 'Dairy & Eggs',
    description: 'Thick, creamy natural yoghurt. Great with fruits, granola, or for cooking.',
    details: 'Volume: 500ml. Keep refrigerated. No artificial preservatives.',
    inStock: true, stock: 30,
    tags: ['Healthy', 'Probiotic'],
  },
  {
    id: 'cheddar-cheese',
    name: 'Cheddar Cheese (250g)',
    price: 350,
    image: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=600&q=80&fit=crop',
    category: 'Dairy & Eggs',
    description: 'Premium aged cheddar cheese. Rich, sharp flavour for sandwiches, cooking, and snacking.',
    details: 'Weight: 250g. Keep refrigerated. Shelf life: see packaging.',
    inStock: true, stock: 15,
    tags: ['Premium', 'Imported'],
    isNew: true,
  },
  {
    id: 'fresh-butter',
    name: 'Salted Butter (500g)',
    price: 280, originalPrice: 320,
    image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&q=80&fit=crop',
    category: 'Dairy & Eggs',
    description: 'Rich, creamy salted butter for spreading, cooking, and baking.',
    details: 'Weight: 500g. Keep refrigerated.',
    inStock: true, stock: 25,
    tags: ['Essential', 'Cooking'],
    isSale: true,
  },
  // ─── Meat & Seafood ───
  {
    id: 'chicken-breast',
    name: 'Chicken Breast (1kg)',
    price: 550,
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80&fit=crop',
    category: 'Meat & Seafood',
    description: 'Lean, boneless chicken breast. Versatile protein for grilling, stir-frying, and baking.',
    details: 'Weight: 1kg. Keep frozen or refrigerated. Cook thoroughly before eating.',
    inStock: true, stock: 20,
    tags: ['Protein', 'Lean'],
    isBestSeller: true,
  },
  {
    id: 'beef-mince',
    name: 'Beef Mince (500g)',
    price: 400, originalPrice: 450,
    image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80&fit=crop',
    category: 'Meat & Seafood',
    description: 'Premium lean beef mince. Perfect for burgers, meatballs, bolognese, and more.',
    details: 'Weight: 500g. Keep frozen. Thaw before cooking. Use within 24hrs of thawing.',
    inStock: true, stock: 15,
    tags: ['Premium', 'Protein'],
    isSale: true,
  },
  {
    id: 'tilapia-fish',
    name: 'Fresh Tilapia (whole, 500g)',
    price: 350,
    image: 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600&q=80&fit=crop',
    category: 'Meat & Seafood',
    description: 'Fresh Lake Victoria tilapia. A Kenyan favourite — grill, fry, or make fish stew.',
    details: 'Weight: ~500g per fish. Keep refrigerated. Best consumed within 2 days.',
    inStock: true, stock: 10,
    tags: ['Fresh', 'Local'],
    isNew: true,
  },
  // ─── Bakery ───
  {
    id: 'white-bread',
    name: 'White Bread Loaf',
    price: 65,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    category: 'Bakery',
    description: 'Soft, fluffy white bread loaf. Perfect for sandwiches, toast, or just enjoying warm with butter.',
    details: 'Weight: 400g. Shelf life: 3 days at room temperature.',
    inStock: true, stock: 50,
    tags: ['Fresh', 'Daily Bake', 'Popular'],
    isBestSeller: true,
  },
  {
    id: 'brown-bread',
    name: 'Brown Bread Loaf',
    price: 70,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    category: 'Bakery',
    description: 'Wholesome brown bread with a rich, nutty flavour. High in fibre.',
    details: 'Weight: 400g. Shelf life: 3 days.',
    inStock: true, stock: 40,
    tags: ['Healthy', 'Daily Bake'],
  },
  // ─── Beverages ───
  {
    id: 'orange-juice',
    name: 'Fresh Orange Juice (1L)',
    price: 180,
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&q=80&fit=crop',
    category: 'Beverages',
    description: '100% freshly squeezed orange juice. No added sugar, no preservatives.',
    details: 'Volume: 1L. Keep refrigerated. Consume within 3 days of opening.',
    inStock: true, stock: 25,
    tags: ['Fresh', 'Natural'],
    isNew: true,
  },
  {
    id: 'mineral-water',
    name: 'Mineral Water (6-Pack, 1.5L)',
    price: 350,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=80&fit=crop',
    category: 'Beverages',
    description: 'Pure natural mineral water. Stay hydrated with this essential daily staple.',
    details: '6 x 1.5L bottles. Store in a cool, dry place.',
    inStock: true, stock: 60,
    tags: ['Essential', 'Hydration'],
    isBestSeller: true,
  },
  {
    id: 'kenyan-tea',
    name: 'Premium Kenyan Tea (250g)',
    price: 200, originalPrice: 250,
    image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&q=80&fit=crop',
    category: 'Beverages',
    description: 'Premium loose-leaf Kenyan black tea. Rich, aromatic, and full-bodied.',
    details: 'Weight: 250g. Origin: Kenya Highlands. Store in a cool, dry place.',
    inStock: true, stock: 35,
    tags: ['Premium', 'Local'],
    isSale: true,
  },
  // ─── Pantry Staples ───
  {
    id: 'basmati-rice',
    name: 'Basmati Rice (2kg)',
    price: 350, originalPrice: 400,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80&fit=crop',
    category: 'Pantry Staples',
    description: 'Premium long-grain basmati rice. Light, fluffy, and aromatic when cooked.',
    details: 'Weight: 2kg. Store in a cool, dry place. Shelf life: 12 months.',
    inStock: true, stock: 40,
    tags: ['Staple', 'Premium'],
    isSale: true, isBestSeller: true,
  },
  {
    id: 'cooking-oil',
    name: 'Vegetable Cooking Oil (2L)',
    price: 450,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacdc50f73?w=600&q=80&fit=crop',
    category: 'Pantry Staples',
    description: 'Pure vegetable cooking oil for frying, sauteing, and baking.',
    details: 'Volume: 2L. Store in a cool, dry place.',
    inStock: true, stock: 35,
    tags: ['Essential', 'Cooking'],
    isBestSeller: true,
  },
  {
    id: 'wheat-flour',
    name: 'All-Purpose Wheat Flour (2kg)',
    price: 180,
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80&fit=crop',
    category: 'Pantry Staples',
    description: 'Fine all-purpose wheat flour for baking, chapati, and everyday cooking.',
    details: 'Weight: 2kg. Store in a cool, dry, airtight container.',
    inStock: true, stock: 50,
    tags: ['Staple', 'Baking'],
  },
  {
    id: 'sugar',
    name: 'White Sugar (1kg)',
    price: 140,
    image: 'https://images.unsplash.com/photo-1581268246708-09ac40159855?w=600&q=80&fit=crop',
    category: 'Pantry Staples',
    description: 'Refined white sugar for tea, baking, and cooking.',
    details: 'Weight: 1kg. Store in a cool, dry place.',
    inStock: true, stock: 70,
    tags: ['Essential', 'Staple'],
  },
  {
    id: 'tomato-sauce',
    name: 'Tomato Sauce (500g)',
    price: 120, originalPrice: 150,
    image: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=600&q=80&fit=crop',
    category: 'Pantry Staples',
    description: 'Rich tomato sauce made from vine-ripened tomatoes. Great for pasta, pizza, and stews.',
    details: 'Weight: 500g. Store in a cool, dry place. Refrigerate after opening.',
    inStock: true, stock: 30,
    tags: ['Cooking', 'Sauce'],
    isSale: true,
  },
  // ─── Snacks ───
  {
    id: 'potato-crisps',
    name: 'Potato Crisps (200g)',
    price: 150,
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80&fit=crop',
    category: 'Snacks',
    description: 'Crunchy potato crisps in assorted flavours. Perfect for snacking.',
    details: 'Weight: 200g. Flavours: Salt & Vinegar, BBQ, Cheese & Onion.',
    inStock: true, stock: 40,
    tags: ['Snack', 'Popular'],
  },
  {
    id: 'mixed-nuts',
    name: 'Mixed Nuts (250g)',
    price: 350,
    image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&q=80&fit=crop',
    category: 'Snacks',
    description: 'Premium roasted mixed nuts including cashews, almonds, and peanuts.',
    details: 'Weight: 250g. Contains tree nuts. Store in a cool, dry place.',
    inStock: true, stock: 20,
    tags: ['Healthy', 'Premium'],
    isNew: true,
  },
  // ─── Frozen Foods ───
  {
    id: 'frozen-peas',
    name: 'Frozen Green Peas (500g)',
    price: 120,
    image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&q=80&fit=crop',
    category: 'Frozen Foods',
    description: 'Flash-frozen green peas to lock in nutrition and freshness.',
    details: 'Weight: 500g. Keep frozen at -18°C. Cook from frozen.',
    inStock: true, stock: 25,
    tags: ['Frozen', 'Healthy'],
  },
  {
    id: 'ice-cream',
    name: 'Vanilla Ice Cream (1L)',
    price: 450, originalPrice: 500,
    image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80&fit=crop',
    category: 'Frozen Foods',
    description: 'Creamy vanilla ice cream made with real vanilla beans. A family favourite.',
    details: 'Volume: 1L. Keep frozen. Flavours available: Vanilla, Chocolate, Strawberry.',
    inStock: true, stock: 15,
    tags: ['Treat', 'Family'],
    isSale: true,
  },
  // ─── Household ───
  {
    id: 'dish-soap',
    name: 'Liquid Dish Soap (750ml)',
    price: 180,
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&q=80&fit=crop',
    category: 'Household',
    description: 'Powerful grease-cutting dish soap. Gentle on hands, tough on dishes.',
    details: 'Volume: 750ml. Biodegradable formula.',
    inStock: true, stock: 30,
    tags: ['Cleaning', 'Essential'],
  },
  {
    id: 'toilet-paper',
    name: 'Toilet Paper (12-Pack)',
    price: 650,
    image: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&q=80&fit=crop',
    category: 'Household',
    description: 'Soft, strong 2-ply toilet paper. A household essential.',
    details: 'Pack of 12 rolls. 2-ply.',
    inStock: true, stock: 40,
    tags: ['Essential', 'Household'],
    isBestSeller: true,
  },
];

export const getProduct = (id: string) => products.find(p => p.id === id);
export const getBestSellers = () => products.filter(p => p.isBestSeller);
export const getOnOffer = () => products.filter(p => p.isSale || p.onOffer);
export const getRelated = (product: Product, count = 4) =>
  products.filter(p => p.id !== product.id && p.category === product.category).slice(0, count);

// ─── Dynamic product loading from grocery inventory (food_info table) ───

/** Map a food_info database row to a Product for the website */
function mapFoodInfoToProduct(row: Record<string, unknown>): Product {
  const name = (row.product_name || '') as string;
  const stock = (row.current_stock || 0) as number;
  const category = mapProductCategory(name, (row.category || '') as string);
  const imageUrl = (row.image_url || '') as string;
  const price = (row.retail_price || row.selling_price || 0) as number;
  const costPrice = (row.cost_price || 0) as number;

  return {
    id: (row.id || '') as string,
    name,
    price: price > 0 ? price : 10,
    image: imageUrl || getCategoryFallbackImage(category),
    category,
    description: (row.description || `Fresh ${name} from our store`) as string,
    details: buildDetails(row),
    inStock: stock > 0,
    stock,
    tags: buildTags(row),
    isNew: false,
    isSale: costPrice > 0 && price > 0 && price < costPrice * 1.5,
    isBestSeller: stock > 10,
  };
}

function mapProductCategory(name: string, dbCategory: string): string {
  const lower = (name + ' ' + dbCategory).toLowerCase();
  if (lower.includes('fruit') || lower.includes('vegetable') || lower.includes('tomato') || lower.includes('onion') || lower.includes('potato') || lower.includes('carrot') || lower.includes('spinach') || lower.includes('avocado') || lower.includes('banana') || lower.includes('orange') || lower.includes('apple') || lower.includes('mango') || lower.includes('lettuce') || lower.includes('cabbage')) return 'Fruits & Vegetables';
  if (lower.includes('milk') || lower.includes('dairy') || lower.includes('egg') || lower.includes('yoghurt') || lower.includes('yogurt') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream')) return 'Dairy & Eggs';
  if (lower.includes('meat') || lower.includes('chicken') || lower.includes('beef') || lower.includes('fish') || lower.includes('pork') || lower.includes('lamb') || lower.includes('seafood') || lower.includes('tilapia') || lower.includes('sausage')) return 'Meat & Seafood';
  if (lower.includes('bread') || lower.includes('bakery') || lower.includes('cake') || lower.includes('pastry') || lower.includes('muffin') || lower.includes('croissant')) return 'Bakery';
  if (lower.includes('juice') || lower.includes('water') || lower.includes('tea') || lower.includes('coffee') || lower.includes('soda') || lower.includes('beverage') || lower.includes('drink')) return 'Beverages';
  if (lower.includes('rice') || lower.includes('flour') || lower.includes('sugar') || lower.includes('oil') || lower.includes('salt') || lower.includes('spice') || lower.includes('sauce') || lower.includes('pasta') || lower.includes('maize') || lower.includes('ugali')) return 'Pantry Staples';
  if (lower.includes('snack') || lower.includes('chips') || lower.includes('crisp') || lower.includes('biscuit') || lower.includes('cookie') || lower.includes('nut')) return 'Snacks';
  if (lower.includes('frozen') || lower.includes('ice cream')) return 'Frozen Foods';
  if (lower.includes('soap') || lower.includes('detergent') || lower.includes('tissue') || lower.includes('toilet') || lower.includes('clean')) return 'Household';
  if (dbCategory) return dbCategory;
  return 'Pantry Staples';
}

function getCategoryFallbackImage(category: string): string {
  const images: Record<string, string> = {
    'Fruits & Vegetables': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&q=80&fit=crop',
    'Dairy & Eggs': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600&q=80&fit=crop',
    'Meat & Seafood': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=80&fit=crop',
    'Bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    'Beverages': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80&fit=crop',
    'Pantry Staples': 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&q=80&fit=crop',
    'Snacks': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80&fit=crop',
    'Frozen Foods': 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&q=80&fit=crop',
    'Household': 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&q=80&fit=crop',
  };
  return images[category] || images['Pantry Staples'];
}

function buildDetails(row: Record<string, unknown>): string {
  const parts: string[] = [];
  if (row.shelf_life_days) parts.push(`Shelf life: ${row.shelf_life_days} days`);
  if (row.stock_unit) parts.push(`Unit: ${row.stock_unit}`);
  if (row.allergens && Array.isArray(row.allergens) && (row.allergens as string[]).length > 0) {
    parts.push(`Allergens: ${(row.allergens as string[]).join(', ')}`);
  }
  return parts.length > 0 ? parts.join('. ') + '.' : 'Freshly stocked in our store.';
}

function buildTags(row: Record<string, unknown>): string[] {
  const tags: string[] = ['Fresh'];
  if (row.allergens && Array.isArray(row.allergens)) {
    if (!(row.allergens as string[]).includes('Gluten')) tags.push('Gluten-Free');
  }
  const stock = (row.current_stock || 0) as number;
  if (stock > 20) tags.push('Popular');
  return tags;
}

/**
 * Fetch products dynamically from the grocery inventory (food_info table).
 * Returns mapped Product[] or null if the table doesn't exist / is empty.
 */
export async function fetchMainBakeryProducts(): Promise<Product[] | null> {
  try {
    const { createBrowserClient } = await import('@supabase/ssr');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnonKey) return null;
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('food_info')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    return data.map((row: Record<string, unknown>) => mapFoodInfoToProduct(row));
  } catch {
    return null;
  }
}
