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
  { label: 'Breads',    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=240&q=80&fit=crop', href: '/shop?category=Bread' },
  { label: 'Pastries',  image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=240&q=80&fit=crop', href: '/shop?category=Pastry' },
  { label: 'Cakes',     image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=240&q=80&fit=crop', href: '/shop?category=Cake' },
  { label: 'Cookies',   image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=240&q=80&fit=crop', href: '/shop?category=Cookies' },
  { label: 'Donuts',    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=240&q=80&fit=crop', href: '/shop?category=Donuts' },
  { label: 'Specials',  image: 'https://images.unsplash.com/photo-1464500701-54b8b28ede7f?w=240&q=80&fit=crop', href: '/shop' },
];

export const CATEGORY_LIST = ['All', 'Bread', 'Pastry', 'Cake', 'Cookies', 'Donuts'];

// ─── STOCK MODE: All products at KES 10, stock 1-2, all in stock ───
// Dynamic stock data - each product has stock of 1 or 2 units
export const products: Product[] = [
  {
    id: 'white-bread',
    name: 'White Bread Loaf',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    category: 'Bread',
    description: 'Soft, fluffy white bread loaf baked fresh every morning. Perfect for sandwiches, toast, or just enjoying warm with butter.',
    details: 'Ingredients: Wheat flour, water, yeast, salt, sugar. Weight: 800g. Shelf life: 3 days at room temperature.',
    inStock: true, stock: 2,
    tags: ['Fresh', 'Daily Bake', 'Popular'],
    isSale: true, isBestSeller: true,
  },
  {
    id: 'sourdough-loaf',
    name: 'Artisan Sourdough Loaf',
    price: 10,
    image: 'https://images.unsplash.com/photo-1586444248879-6b4d8e2ef9a3?w=600&q=80&fit=crop',
    category: 'Bread',
    description: 'Traditional sourdough with a crispy crust and chewy interior. Made with our long-fermented starter for authentic depth of flavour.',
    details: 'Ingredients: Wheat flour, water, sourdough starter, sea salt. Weight: 900g. Shelf life: 4 days.',
    inStock: true, stock: 1,
    tags: ['Artisan', 'Sourdough'],
    isNew: true,
  },
  {
    id: 'butter-croissant',
    name: 'Butter Croissant',
    price: 10,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop',
    category: 'Pastry',
    description: 'Flaky, buttery French-style croissant. Layers of golden perfection — crispy outside, pillowy inside.',
    details: 'Weight: 100g each. Made with 100% butter. Shelf life: 1 day. Best served warm.',
    inStock: true, stock: 2,
    tags: ['French', 'Buttery', 'Breakfast'],
    isBestSeller: true,
  },
  {
    id: 'cinnamon-roll',
    name: 'Cinnamon Swirl Roll',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1509365390695-33aee754301f?w=600&q=80&fit=crop',
    category: 'Pastry',
    description: 'Warm, fluffy cinnamon roll with vanilla cream cheese icing. Made fresh every morning — best enjoyed warm.',
    details: 'Weight: 150g. Shelf life: 1 day. Contains: flour, butter, cinnamon, cream cheese.',
    inStock: true, stock: 1,
    tags: ['Sweet', 'Cinnamon'],
    isSale: true,
  },
  {
    id: 'classic-donut',
    name: 'Classic Glazed Donut',
    price: 10,
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop',
    category: 'Donuts',
    description: 'Light, airy donut with a sweet vanilla glaze. Available in plain, chocolate, and sprinkles.',
    details: 'Weight: 80g each. Flavours: Plain, Chocolate, Strawberry, Sprinkles. Shelf life: 1 day.',
    inStock: true, stock: 2,
    tags: ['Sweet', 'Kids'],
    isBestSeller: true,
  },
  {
    id: 'chocolate-cake',
    name: 'Dark Chocolate Fudge Cake',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop',
    category: 'Cake',
    description: 'Rich, decadent 3-layer chocolate fudge cake with Belgian chocolate ganache. Perfect for any celebration.',
    details: 'Serves 8–12. Available in 1kg, 1.5kg, 2kg. Custom decoration available. Order 24hrs in advance.',
    inStock: true, stock: 1,
    tags: ['Celebration', 'Chocolate'],
    isSale: true, isBestSeller: true,
  },
  {
    id: 'red-velvet-cake',
    name: 'Red Velvet Dream Cake',
    price: 10,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80&fit=crop',
    category: 'Cake',
    description: 'Stunning red velvet with velvety cream cheese frosting. A showstopper for weddings, birthdays, and special events.',
    details: 'Serves 8–12. 1kg standard. Custom sizes available. Order 48hrs in advance.',
    inStock: true, stock: 2,
    tags: ['Celebration', 'Wedding'],
    isNew: true, isBestSeller: true,
  },
  {
    id: 'new-york-cheesecake',
    name: 'New York Cheesecake',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80&fit=crop',
    category: 'Cake',
    description: 'Classic baked New York cheesecake on a buttery digestive base. Creamy, rich, and perfectly smooth.',
    details: 'Serves 6–8. 800g. Toppings: plain, strawberry, blueberry. Keep refrigerated. Consume within 3 days.',
    inStock: true, stock: 1,
    tags: ['Cheesecake', 'American'],
    isSale: true,
  },
  {
    id: 'vanilla-cupcakes',
    name: 'Vanilla Cupcakes (6-Pack)',
    price: 10,
    image: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=600&q=80&fit=crop',
    category: 'Pastry',
    description: 'Six fluffy vanilla cupcakes topped with swirled buttercream. Choose your frosting colour for parties.',
    details: 'Pack of 6. 60g each. Flavours: Vanilla, Chocolate, Strawberry, Lemon. Custom colours available.',
    inStock: true, stock: 2,
    tags: ['Party', 'Kids'],
  },
  {
    id: 'blueberry-muffin',
    name: 'Blueberry Muffin',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&q=80&fit=crop',
    category: 'Pastry',
    description: 'Moist muffin packed with fresh blueberries and topped with a crunchy streusel crumble.',
    details: 'Weight: 120g. Made with fresh blueberries. Shelf life: 2 days.',
    inStock: true, stock: 1,
    tags: ['Breakfast', 'Healthy'],
    isSale: true,
  },
  {
    id: 'butter-cookies',
    name: 'Butter Cookies Box (500g)',
    price: 10,
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop',
    category: 'Cookies',
    description: 'Melt-in-your-mouth shortbread butter cookies in a beautiful gift box. Ideal for gifting.',
    details: '500g of assorted butter cookies. Varieties: plain, chocolate chip, vanilla. Shelf life: 2 weeks.',
    inStock: true, stock: 2,
    tags: ['Gift', 'Shortbread'],
  },
  {
    id: 'fruit-tart',
    name: 'Mixed Fruit Tart',
    price: 10, originalPrice: 15,
    image: 'https://images.unsplash.com/photo-1464500701-54b8b28ede7f?w=600&q=80&fit=crop',
    category: 'Pastry',
    description: 'Crisp pastry shell filled with vanilla custard cream topped with fresh seasonal fruits. A visual delight.',
    details: 'Serves 4–6. Also available as individual mini-tarts (KES 200 each). Consume within 24 hours.',
    inStock: true, stock: 1,
    tags: ['Fruit', 'Fancy'],
    isSale: true, isBestSeller: true,
  },
  // ─── Additional products (all KES 10, stock 1-2, all in stock) ───
  {
    id: 'brown-bread', name: 'Brown Bread Loaf', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Wholesome brown bread with a rich, nutty flavour.', details: 'Weight: 800g. Shelf life: 3 days.', inStock: true, stock: 2, tags: ['Healthy', 'Daily Bake'],
  },
  {
    id: 'whole-wheat-bread', name: 'Whole Wheat Bread', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: '100% whole wheat bread for the health-conscious.', details: 'Weight: 700g. High fibre content.', inStock: true, stock: 1, tags: ['Healthy', 'Whole Wheat'],
  },
  {
    id: 'multigrain-bread', name: 'Multigrain Bread', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Loaded with seeds and grains for extra nutrition.', details: 'Weight: 750g. Contains sunflower, flax, sesame seeds.', inStock: true, stock: 2, tags: ['Healthy', 'Seeds'],
  },
  {
    id: 'garlic-bread', name: 'Garlic Bread Loaf', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Crispy garlic bread infused with butter and herbs.', details: 'Weight: 400g. Best served warm.', inStock: true, stock: 1, tags: ['Garlic', 'Buttery'],
  },
  {
    id: 'focaccia', name: 'Italian Focaccia', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Italian flatbread with rosemary, olive oil, and sea salt.', details: 'Weight: 500g. Artisan baked.', inStock: true, stock: 2, tags: ['Italian', 'Artisan'],
  },
  {
    id: 'plain-bagel', name: 'Plain Bagel (4-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Chewy, golden bagels perfect for breakfast.', details: 'Pack of 4. Weight: 100g each.', inStock: true, stock: 1, tags: ['Breakfast', 'Chewy'],
  },
  {
    id: 'cheese-scone', name: 'Cheese Scone', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Savoury scone loaded with cheddar cheese.', details: 'Weight: 100g. Best served warm.', inStock: true, stock: 2, tags: ['Savoury', 'Cheese'],
  },
  {
    id: 'sausage-roll', name: 'Sausage Roll', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Flaky pastry wrapped around seasoned sausage meat.', details: 'Weight: 120g. Served hot.', inStock: true, stock: 1, tags: ['Savoury', 'Snack'],
  },
  {
    id: 'almond-croissant', name: 'Almond Croissant', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Buttery croissant filled with almond frangipane cream.', details: 'Weight: 110g. Contains almonds.', inStock: true, stock: 2, tags: ['French', 'Almond'],
  },
  {
    id: 'chocolate-eclair', name: 'Chocolate Eclair', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Choux pastry filled with custard and topped with chocolate.', details: 'Weight: 100g. Keep refrigerated.', inStock: true, stock: 1, tags: ['French', 'Chocolate'],
  },
  {
    id: 'danish-pastry', name: 'Danish Pastry', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Flaky layered pastry with fruit jam filling.', details: 'Weight: 90g. Assorted flavours.', inStock: true, stock: 2, tags: ['Sweet', 'Fruity'],
  },
  {
    id: 'apple-turnover', name: 'Apple Turnover', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Golden puff pastry with cinnamon apple filling.', details: 'Weight: 110g. Best served warm.', inStock: true, stock: 1, tags: ['Apple', 'Sweet'],
  },
  {
    id: 'meat-pie', name: 'Meat Pie', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Hearty pie with seasoned minced beef filling.', details: 'Weight: 150g. Fully baked.', inStock: true, stock: 2, tags: ['Savoury', 'Meat'],
  },
  {
    id: 'chocolate-donut', name: 'Chocolate Donut', price: 10, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop', category: 'Donuts',
    description: 'Rich chocolate-glazed donut with sprinkles.', details: 'Weight: 80g. Fresh daily.', inStock: true, stock: 1, tags: ['Chocolate', 'Sweet'],
  },
  {
    id: 'strawberry-donut', name: 'Strawberry Donut', price: 10, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop', category: 'Donuts',
    description: 'Pink strawberry-glazed donut with cream filling.', details: 'Weight: 85g. Fresh daily.', inStock: true, stock: 2, tags: ['Strawberry', 'Sweet'],
  },
  {
    id: 'caramel-donut', name: 'Caramel Donut', price: 10, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop', category: 'Donuts',
    description: 'Soft donut with caramel drizzle and sea salt.', details: 'Weight: 85g. Fresh daily.', inStock: true, stock: 1, tags: ['Caramel', 'Sweet'],
  },
  {
    id: 'powdered-donut', name: 'Powdered Sugar Donut', price: 10, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop', category: 'Donuts',
    description: 'Classic donut dusted with powdered sugar.', details: 'Weight: 75g. Fresh daily.', inStock: true, stock: 2, tags: ['Classic', 'Sweet'],
  },
  {
    id: 'jelly-donut', name: 'Jelly-Filled Donut', price: 10, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop', category: 'Donuts',
    description: 'Soft donut filled with strawberry jam.', details: 'Weight: 90g. Fresh daily.', inStock: true, stock: 1, tags: ['Jelly', 'Filled'],
  },
  {
    id: 'carrot-cake', name: 'Carrot Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Moist carrot cake with cream cheese frosting and walnuts.', details: 'Serves 8. 1kg.', inStock: true, stock: 2, tags: ['Celebration', 'Healthy'],
  },
  {
    id: 'vanilla-cake', name: 'Vanilla Sponge Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Light and fluffy vanilla sponge with buttercream.', details: 'Serves 8. 1kg.', inStock: true, stock: 1, tags: ['Classic', 'Vanilla'],
  },
  {
    id: 'lemon-cake', name: 'Lemon Drizzle Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Zesty lemon cake with a tangy lemon glaze.', details: 'Serves 6. 800g.', inStock: true, stock: 2, tags: ['Lemon', 'Zesty'],
  },
  {
    id: 'black-forest', name: 'Black Forest Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Classic Black Forest with cherries, cream, and chocolate.', details: 'Serves 10. 1.5kg.', inStock: true, stock: 1, tags: ['Celebration', 'Cherry'],
  },
  {
    id: 'tiramisu-cake', name: 'Tiramisu Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Italian-inspired coffee and mascarpone layered cake.', details: 'Serves 8. Contains coffee.', inStock: true, stock: 2, tags: ['Italian', 'Coffee'],
  },
  {
    id: 'chocolate-chip-cookies', name: 'Chocolate Chip Cookies (12-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', category: 'Cookies',
    description: 'Classic chocolate chip cookies, soft and chewy.', details: 'Pack of 12. 30g each.', inStock: true, stock: 1, tags: ['Chocolate', 'Classic'],
  },
  {
    id: 'oatmeal-cookies', name: 'Oatmeal Raisin Cookies (12-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', category: 'Cookies',
    description: 'Hearty oatmeal cookies with plump raisins.', details: 'Pack of 12. 35g each.', inStock: true, stock: 2, tags: ['Healthy', 'Oatmeal'],
  },
  {
    id: 'macaron-box', name: 'French Macaron Box (6-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', category: 'Cookies',
    description: 'Assorted French macarons in a gift box.', details: 'Pack of 6. Assorted flavours.', inStock: true, stock: 1, tags: ['French', 'Gift'],
  },
  {
    id: 'peanut-cookies', name: 'Peanut Butter Cookies (12-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', category: 'Cookies',
    description: 'Crunchy peanut butter cookies with a rich, nutty flavour.', details: 'Pack of 12. Contains peanuts.', inStock: true, stock: 2, tags: ['Peanut', 'Crunchy'],
  },
  {
    id: 'ginger-cookies', name: 'Ginger Snap Cookies (12-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', category: 'Cookies',
    description: 'Spiced ginger snap cookies with a satisfying crunch.', details: 'Pack of 12. 25g each.', inStock: true, stock: 1, tags: ['Ginger', 'Spiced'],
  },
  {
    id: 'kaimati', name: 'Kaimati (10-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80&fit=crop', category: 'Pastry',
    description: 'Traditional Kenyan sweet dumplings, golden and sugary.', details: 'Pack of 10. Made fresh daily.', inStock: true, stock: 2, tags: ['Traditional', 'Kenyan'],
  },
  {
    id: 'mandazi', name: 'Mandazi (6-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80&fit=crop', category: 'Pastry',
    description: 'Kenyan coconut-flavoured fried dough, lightly sweet.', details: 'Pack of 6. Best served warm.', inStock: true, stock: 1, tags: ['Traditional', 'Kenyan'],
  },
  {
    id: 'samosa', name: 'Beef Samosa (6-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop', category: 'Pastry',
    description: 'Crispy samosas filled with spiced minced beef.', details: 'Pack of 6. Served hot.', inStock: true, stock: 2, tags: ['Savoury', 'Kenyan'],
  },
  {
    id: 'chapati', name: 'Chapati (4-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Soft layered Kenyan chapati, golden and flaky.', details: 'Pack of 4. Best served warm.', inStock: true, stock: 1, tags: ['Traditional', 'Kenyan'],
  },
  {
    id: 'banana-bread', name: 'Banana Bread Loaf', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Moist banana bread with a hint of cinnamon and walnuts.', details: 'Weight: 600g. Shelf life: 3 days.', inStock: true, stock: 2, tags: ['Banana', 'Moist'],
  },
  {
    id: 'brioche', name: 'Brioche Bun (4-Pack)', price: 10, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop', category: 'Bread',
    description: 'Soft, buttery French brioche buns.', details: 'Pack of 4. 80g each.', inStock: true, stock: 1, tags: ['French', 'Buttery'],
  },
  {
    id: 'marble-cake', name: 'Marble Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Swirled vanilla and chocolate marble cake.', details: 'Serves 8. 1kg.', inStock: true, stock: 2, tags: ['Classic', 'Chocolate'],
  },
  {
    id: 'coconut-cake', name: 'Coconut Cake', price: 10, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', category: 'Cake',
    description: 'Tropical coconut cake with coconut cream frosting.', details: 'Serves 8. 1kg.', inStock: true, stock: 1, tags: ['Tropical', 'Coconut'],
  },
];

export const getProduct = (id: string) => products.find(p => p.id === id);
export const getBestSellers = () => products.filter(p => p.isBestSeller);
export const getOnOffer = () => products.filter(p => p.isSale || p.onOffer);
export const getRelated = (product: Product, count = 4) =>
  products.filter(p => p.id !== product.id && p.category === product.category).slice(0, count);

// ─── Dynamic product loading from main bakery inventory (food_info table) ───

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
    description: (row.description || `Fresh ${name} from our bakery`) as string,
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
  if (lower.includes('bread') || lower.includes('chapati') || lower.includes('focaccia') || lower.includes('bagel') || lower.includes('brioche')) return 'Bread';
  if (lower.includes('cake') || lower.includes('cheesecake') || lower.includes('tiramisu')) return 'Cake';
  if (lower.includes('donut') || lower.includes('doughnut')) return 'Donuts';
  if (lower.includes('cookie') || lower.includes('macaron') || lower.includes('biscuit')) return 'Cookies';
  if (lower.includes('pastry') || lower.includes('croissant') || lower.includes('muffin') || lower.includes('tart') || lower.includes('pie') || lower.includes('scone') || lower.includes('eclair') || lower.includes('samosa') || lower.includes('mandazi') || lower.includes('kaimati') || lower.includes('danish') || lower.includes('turnover') || lower.includes('roll') || lower.includes('cupcake')) return 'Pastry';
  if (dbCategory) return dbCategory;
  return 'Pastry';
}

function getCategoryFallbackImage(category: string): string {
  const images: Record<string, string> = {
    Bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    Pastry: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80&fit=crop',
    Cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop',
    Cookies: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop',
    Donuts: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80&fit=crop',
  };
  return images[category] || images.Pastry;
}

function buildDetails(row: Record<string, unknown>): string {
  const parts: string[] = [];
  if (row.shelf_life_days) parts.push(`Shelf life: ${row.shelf_life_days} days`);
  if (row.stock_unit) parts.push(`Unit: ${row.stock_unit}`);
  if (row.allergens && Array.isArray(row.allergens) && (row.allergens as string[]).length > 0) {
    parts.push(`Allergens: ${(row.allergens as string[]).join(', ')}`);
  }
  return parts.length > 0 ? parts.join('. ') + '.' : 'Freshly prepared in our bakery.';
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
 * Fetch products dynamically from the main bakery's food_info table.
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
