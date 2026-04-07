-- =============================================
-- SNACKOH BAKERY - STOCK UPDATE & PRODUCT SEED
-- Dynamically seeds all products into food_info
-- with stock 1-2 units, all in stock, KES 10 each
-- Run AFTER supabase-schema.sql and migrations
-- =============================================

-- Add missing columns to food_info if not present
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS current_stock DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS stock_unit TEXT DEFAULT 'pieces';

-- Clear existing seed products (based on known codes) to avoid duplicates
DELETE FROM food_info WHERE code IN (
  'PRD-WHBR-001', 'PRD-ARSO-002', 'PRD-BUCR-003', 'PRD-CISR-004', 'PRD-CLGL-005',
  'PRD-DACH-006', 'PRD-REVE-007', 'PRD-NEYO-008', 'PRD-VACU-009', 'PRD-BLMU-010',
  'PRD-BUCO-011', 'PRD-MIFR-012', 'PRD-BRBR-013', 'PRD-WHWH-014', 'PRD-MUBR-015',
  'PRD-GABR-016', 'PRD-ITFO-017', 'PRD-PLBA-018', 'PRD-CHSC-019', 'PRD-SARO-020',
  'PRD-ALCR-021', 'PRD-CHEC-022', 'PRD-DAPA-023', 'PRD-APTU-024', 'PRD-MEPI-025',
  'PRD-CHDO-026', 'PRD-STDO-027', 'PRD-CADO-028', 'PRD-POSU-029', 'PRD-JEFI-030',
  'PRD-CACA-031', 'PRD-VASP-032', 'PRD-LEDR-033', 'PRD-BLFO-034', 'PRD-TICA-035',
  'PRD-CHCH-036', 'PRD-OARA-037', 'PRD-FRMA-038', 'PRD-PEBU-039', 'PRD-GISN-040',
  'PRD-KA10-041', 'PRD-MA6P-042', 'PRD-BESA-043', 'PRD-CH4P-044', 'PRD-BABR-045',
  'PRD-BR4P-046', 'PRD-MACA-047', 'PRD-COCA-048'
);

-- Insert all products with dynamic stock (1 or 2), all in stock, KES 10 each
INSERT INTO food_info (product_name, code, price, current_stock, stock_unit, in_stock, category, description, image_url, allergens, calories, protein, fat, carbs, shelf_life_days, certification) VALUES
('White Bread Loaf',               'PRD-WHBR-001', 10, 2, 'pieces', true, 'Bread',   'Soft, fluffy white bread loaf baked fresh every morning.', NULL, ARRAY['Gluten'], 265, 9, 3.2, 49, 3, 'KEBS Certified'),
('Artisan Sourdough Loaf',         'PRD-ARSO-002', 10, 1, 'pieces', true, 'Bread',   'Traditional sourdough with a crispy crust and chewy interior.', NULL, ARRAY['Gluten'], 240, 8, 1.5, 46, 4, 'KEBS Certified'),
('Butter Croissant',               'PRD-BUCR-003', 10, 2, 'pieces', true, 'Pastry',  'Flaky, buttery French-style croissant.', NULL, ARRAY['Gluten','Dairy','Eggs'], 406, 8, 21, 45, 1, 'KEBS Certified'),
('Cinnamon Swirl Roll',            'PRD-CISR-004', 10, 1, 'pieces', true, 'Pastry',  'Warm, fluffy cinnamon roll with vanilla cream cheese icing.', NULL, ARRAY['Gluten','Dairy'], 350, 5, 12, 52, 1, 'KEBS Certified'),
('Classic Glazed Donut',           'PRD-CLGL-005', 10, 2, 'pieces', true, 'Donuts',  'Light, airy donut with a sweet vanilla glaze.', NULL, ARRAY['Gluten','Dairy'], 290, 4, 15, 35, 1, 'KEBS Certified'),
('Dark Chocolate Fudge Cake',      'PRD-DACH-006', 10, 1, 'pieces', true, 'Cake',    'Rich, decadent 3-layer chocolate fudge cake.', NULL, ARRAY['Gluten','Dairy','Eggs'], 380, 5, 18, 48, 3, 'KEBS Certified'),
('Red Velvet Dream Cake',          'PRD-REVE-007', 10, 2, 'pieces', true, 'Cake',    'Stunning red velvet with cream cheese frosting.', NULL, ARRAY['Gluten','Dairy','Eggs'], 360, 5, 16, 46, 3, 'KEBS Certified'),
('New York Cheesecake',            'PRD-NEYO-008', 10, 1, 'pieces', true, 'Cake',    'Classic baked New York cheesecake.', NULL, ARRAY['Gluten','Dairy','Eggs'], 320, 6, 22, 28, 3, 'KEBS Certified'),
('Vanilla Cupcakes (6-Pack)',      'PRD-VACU-009', 10, 2, 'pieces', true, 'Pastry',  'Six fluffy vanilla cupcakes topped with buttercream.', NULL, ARRAY['Gluten','Dairy','Eggs'], 280, 4, 12, 40, 2, 'KEBS Certified'),
('Blueberry Muffin',               'PRD-BLMU-010', 10, 1, 'pieces', true, 'Pastry',  'Moist muffin packed with fresh blueberries.', NULL, ARRAY['Gluten','Dairy','Eggs'], 340, 5, 14, 50, 2, 'KEBS Certified'),
('Butter Cookies Box (500g)',      'PRD-BUCO-011', 10, 2, 'pieces', true, 'Cookies', 'Shortbread butter cookies in a gift box.', NULL, ARRAY['Gluten','Dairy'], 450, 5, 22, 58, 14, 'KEBS Certified'),
('Mixed Fruit Tart',               'PRD-MIFR-012', 10, 1, 'pieces', true, 'Pastry',  'Crisp pastry shell filled with vanilla custard and fresh fruits.', NULL, ARRAY['Gluten','Dairy','Eggs'], 280, 4, 14, 36, 1, 'KEBS Certified'),
('Brown Bread Loaf',               'PRD-BRBR-013', 10, 2, 'pieces', true, 'Bread',   'Wholesome brown bread with a rich, nutty flavour.', NULL, ARRAY['Gluten'], 250, 10, 3, 45, 3, 'KEBS Certified'),
('Whole Wheat Bread',              'PRD-WHWH-014', 10, 1, 'pieces', true, 'Bread',   '100% whole wheat bread for the health-conscious.', NULL, ARRAY['Gluten'], 240, 11, 2.5, 42, 3, 'KEBS Certified'),
('Multigrain Bread',               'PRD-MUBR-015', 10, 2, 'pieces', true, 'Bread',   'Loaded with seeds and grains for extra nutrition.', NULL, ARRAY['Gluten','Sesame'], 255, 12, 4, 40, 3, 'KEBS Certified'),
('Garlic Bread Loaf',              'PRD-GABR-016', 10, 1, 'pieces', true, 'Bread',   'Crispy garlic bread infused with butter and herbs.', NULL, ARRAY['Gluten','Dairy'], 300, 8, 10, 42, 2, 'KEBS Certified'),
('Italian Focaccia',               'PRD-ITFO-017', 10, 2, 'pieces', true, 'Bread',   'Italian flatbread with rosemary, olive oil, and sea salt.', NULL, ARRAY['Gluten'], 270, 7, 8, 44, 2, 'KEBS Certified'),
('Plain Bagel (4-Pack)',           'PRD-PLBA-018', 10, 1, 'pieces', true, 'Bread',   'Chewy, golden bagels perfect for breakfast.', NULL, ARRAY['Gluten'], 245, 10, 1.5, 48, 3, 'KEBS Certified'),
('Cheese Scone',                   'PRD-CHSC-019', 10, 2, 'pieces', true, 'Pastry',  'Savoury scone loaded with cheddar cheese.', NULL, ARRAY['Gluten','Dairy'], 320, 9, 14, 38, 2, 'KEBS Certified'),
('Sausage Roll',                   'PRD-SARO-020', 10, 1, 'pieces', true, 'Pastry',  'Flaky pastry wrapped around seasoned sausage meat.', NULL, ARRAY['Gluten'], 340, 10, 18, 30, 1, 'KEBS Certified'),
('Almond Croissant',               'PRD-ALCR-021', 10, 2, 'pieces', true, 'Pastry',  'Buttery croissant filled with almond frangipane cream.', NULL, ARRAY['Gluten','Dairy','Nuts'], 420, 8, 24, 42, 1, 'KEBS Certified'),
('Chocolate Eclair',               'PRD-CHEC-022', 10, 1, 'pieces', true, 'Pastry',  'Choux pastry filled with custard and topped with chocolate.', NULL, ARRAY['Gluten','Dairy','Eggs'], 310, 5, 16, 38, 1, 'KEBS Certified'),
('Danish Pastry',                  'PRD-DAPA-023', 10, 2, 'pieces', true, 'Pastry',  'Flaky layered pastry with fruit jam filling.', NULL, ARRAY['Gluten','Dairy'], 370, 5, 18, 46, 1, 'KEBS Certified'),
('Apple Turnover',                 'PRD-APTU-024', 10, 1, 'pieces', true, 'Pastry',  'Golden puff pastry with cinnamon apple filling.', NULL, ARRAY['Gluten','Dairy'], 330, 4, 16, 44, 1, 'KEBS Certified'),
('Meat Pie',                       'PRD-MEPI-025', 10, 2, 'pieces', true, 'Pastry',  'Hearty pie with seasoned minced beef filling.', NULL, ARRAY['Gluten'], 360, 12, 18, 32, 1, 'KEBS Certified'),
('Chocolate Donut',                'PRD-CHDO-026', 10, 1, 'pieces', true, 'Donuts',  'Rich chocolate-glazed donut with sprinkles.', NULL, ARRAY['Gluten','Dairy'], 310, 4, 16, 38, 1, 'KEBS Certified'),
('Strawberry Donut',               'PRD-STDO-027', 10, 2, 'pieces', true, 'Donuts',  'Pink strawberry-glazed donut with cream filling.', NULL, ARRAY['Gluten','Dairy'], 300, 4, 14, 40, 1, 'KEBS Certified'),
('Caramel Donut',                  'PRD-CADO-028', 10, 1, 'pieces', true, 'Donuts',  'Soft donut with caramel drizzle and sea salt.', NULL, ARRAY['Gluten','Dairy'], 320, 4, 15, 42, 1, 'KEBS Certified'),
('Powdered Sugar Donut',           'PRD-POSU-029', 10, 2, 'pieces', true, 'Donuts',  'Classic donut dusted with powdered sugar.', NULL, ARRAY['Gluten','Dairy'], 280, 4, 14, 36, 1, 'KEBS Certified'),
('Jelly-Filled Donut',            'PRD-JEFI-030', 10, 1, 'pieces', true, 'Donuts',  'Soft donut filled with strawberry jam.', NULL, ARRAY['Gluten','Dairy'], 300, 4, 14, 40, 1, 'KEBS Certified'),
('Carrot Cake',                    'PRD-CACA-031', 10, 2, 'pieces', true, 'Cake',    'Moist carrot cake with cream cheese frosting and walnuts.', NULL, ARRAY['Gluten','Dairy','Eggs','Nuts'], 350, 5, 16, 44, 3, 'KEBS Certified'),
('Vanilla Sponge Cake',           'PRD-VASP-032', 10, 1, 'pieces', true, 'Cake',    'Light and fluffy vanilla sponge with buttercream.', NULL, ARRAY['Gluten','Dairy','Eggs'], 320, 5, 14, 42, 3, 'KEBS Certified'),
('Lemon Drizzle Cake',            'PRD-LEDR-033', 10, 2, 'pieces', true, 'Cake',    'Zesty lemon cake with a tangy lemon glaze.', NULL, ARRAY['Gluten','Dairy','Eggs'], 310, 4, 12, 44, 3, 'KEBS Certified'),
('Black Forest Cake',             'PRD-BLFO-034', 10, 1, 'pieces', true, 'Cake',    'Classic Black Forest with cherries, cream, and chocolate.', NULL, ARRAY['Gluten','Dairy','Eggs'], 370, 5, 18, 44, 3, 'KEBS Certified'),
('Tiramisu Cake',                  'PRD-TICA-035', 10, 2, 'pieces', true, 'Cake',    'Italian-inspired coffee and mascarpone layered cake.', NULL, ARRAY['Gluten','Dairy','Eggs'], 340, 6, 16, 40, 3, 'KEBS Certified'),
('Chocolate Chip Cookies (12-Pack)','PRD-CHCH-036', 10, 1, 'pieces', true, 'Cookies', 'Classic chocolate chip cookies, soft and chewy.', NULL, ARRAY['Gluten','Dairy'], 420, 5, 20, 56, 14, 'KEBS Certified'),
('Oatmeal Raisin Cookies (12-Pack)','PRD-OARA-037', 10, 2, 'pieces', true, 'Cookies', 'Hearty oatmeal cookies with plump raisins.', NULL, ARRAY['Gluten'], 380, 6, 14, 58, 14, 'KEBS Certified'),
('French Macaron Box (6-Pack)',    'PRD-FRMA-038', 10, 1, 'pieces', true, 'Cookies', 'Assorted French macarons in a gift box.', NULL, ARRAY['Eggs','Nuts'], 400, 6, 16, 56, 7, 'KEBS Certified'),
('Peanut Butter Cookies (12-Pack)','PRD-PEBU-039', 10, 2, 'pieces', true, 'Cookies', 'Crunchy peanut butter cookies.', NULL, ARRAY['Gluten','Nuts'], 440, 8, 22, 52, 14, 'KEBS Certified'),
('Ginger Snap Cookies (12-Pack)', 'PRD-GISN-040', 10, 1, 'pieces', true, 'Cookies', 'Spiced ginger snap cookies with a satisfying crunch.', NULL, ARRAY['Gluten'], 400, 5, 14, 62, 14, 'KEBS Certified'),
('Kaimati (10-Pack)',              'PRD-KA10-041', 10, 2, 'pieces', true, 'Pastry',  'Traditional Kenyan sweet dumplings, golden and sugary.', NULL, ARRAY['Gluten'], 320, 4, 16, 40, 1, 'KEBS Certified'),
('Mandazi (6-Pack)',               'PRD-MA6P-042', 10, 1, 'pieces', true, 'Pastry',  'Kenyan coconut-flavoured fried dough, lightly sweet.', NULL, ARRAY['Gluten'], 300, 5, 12, 44, 2, 'KEBS Certified'),
('Beef Samosa (6-Pack)',           'PRD-BESA-043', 10, 2, 'pieces', true, 'Pastry',  'Crispy samosas filled with spiced minced beef.', NULL, ARRAY['Gluten'], 340, 10, 16, 34, 1, 'KEBS Certified'),
('Chapati (4-Pack)',               'PRD-CH4P-044', 10, 1, 'pieces', true, 'Bread',   'Soft layered Kenyan chapati, golden and flaky.', NULL, ARRAY['Gluten'], 280, 7, 8, 46, 2, 'KEBS Certified'),
('Banana Bread Loaf',              'PRD-BABR-045', 10, 2, 'pieces', true, 'Bread',   'Moist banana bread with cinnamon and walnuts.', NULL, ARRAY['Gluten','Eggs','Nuts'], 290, 5, 10, 46, 3, 'KEBS Certified'),
('Brioche Bun (4-Pack)',           'PRD-BR4P-046', 10, 1, 'pieces', true, 'Bread',   'Soft, buttery French brioche buns.', NULL, ARRAY['Gluten','Dairy','Eggs'], 340, 8, 14, 44, 2, 'KEBS Certified'),
('Marble Cake',                    'PRD-MACA-047', 10, 2, 'pieces', true, 'Cake',    'Swirled vanilla and chocolate marble cake.', NULL, ARRAY['Gluten','Dairy','Eggs'], 340, 5, 14, 46, 3, 'KEBS Certified'),
('Coconut Cake',                   'PRD-COCA-048', 10, 1, 'pieces', true, 'Cake',    'Tropical coconut cake with coconut cream frosting.', NULL, ARRAY['Gluten','Dairy','Eggs'], 350, 5, 16, 44, 3, 'KEBS Certified');

-- Also update pricing_tiers to reflect KES 10 for all existing products
UPDATE pricing_tiers SET
  cost = 5,
  base_price = 10,
  wholesale_price = 8,
  retail_price = 10
WHERE active = true;
