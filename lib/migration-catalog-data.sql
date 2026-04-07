-- =============================================
-- MIGRATION: Snackoh Master Product Catalogue Data
-- Source: snackoh_product_catalogue.csv / .pdf
-- Run this in your Supabase SQL Editor AFTER all previous migrations
-- Idempotent: safe to run multiple times (uses ON CONFLICT / IF NOT EXISTS)
-- =============================================

-- =============================================
-- 1. ADD NEW COLUMNS TO food_info FOR FULL CATALOGUE SUPPORT
-- =============================================
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS selling_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS cost_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS retail_price DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS gross_margin DECIMAL DEFAULT 0;
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS dietary_labels TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'All day';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE food_info ADD COLUMN IF NOT EXISTS key_ingredients TEXT DEFAULT '';

-- Add unique constraint on code for upsert support
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_food_info_code_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_food_info_code_unique ON food_info(code) WHERE code IS NOT NULL AND code != '';
  END IF;
END $$;

-- =============================================
-- 2. PRODUCT CATEGORIES (from catalogue)
-- =============================================
INSERT INTO product_categories (name, description) VALUES
  ('Breakfast', 'Beverages and breakfast items'),
  ('Snack', 'Snacks, baked goods and light bites'),
  ('Fast food', 'Quick-serve street food and fast food items'),
  ('Lunch/dinner', 'Main meals, stews, plates and bowls')
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. INSERT ALL 57 CATALOGUE PRODUCTS INTO food_info
-- Uses INSERT ... ON CONFLICT to avoid duplicates on code
-- =============================================

-- === BEVERAGES (BEV-01 to BEV-09) ===
INSERT INTO food_info (product_name, code, category, description, selling_price, cost_price, retail_price, gross_margin, stock_unit, shelf_life_days, allergens, dietary_labels, reorder_level, notes, availability, key_ingredients, certification, supplier)
VALUES
('White Tea', 'BEV-01', 'Breakfast', 'Freshly brewed Kenya tea served with full-cream milk and a choice of sugar or honey. A warm, comforting classic.', 80, 18, 80, 77.5, 'cup', 0, ARRAY['Dairy'], 'Halal', 100, 'Made on order; high-turnover item', 'All day', 'Tea leaves (bulk ~KES 400/kg), fresh milk (KES 90/L bulk), sugar', '', ''),
('Black Tea', 'BEV-02', 'Breakfast', 'Bold, unsweetened Kenyan black tea brewed from premium highland leaves — pure, aromatic and energising.', 60, 10, 60, 83.3, 'cup', 0, ARRAY[]::TEXT[], 'Halal, Vegan', 100, 'Made on order', 'All day', 'Tea leaves (bulk ~KES 400/kg), water', '', ''),
('Lemon Tea', 'BEV-03', 'Breakfast', 'Refreshing black tea brightened with fresh-squeezed lemon juice and a hint of honey. Light and zesty.', 90, 20, 90, 77.8, 'cup', 0, ARRAY[]::TEXT[], 'Halal, Vegan', 80, 'Made on order; use fresh lemons', 'All day', 'Tea leaves, fresh lemons (KES 8/pc bulk), honey', '', ''),
('Black Coffee', 'BEV-04', 'Breakfast', 'Rich, full-bodied Kenyan Arabica brewed fresh — deep flavour, smooth finish, no milk or sugar added.', 100, 25, 100, 75.0, 'cup', 0, ARRAY[]::TEXT[], 'Halal, Vegan', 80, 'Made on order; use locally roasted Kenyan beans', 'All day', 'Coffee beans (bulk ~KES 800/kg), water', '', ''),
('White Coffee', 'BEV-05', 'Breakfast', 'Smooth Kenyan coffee balanced with steamed full-cream milk — a silky, satisfying morning staple.', 120, 35, 120, 70.8, 'cup', 0, ARRAY['Dairy'], 'Halal', 80, 'Made on order', 'All day', 'Coffee beans, milk (KES 90/L bulk), sugar', '', ''),
('Cappuccino', 'BEV-06', 'Breakfast', 'Espresso topped with velvety steamed milk and a generous dome of micro-foam — the Italian classic, Kenyan style.', 180, 55, 180, 69.4, 'cup', 0, ARRAY['Dairy'], 'Halal', 60, 'Made on order; requires espresso machine', 'All day', 'Espresso (coffee beans bulk), full-cream milk, sugar', '', ''),
('Latte', 'BEV-07', 'Breakfast', 'A generous pour of espresso blended with creamy steamed milk — silky, mellow and endlessly satisfying.', 200, 60, 200, 70.0, 'cup', 0, ARRAY['Dairy'], 'Halal', 60, 'Made on order; requires espresso machine', 'All day', 'Espresso, whole milk (bulk KES 90/L), flavoured syrups optional', '', ''),
('Espresso', 'BEV-08', 'Breakfast', 'A concentrated single shot of pure Kenyan Arabica espresso — bold, aromatic and incredibly rich.', 130, 30, 130, 76.9, 'cup', 0, ARRAY[]::TEXT[], 'Halal, Vegan', 60, 'Made on order; requires espresso machine', 'All day', 'Kenyan Arabica beans (bulk KES 800/kg), filtered water', '', ''),
('Hot Milk', 'BEV-09', 'Breakfast', 'Warm, full-cream farm-fresh milk — plain and pure, perfect for children or paired with anything on our menu.', 80, 18, 80, 77.5, 'cup', 0, ARRAY['Dairy'], 'Halal, Vegetarian', 50, 'Made on order', 'Breakfast / all day', 'Fresh whole milk (bulk KES 90/L)', '', '')
ON CONFLICT (code) WHERE code IS NOT NULL AND code != '' DO UPDATE SET
  product_name = EXCLUDED.product_name, category = EXCLUDED.category, description = EXCLUDED.description,
  selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, retail_price = EXCLUDED.retail_price,
  gross_margin = EXCLUDED.gross_margin, stock_unit = EXCLUDED.stock_unit, shelf_life_days = EXCLUDED.shelf_life_days,
  allergens = EXCLUDED.allergens, dietary_labels = EXCLUDED.dietary_labels, reorder_level = EXCLUDED.reorder_level,
  notes = EXCLUDED.notes, availability = EXCLUDED.availability, key_ingredients = EXCLUDED.key_ingredients;

-- === BREAKFAST ITEMS (BRK-01 to BRK-11) ===
INSERT INTO food_info (product_name, code, category, description, selling_price, cost_price, retail_price, gross_margin, stock_unit, shelf_life_days, allergens, dietary_labels, reorder_level, notes, availability, key_ingredients, certification, supplier)
VALUES
('Mandazi', 'BRK-01', 'Breakfast', 'Pillowy, lightly sweetened Kenyan doughnuts flavoured with cardamom and coconut — best enjoyed warm with chai.', 30, 8, 30, 73.3, 'pcs', 2, ARRAY['Gluten','Dairy'], 'Halal, Vegetarian', 200, 'Batch-cook; display in warmer', 'Breakfast / Snack', 'Wheat flour (bulk KES 75/kg), coconut milk, sugar, cardamom, oil', '', ''),
('Beef Samosa', 'BRK-02', 'Breakfast', 'Golden, crispy triangular pastry packed with spiced minced beef, onions and fresh herbs — an East African icon.', 60, 20, 60, 66.7, 'pcs', 1, ARRAY['Gluten','Beef'], 'Halal', 150, 'Batch-cook; display in warmer', 'Breakfast / Snack', 'Minced beef (bulk ~KES 880/kg), wheat flour, onions, spices, oil', '', ''),
('Smocha', 'BRK-03', 'Breakfast', 'A smokie tucked inside a crispy chapati wrap, topped with tangy tomato salsa and chilli sauce — irresistible street fusion.', 80, 28, 80, 65.0, 'pcs', 1, ARRAY['Gluten','Beef'], 'Halal', 100, 'Made to order; pair with smokie sauce', 'All day', 'Smokies (bulk KES 350/pack of 10), wheat flour, tomato, chilli', '', ''),
('Boiled Eggs', 'BRK-04', 'Breakfast', 'Two farm-fresh eggs boiled to your preference — soft, medium or hard. Served with a pinch of salt and pepper.', 60, 20, 60, 66.7, 'pcs', 1, ARRAY['Eggs'], 'Halal, Vegetarian', 120, 'Boil in batches; 2 eggs per serving', 'Breakfast', 'Eggs (tray of 30 ~KES 450 bulk; ~KES 15/egg)', '', ''),
('Toast Mayai', 'BRK-05', 'Breakfast', 'Fluffy scrambled or fried egg on toasted white or brown bread — simple, hearty and deeply satisfying.', 120, 38, 120, 68.3, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal, Vegetarian', 80, 'Made on order', 'Breakfast', 'Bread (loaf bulk KES 60), eggs (bulk KES 15/pc), butter, salt', '', ''),
('Sandwich', 'BRK-06', 'Breakfast', 'Freshly assembled sandwich on toasted bread with your choice of filling — egg, beef or veggie with crisp salad.', 180, 60, 180, 66.7, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal', 60, 'Made on order; offer 2-3 filling options', 'Breakfast / Lunch', 'Bread, eggs, beef/chicken, mayo (bulk KES 400/kg), veggies', '', ''),
('French Toast', 'BRK-07', 'Breakfast', 'Thick-cut bread dipped in a spiced egg and milk batter, pan-fried golden and dusted with cinnamon sugar.', 160, 48, 160, 70.0, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal, Vegetarian', 50, 'Made on order', 'Breakfast', 'Bread, eggs, milk, cinnamon, sugar, butter', '', ''),
('Avocado Toast', 'BRK-08', 'Breakfast', 'Toasted artisan bread spread with smashed ripe avocado, seasoned with lime, chilli flakes and fresh herbs.', 200, 65, 200, 67.5, 'pcs', 0, ARRAY['Gluten'], 'Halal, Vegan', 50, 'Made on order; use ripe Kenyan avocados', 'Breakfast / Brunch', 'Bread, avocado (bulk KES 30/pc), lime, chilli flakes, olive oil', '', ''),
('Egg and Toast', 'BRK-09', 'Breakfast', 'Two fried or scrambled eggs alongside golden toast — a clean, protein-rich breakfast that powers your morning.', 130, 40, 130, 69.2, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal, Vegetarian', 80, 'Made on order', 'Breakfast', 'Eggs (KES 15/pc bulk), bread (bulk loaf KES 60), butter', '', ''),
('Eggs Benedict', 'BRK-10', 'Breakfast', 'Poached eggs on toasted English muffins with our house hollandaise sauce and a sprinkle of paprika.', 350, 120, 350, 65.7, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal, Vegetarian', 30, 'Premium item; made on order; chef skill required', 'Breakfast / Brunch', 'Eggs, muffins, butter (bulk KES 800/kg), lemon, paprika', '', ''),
('Toast, Avo, Strawberries & Scrambled Eggs', 'BRK-11', 'Breakfast', 'A vibrant breakfast plate — creamy scrambled eggs, smashed avocado and fresh strawberries on toasted bread.', 380, 130, 380, 65.8, 'pcs', 0, ARRAY['Gluten','Eggs','Dairy'], 'Halal, Vegetarian', 20, 'Premium plate; seasonal strawberries', 'Breakfast / Brunch', 'Eggs, bread, avocado, strawberries (KES 200/kg bulk)', '', '')
ON CONFLICT (code) WHERE code IS NOT NULL AND code != '' DO UPDATE SET
  product_name = EXCLUDED.product_name, category = EXCLUDED.category, description = EXCLUDED.description,
  selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, retail_price = EXCLUDED.retail_price,
  gross_margin = EXCLUDED.gross_margin, stock_unit = EXCLUDED.stock_unit, shelf_life_days = EXCLUDED.shelf_life_days,
  allergens = EXCLUDED.allergens, dietary_labels = EXCLUDED.dietary_labels, reorder_level = EXCLUDED.reorder_level,
  notes = EXCLUDED.notes, availability = EXCLUDED.availability, key_ingredients = EXCLUDED.key_ingredients;

-- === SNACKS (SNK-01 to SNK-14) ===
INSERT INTO food_info (product_name, code, category, description, selling_price, cost_price, retail_price, gross_margin, stock_unit, shelf_life_days, allergens, dietary_labels, reorder_level, notes, availability, key_ingredients, certification, supplier)
VALUES
('Soft-Layered Chapati', 'SNK-01', 'Snack', 'Hand-rolled soft multi-layered chapati, cooked in a touch of oil until golden and pliable — the Kenyan favourite.', 50, 12, 50, 76.0, 'pcs', 1, ARRAY['Gluten'], 'Halal, Vegan', 200, 'Batch-cook daily; sell individually or as part of meal', 'All day', 'Wheat flour (bulk KES 75/kg), cooking oil (bulk 20L ~KES 3800), salt', '', ''),
('Beef Burrito Wrap', 'SNK-02', 'Snack', 'Flour tortilla loaded with spiced beef, fresh salsa, lettuce, cheese and sour cream — big flavour, handheld.', 350, 110, 350, 68.6, 'pcs', 0, ARRAY['Gluten','Dairy','Beef'], 'Halal', 30, 'Made on order; keep fillings prepped', 'Lunch / Snack', 'Flour tortilla, minced beef, cheese, sour cream, veggies, spices', '', ''),
('Croissant', 'SNK-03', 'Snack', 'Buttery, flaky all-butter croissant baked fresh in-house — light, layered and simply perfect with coffee.', 120, 38, 120, 68.3, 'pcs', 2, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 60, 'Bake daily; sell by noon', 'Breakfast / Snack', 'Wheat flour, butter (bulk KES 800/kg), eggs, yeast, salt, sugar', '', ''),
('Muffins', 'SNK-04', 'Snack', 'Moist, generously topped muffins in rotating flavours — blueberry, chocolate chip and banana walnut.', 100, 28, 100, 72.0, 'pcs', 3, ARRAY['Gluten','Dairy','Eggs','Nuts'], 'Halal, Vegetarian', 60, 'Bake daily; display at counter', 'All day', 'Flour, butter, eggs, sugar, milk, flavourings, baking powder', '', ''),
('Cookies', 'SNK-05', 'Snack', 'Thick, chewy cookies with crisp edges — classic chocolate chip, oatmeal raisin and peanut butter varieties.', 60, 15, 60, 75.0, 'pcs', 7, ARRAY['Gluten','Dairy','Eggs','Nuts'], 'Halal, Vegetarian', 100, 'Bake in large batches; good shelf life', 'All day', 'Flour (bulk KES 75/kg), butter, sugar, eggs, chocolate chips', '', ''),
('Chocolate Donuts', 'SNK-06', 'Snack', 'Ring donuts dipped in rich chocolate glaze and topped with rainbow sprinkles — a crowd-pleasing sweet treat.', 80, 22, 80, 72.5, 'pcs', 2, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 80, 'Fry fresh daily; display prominently', 'All day', 'Flour, eggs, sugar, yeast, butter, chocolate glaze (bulk cocoa)', '', ''),
('Cupcake', 'SNK-07', 'Snack', 'Fluffy sponge cupcake crowned with whipped buttercream frosting — vanilla, chocolate or red velvet.', 100, 28, 100, 72.0, 'pcs', 3, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 60, 'Bake daily; decorate with seasonal themes', 'All day', 'Flour, butter, sugar, eggs, milk, food colouring, icing sugar', '', ''),
('Kaimati', 'SNK-08', 'Snack', 'Sweet, sticky East African doughnut balls glazed in cardamom-spiced syrup — crispy outside, fluffy inside.', 50, 12, 50, 76.0, 'pcs', 1, ARRAY['Gluten'], 'Halal, Vegan', 100, 'Fry in batches; sell warm', 'Breakfast / Snack', 'Flour, sugar, cardamom, yeast, oil (bulk), water', '', ''),
('Mini Pizza', 'SNK-09', 'Snack', 'Individual pizza bases topped with tomato sauce, mozzarella and a choice of beef, chicken or veggie toppings.', 200, 65, 200, 67.5, 'pcs', 0, ARRAY['Gluten','Dairy'], 'Halal', 40, 'Batch-bake bases; assemble to order', 'Lunch / Snack', 'Flour, cheese (bulk KES 900/kg), tomato paste, toppings, yeast', '', ''),
('Chocolate Rolls', 'SNK-10', 'Snack', 'Soft, pillowy bread rolls swirled with rich chocolate filling and dusted with icing sugar — irresistibly indulgent.', 100, 28, 100, 72.0, 'pcs', 3, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 60, 'Bake daily; great with coffee', 'All day', 'Flour, butter, eggs, sugar, cocoa powder, yeast, milk', '', ''),
('Bhajia (Veggie Fritters)', 'SNK-11', 'Fast food', 'Golden, crispy chickpea flour fritters packed with spiced potato and onion — the ultimate Nairobi snack.', 150, 42, 150, 72.0, 'pcs', 1, ARRAY['Gluten'], 'Halal, Vegan', 60, 'Fry to order; serve with tamarind or chilli dip', 'All day', 'Chickpea flour (besan bulk), potatoes (KES 45/kg bulk), onions, spices', '', ''),
('Chips Masala', 'SNK-12', 'Fast food', 'Crispy golden fries tossed in our house masala spice blend with fresh tomatoes, onions and chilli — addictive.', 200, 55, 200, 72.5, 'pcs', 0, ARRAY[]::TEXT[], 'Halal, Vegan', 60, 'Fry to order; use fresh potatoes', 'All day', 'Potatoes (bulk KES 45/kg), cooking oil, masala spices, tomatoes', '', ''),
('Smokies with Stir-Fry', 'SNK-13', 'Fast food', 'Juicy grilled smokies served alongside a vibrant stir-fried vegetable medley with garlic and ginger sauce.', 200, 65, 200, 67.5, 'pcs', 0, ARRAY['Beef'], 'Halal', 40, 'Grill smokies fresh; stir-fry veggies to order', 'All day', 'Smokies (bulk KES 350/10-pack), cabbage, carrots, peppers, garlic', '', ''),
('Cheeseburger', 'SNK-14', 'Fast food', 'Juicy seasoned beef patty in a toasted sesame bun with cheddar, fresh lettuce, tomato, pickles and our secret sauce.', 380, 120, 380, 68.4, 'pcs', 0, ARRAY['Gluten','Dairy','Beef','Eggs'], 'Halal', 40, 'Made to order; keep patties prepped and chilled', 'Lunch / Dinner', 'Minced beef (bulk KES 880/kg), buns, cheddar, lettuce, tomato, sauce', '', '')
ON CONFLICT (code) WHERE code IS NOT NULL AND code != '' DO UPDATE SET
  product_name = EXCLUDED.product_name, category = EXCLUDED.category, description = EXCLUDED.description,
  selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, retail_price = EXCLUDED.retail_price,
  gross_margin = EXCLUDED.gross_margin, stock_unit = EXCLUDED.stock_unit, shelf_life_days = EXCLUDED.shelf_life_days,
  allergens = EXCLUDED.allergens, dietary_labels = EXCLUDED.dietary_labels, reorder_level = EXCLUDED.reorder_level,
  notes = EXCLUDED.notes, availability = EXCLUDED.availability, key_ingredients = EXCLUDED.key_ingredients;

-- === LUNCH / DINNER (LND-01 to LND-23) ===
INSERT INTO food_info (product_name, code, category, description, selling_price, cost_price, retail_price, gross_margin, stock_unit, shelf_life_days, allergens, dietary_labels, reorder_level, notes, availability, key_ingredients, certification, supplier)
VALUES
('Beef Stew with Rice & Cabbage Salad', 'LND-01', 'Lunch/dinner', 'Slow-cooked tender beef stew with aromatic spices, served over fluffy basmati rice and crisp fresh cabbage salad.', 350, 110, 350, 68.6, 'plate', 1, ARRAY[]::TEXT[], 'Halal', 50, 'Cook in large batches; popular staple', 'Lunch / Dinner', 'Beef bone-in (bulk KES 850/kg), basmati rice (bulk KES 140/kg), cabbage', '', ''),
('Chicken Stew', 'LND-02', 'Lunch/dinner', 'Rich, hearty Kenyan chicken stew slow-cooked with tomatoes, onions and aromatic spices — soul-warming comfort food.', 320, 100, 320, 68.8, 'plate', 1, ARRAY[]::TEXT[], 'Halal', 50, 'Cook in large batches', 'Lunch / Dinner', 'Chicken legs (bulk KES 600/kg), tomatoes, onions, spices, oil', '', ''),
('Cheese Noodles', 'LND-03', 'Lunch/dinner', 'Creamy wok-tossed noodles in a rich cheese sauce with sauteed vegetables and a hint of garlic — comfort in a bowl.', 280, 85, 280, 69.6, 'plate', 0, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 30, 'Made to order; popular with youth', 'Lunch / Dinner', 'Noodles (bulk KES 120/kg), cheddar/processed cheese, butter, veggies', '', ''),
('Ugali with Beef Stew', 'LND-04', 'Lunch/dinner', 'The Kenyan staple — firm ugali made from stone-ground maize flour served with deeply flavoured slow-cooked beef stew.', 300, 90, 300, 70.0, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 80, 'High-volume daily staple', 'Lunch / Dinner', 'Maize flour (bulk KES 78/kg), beef (KES 850/kg bulk), tomatoes, spices', '', ''),
('Beans & Sweet Corn Stew', 'LND-05', 'Lunch/dinner', 'Protein-packed stew of borlotti beans and sweet corn in a spiced tomato base — hearty, filling and plant-powered.', 250, 65, 250, 74.0, 'plate', 2, ARRAY[]::TEXT[], 'Halal, Vegan, Gluten-Free', 40, 'Cook in bulk; great vegetarian option', 'Lunch / Dinner', 'Dried beans (bulk KES 120/kg), sweet corn, tomatoes, onions, spices', '', ''),
('Beef Stew, Crispy Fries & Kachumbari', 'LND-06', 'Lunch/dinner', 'Tender beef stew paired with golden hand-cut fries and refreshing kachumbari — a Kenyan crowd favourite.', 380, 120, 380, 68.4, 'plate', 0, ARRAY[]::TEXT[], 'Halal', 50, 'Popular combo; keep stew hot and fry fresh', 'Lunch / Dinner', 'Beef, potatoes (KES 45/kg bulk), tomatoes, onions, cooking oil', '', ''),
('Chicken Pilau', 'LND-07', 'Lunch/dinner', 'Fragrant East African pilau — tender chicken and spiced basmati rice slow-cooked with whole spices and caramelised onions.', 380, 120, 380, 68.4, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 40, 'Cook in batch; weekend staple', 'Lunch / Dinner', 'Chicken (KES 600/kg bulk), basmati rice, pilau masala, onions, ghee', '', ''),
('Rice & Lentil Stew', 'LND-08', 'Lunch/dinner', 'Comforting Kenyan-style lentil dhal served over fluffy rice — spiced with cumin, ginger and fresh tomatoes.', 250, 65, 250, 74.0, 'plate', 2, ARRAY[]::TEXT[], 'Halal, Vegan, Gluten-Free', 40, 'Cook in bulk; great budget vegan option', 'Lunch / Dinner', 'Lentils (bulk KES 100/kg), rice, tomatoes, cumin, ginger, onions', '', ''),
('Ugali, Spinach & Scrambled Egg', 'LND-09', 'Lunch/dinner', 'Smooth ugali served with silky sauteed spinach and fluffy scrambled eggs — a wholesome, balanced Kenyan plate.', 280, 80, 280, 71.4, 'plate', 1, ARRAY['Eggs'], 'Halal, Vegetarian, Gluten-Free', 40, 'Popular vegetarian plate', 'Lunch / Dinner', 'Maize flour, fresh spinach (KES 50/kg bulk), eggs (KES 15/pc)', '', ''),
('Savory Carrot Pancakes', 'LND-10', 'Lunch/dinner', 'Fluffy savoury pancakes packed with grated carrot, spring onions and spices — served with a yoghurt dip.', 280, 80, 280, 71.4, 'plate', 0, ARRAY['Gluten','Dairy','Eggs'], 'Halal, Vegetarian', 25, 'Niche dish; great for differentiation', 'Lunch / Dinner', 'Wheat flour, carrots (bulk KES 40/kg), eggs, yoghurt, spring onions', '', ''),
('Spicy Stir-Fried Baby Fish (Omena)', 'LND-11', 'Lunch/dinner', 'Lake Victoria omena stir-fried with tomatoes, onions, chilli and garlic until crispy and boldly spiced.', 280, 75, 280, 73.2, 'plate', 2, ARRAY['Fish'], 'Halal, Gluten-Free', 30, 'Popular with local demographic; keep dried omena in stock', 'Lunch / Dinner', 'Dried omena (bulk KES 200/kg), tomatoes, onions, chilli, garlic', '', ''),
('Ugali, Chicken Stew & Collard Greens', 'LND-12', 'Lunch/dinner', 'The ultimate Kenyan trio — firm ugali, rich chicken stew and tender sukuma wiki — a complete nourishing meal.', 350, 108, 350, 69.1, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 50, 'Top-seller; batch cook all three components', 'Lunch / Dinner', 'Maize flour, chicken (KES 600/kg), sukuma wiki (bulk KES 30/kg), spices', '', ''),
('Spicy Beef Stew with Veggie Fried Rice', 'LND-13', 'Lunch/dinner', 'Boldly spiced beef stew served alongside wok-tossed vegetable fried rice with soy, garlic and sesame.', 380, 118, 380, 68.9, 'plate', 0, ARRAY['Gluten','Soy'], 'Halal', 35, 'Keep rice and stew prepped; combine to order', 'Lunch / Dinner', 'Beef, rice, mixed veggies, soy sauce, sesame oil, garlic, ginger', '', ''),
('Ugali, Beef, Greens & Avocado', 'LND-14', 'Lunch/dinner', 'A generous plate of ugali, slow-cooked beef, sauteed greens and creamy fresh avocado — balanced and satisfying.', 380, 118, 380, 68.9, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 40, 'Premium ugali plate; avocado availability seasonal', 'Lunch / Dinner', 'Maize flour, beef (KES 850/kg), greens, avocado (KES 30/pc bulk)', '', ''),
('Grilled Chicken Wings, Wedges & Greek Salad', 'LND-15', 'Lunch/dinner', 'Smoky chargrilled chicken wings with crispy seasoned potato wedges and a fresh Greek-style salad.', 480, 155, 480, 67.7, 'plate', 0, ARRAY['Dairy','Eggs'], 'Halal', 30, 'Premium item; marinate wings overnight', 'Lunch / Dinner', 'Chicken wings (bulk KES 700/kg), potatoes, feta, olives, cucumber', '', ''),
('Spicy Chicken with Rice & Cabbage Salad', 'LND-16', 'Lunch/dinner', 'Boldly spiced chicken pieces served with fluffy rice and a crisp, tangy cabbage salad — flavour-packed everyday eat.', 350, 108, 350, 69.1, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 50, 'High-volume item; batch cook chicken', 'Lunch / Dinner', 'Chicken (KES 600/kg), rice (KES 140/kg bulk), cabbage, spices', '', ''),
('Beef and Potato Stew', 'LND-17', 'Lunch/dinner', 'Classic Kenyan beef and potato stew slow-cooked with tomatoes and aromatic spices — hearty, affordable comfort.', 320, 98, 320, 69.4, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 50, 'Budget-friendly; great volume seller', 'Lunch / Dinner', 'Beef (KES 850/kg bulk), potatoes (KES 45/kg), tomatoes, spices', '', ''),
('Stuffed Paneer Pockets', 'LND-18', 'Lunch/dinner', 'Warm flatbread pockets filled with spiced Indian paneer, peppers and onions — a fusion delight.', 320, 98, 320, 69.4, 'plate', 0, ARRAY['Gluten','Dairy'], 'Halal, Vegetarian', 20, 'Niche dish; source paneer locally or make in-house', 'Lunch / Dinner', 'Wheat flour, paneer (bulk KES 700/kg), peppers, onions, spices', '', ''),
('Spicy Chicken Stir-Fry with Peppers, Rice & Fries', 'LND-19', 'Lunch/dinner', 'Wok-fired chicken with vibrant bell peppers in a spicy sauce served with rice and golden fries on the side.', 420, 135, 420, 67.9, 'plate', 0, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 30, 'Popular fusion plate; prep chicken and veg ahead', 'Lunch / Dinner', 'Chicken, bell peppers, rice, potatoes, soy sauce, garlic, spices', '', ''),
('Ugali with Kienyeji Greens', 'LND-20', 'Lunch/dinner', 'Traditional firm ugali paired with earthy, nutrient-rich kienyeji (indigenous) greens — proudly Kenyan.', 250, 65, 250, 74.0, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Vegan, Gluten-Free', 60, 'Source kienyeji greens from local farms; budget item', 'Lunch / Dinner', 'Maize flour (KES 78/kg bulk), kienyeji greens (KES 40/kg), onions, oil', '', ''),
('Biryani Rice', 'LND-21', 'Lunch/dinner', 'Fragrant, slow-cooked biryani rice layered with spices, caramelised onions and your choice of chicken or beef.', 400, 128, 400, 68.0, 'plate', 1, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 30, 'Cook in large pots; weekend special', 'Lunch / Dinner', 'Basmati rice, chicken/beef, biryani spices, onions, yoghurt, saffron', '', ''),
('Bone Broth', 'LND-22', 'Lunch/dinner', 'Slow-simmered beef bone broth rich in collagen and minerals — deeply nourishing, warming and healing.', 250, 65, 250, 74.0, 'bowl', 3, ARRAY[]::TEXT[], 'Halal, Gluten-Free', 20, 'Simmer for 8-12 hrs; great use of beef bones (cheap)', 'All day', 'Beef bones (bulk KES 850/kg), onions, garlic, ginger, herbs, water', '', ''),
('Chicken Soup', 'LND-23', 'Lunch/dinner', 'Comforting slow-cooked chicken soup with vegetables, herbs and soft noodles — the ultimate feel-good bowl.', 280, 80, 280, 71.4, 'bowl', 2, ARRAY['Gluten'], 'Halal', 20, 'Make fresh daily; great for cold/rainy days', 'All day', 'Chicken (KES 600/kg bulk), carrots, celery, noodles, herbs, stock', '', '')
ON CONFLICT (code) WHERE code IS NOT NULL AND code != '' DO UPDATE SET
  product_name = EXCLUDED.product_name, category = EXCLUDED.category, description = EXCLUDED.description,
  selling_price = EXCLUDED.selling_price, cost_price = EXCLUDED.cost_price, retail_price = EXCLUDED.retail_price,
  gross_margin = EXCLUDED.gross_margin, stock_unit = EXCLUDED.stock_unit, shelf_life_days = EXCLUDED.shelf_life_days,
  allergens = EXCLUDED.allergens, dietary_labels = EXCLUDED.dietary_labels, reorder_level = EXCLUDED.reorder_level,
  notes = EXCLUDED.notes, availability = EXCLUDED.availability, key_ingredients = EXCLUDED.key_ingredients;

-- =============================================
-- 4. PRICING TIERS FOR ALL CATALOGUE PRODUCTS
-- Uses selling_price as retail, cost_price as cost, calculated wholesale (~80% of retail)
-- =============================================
INSERT INTO pricing_tiers (product_code, product_name, cost, base_price, wholesale_price, retail_price, margin, active) VALUES
-- Beverages
('BEV-01', 'White Tea', 18, 80, 60, 80, 77.5, true),
('BEV-02', 'Black Tea', 10, 60, 45, 60, 83.3, true),
('BEV-03', 'Lemon Tea', 20, 90, 70, 90, 77.8, true),
('BEV-04', 'Black Coffee', 25, 100, 75, 100, 75.0, true),
('BEV-05', 'White Coffee', 35, 120, 90, 120, 70.8, true),
('BEV-06', 'Cappuccino', 55, 180, 140, 180, 69.4, true),
('BEV-07', 'Latte', 60, 200, 155, 200, 70.0, true),
('BEV-08', 'Espresso', 30, 130, 100, 130, 76.9, true),
('BEV-09', 'Hot Milk', 18, 80, 60, 80, 77.5, true),
-- Breakfast
('BRK-01', 'Mandazi', 8, 30, 22, 30, 73.3, true),
('BRK-02', 'Beef Samosa', 20, 60, 45, 60, 66.7, true),
('BRK-03', 'Smocha', 28, 80, 60, 80, 65.0, true),
('BRK-04', 'Boiled Eggs', 20, 60, 45, 60, 66.7, true),
('BRK-05', 'Toast Mayai', 38, 120, 90, 120, 68.3, true),
('BRK-06', 'Sandwich', 60, 180, 140, 180, 66.7, true),
('BRK-07', 'French Toast', 48, 160, 120, 160, 70.0, true),
('BRK-08', 'Avocado Toast', 65, 200, 155, 200, 67.5, true),
('BRK-09', 'Egg and Toast', 40, 130, 100, 130, 69.2, true),
('BRK-10', 'Eggs Benedict', 120, 350, 270, 350, 65.7, true),
('BRK-11', 'Toast, Avo, Strawberries & Scrambled Eggs', 130, 380, 290, 380, 65.8, true),
-- Snacks
('SNK-01', 'Soft-Layered Chapati', 12, 50, 38, 50, 76.0, true),
('SNK-02', 'Beef Burrito Wrap', 110, 350, 270, 350, 68.6, true),
('SNK-03', 'Croissant', 38, 120, 90, 120, 68.3, true),
('SNK-04', 'Muffins', 28, 100, 75, 100, 72.0, true),
('SNK-05', 'Cookies', 15, 60, 45, 60, 75.0, true),
('SNK-06', 'Chocolate Donuts', 22, 80, 60, 80, 72.5, true),
('SNK-07', 'Cupcake', 28, 100, 75, 100, 72.0, true),
('SNK-08', 'Kaimati', 12, 50, 38, 50, 76.0, true),
('SNK-09', 'Mini Pizza', 65, 200, 155, 200, 67.5, true),
('SNK-10', 'Chocolate Rolls', 28, 100, 75, 100, 72.0, true),
('SNK-11', 'Bhajia (Veggie Fritters)', 42, 150, 115, 150, 72.0, true),
('SNK-12', 'Chips Masala', 55, 200, 155, 200, 72.5, true),
('SNK-13', 'Smokies with Stir-Fry', 65, 200, 155, 200, 67.5, true),
('SNK-14', 'Cheeseburger', 120, 380, 290, 380, 68.4, true),
-- Lunch / Dinner
('LND-01', 'Beef Stew with Rice & Cabbage Salad', 110, 350, 270, 350, 68.6, true),
('LND-02', 'Chicken Stew', 100, 320, 245, 320, 68.8, true),
('LND-03', 'Cheese Noodles', 85, 280, 215, 280, 69.6, true),
('LND-04', 'Ugali with Beef Stew', 90, 300, 230, 300, 70.0, true),
('LND-05', 'Beans & Sweet Corn Stew', 65, 250, 190, 250, 74.0, true),
('LND-06', 'Beef Stew, Crispy Fries & Kachumbari', 120, 380, 290, 380, 68.4, true),
('LND-07', 'Chicken Pilau', 120, 380, 290, 380, 68.4, true),
('LND-08', 'Rice & Lentil Stew', 65, 250, 190, 250, 74.0, true),
('LND-09', 'Ugali, Spinach & Scrambled Egg', 80, 280, 215, 280, 71.4, true),
('LND-10', 'Savory Carrot Pancakes', 80, 280, 215, 280, 71.4, true),
('LND-11', 'Spicy Stir-Fried Baby Fish (Omena)', 75, 280, 215, 280, 73.2, true),
('LND-12', 'Ugali, Chicken Stew & Collard Greens', 108, 350, 270, 350, 69.1, true),
('LND-13', 'Spicy Beef Stew with Veggie Fried Rice', 118, 380, 290, 380, 68.9, true),
('LND-14', 'Ugali, Beef, Greens & Avocado', 118, 380, 290, 380, 68.9, true),
('LND-15', 'Grilled Chicken Wings, Wedges & Greek Salad', 155, 480, 370, 480, 67.7, true),
('LND-16', 'Spicy Chicken with Rice & Cabbage Salad', 108, 350, 270, 350, 69.1, true),
('LND-17', 'Beef and Potato Stew', 98, 320, 245, 320, 69.4, true),
('LND-18', 'Stuffed Paneer Pockets', 98, 320, 245, 320, 69.4, true),
('LND-19', 'Spicy Chicken Stir-Fry with Peppers, Rice & Fries', 135, 420, 320, 420, 67.9, true),
('LND-20', 'Ugali with Kienyeji Greens', 65, 250, 190, 250, 74.0, true),
('LND-21', 'Biryani Rice', 128, 400, 310, 400, 68.0, true),
('LND-22', 'Bone Broth', 65, 250, 190, 250, 74.0, true),
('LND-23', 'Chicken Soup', 80, 280, 215, 280, 71.4, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 5. DISTRIBUTOR CATEGORIES (from sourcing data)
-- =============================================
INSERT INTO distributor_categories (name, description) VALUES
  ('Dairy & Eggs', 'Milk, butter, cream, cheese, eggs, yoghurt'),
  ('Meat & Poultry', 'Beef, chicken, smokies, processed meats'),
  ('Fish & Seafood', 'Omena, fresh fish, dried fish'),
  ('Grains & Flour', 'Wheat flour, maize flour, rice, lentils, chickpea flour'),
  ('Fresh Produce', 'Vegetables, fruits, herbs, avocados, potatoes'),
  ('Cooking Oils & Fats', 'Cooking oil, olive oil, ghee'),
  ('Spices & Condiments', 'Spice blends, sauces, salt, soy sauce, honey'),
  ('Baking Supplies', 'Sugar, yeast, baking powder, cocoa, chocolate, vanilla'),
  ('Beverages Raw Materials', 'Tea leaves, coffee beans, syrups'),
  ('Packaging', 'Bags, boxes, labels, wrapping materials'),
  ('Equipment & Utensils', 'Ovens, mixers, trays, cookware')
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. DISTRIBUTORS / SUPPLIERS (from catalogue sourcing data + seed data)
-- =============================================
INSERT INTO distributors (name, company_name, category, phone, email, products, payment_terms, status, notes) VALUES
  ('Local Tea Supplier', 'Kenya Tea Suppliers', 'Beverages Raw Materials', '', '', 'Tea leaves (KES 400/kg bulk)', 'Net 30', 'Active', 'Highland tea leaves; key supplier for all tea beverages'),
  ('Kenya Coffee Roaster', 'Local Coffee Roasters', 'Beverages Raw Materials', '', '', 'Kenyan Arabica coffee beans (KES 800/kg bulk)', 'Net 30', 'Active', 'Locally roasted Kenyan Arabica; for espresso, cappuccino, latte, black/white coffee'),
  ('Brookside Dairy', 'Brookside Dairy Ltd', 'Dairy & Eggs', '', '', 'Fresh milk (KES 90/L), butter (KES 800/kg), cream, yoghurt', 'Net 14', 'Active', 'Primary dairy supplier for all milk, butter, cream products'),
  ('Kenchic', 'Kenchic Ltd', 'Dairy & Eggs', '', '', 'Eggs (tray of 30 ~KES 450)', 'Net 14', 'Active', 'Egg supplier; trays of 30'),
  ('Local Butcher', 'Nairobi Meat Suppliers', 'Meat & Poultry', '', '', 'Minced beef (KES 880/kg), beef bone-in (KES 850/kg), chicken legs (KES 600/kg), chicken wings (KES 700/kg)', 'Cash / Net 7', 'Active', 'Bulk meat and poultry; supply for stews, samosas, burgers, grills'),
  ('Smokies Supplier', 'Kenya Smokies Distributor', 'Meat & Poultry', '', '', 'Smokies (KES 350/pack of 10)', 'Net 14', 'Active', 'Bulk smokies for smocha and stir-fry dishes'),
  ('Omena Supplier', 'Lake Victoria Fish Traders', 'Fish & Seafood', '', '', 'Dried omena (KES 200/kg)', 'Cash', 'Active', 'Dried omena from Lake Victoria; for omena stir-fry dish'),
  ('Grain Mills Ltd', 'Grain Mills Ltd', 'Grains & Flour', '', '', 'Wheat flour (KES 75/kg), maize flour (KES 78/kg)', 'Net 30', 'Active', 'Primary flour supplier; wheat and maize flour for chapati, ugali, bread, pastries'),
  ('Rice & Pulses Supplier', 'Kenya Grain Traders', 'Grains & Flour', '', '', 'Basmati rice (KES 140/kg), lentils (KES 100/kg), dried beans (KES 120/kg), chickpea flour, noodles (KES 120/kg)', 'Net 30', 'Active', 'Bulk grains, rice, pulses and noodles for main meals'),
  ('Fresh Produce Market', 'Wakulima Market Traders', 'Fresh Produce', '', '', 'Potatoes (KES 45/kg), tomatoes, onions, cabbage, carrots (KES 40/kg), spinach (KES 50/kg), avocado (KES 30/pc), lemons (KES 8/pc), sukuma wiki (KES 30/kg), kienyeji greens (KES 40/kg), peppers, strawberries (KES 200/kg)', 'Cash', 'Active', 'Daily fresh produce sourcing; all vegetables, fruits, herbs'),
  ('Cooking Oil Supplier', 'Kenya Oil Distributors', 'Cooking Oils & Fats', '', '', 'Cooking oil (20L ~KES 3800), olive oil, ghee', 'Net 14', 'Active', 'Bulk cooking oil for frying, baking, and cooking'),
  ('Spice & Condiments Supplier', 'Nairobi Spice Traders', 'Spices & Condiments', '', '', 'Cardamom, cumin, ginger, pilau masala, biryani spices, soy sauce, sesame oil, chilli, paprika, cinnamon', 'Net 30', 'Active', 'Full range of spices and condiments for all menu items'),
  ('Mumias Sugar', 'Mumias Sugar Company', 'Baking Supplies', '', '', 'White sugar, brown sugar', 'Net 30', 'Active', 'Primary sugar supplier'),
  ('Baking Supplies Dealer', 'Import Supplier', 'Baking Supplies', '', '', 'Cocoa powder (KES 800/kg), chocolate chips, vanilla extract (KES 1200/L), baking powder, yeast, food colouring', 'Net 30', 'Active', 'Imported baking supplies and flavourings'),
  ('Cheese & Paneer Supplier', 'Kenya Dairy Specialty', 'Dairy & Eggs', '', '', 'Cheese (KES 900/kg), processed cheese, paneer (KES 700/kg), feta, mozzarella, sour cream', 'Net 14', 'Active', 'Specialty dairy products for pizzas, burgers, paneer dishes, noodles'),
  ('Packaging Co', 'Packaging Co Ltd', 'Packaging', '', '', 'Bread bags, cake boxes, paper bags, takeaway containers', 'Net 30', 'Active', 'All packaging materials for products and takeaway'),
  ('Mayo & Sauces Supplier', 'FMCG Distributor', 'Spices & Condiments', '', '', 'Mayonnaise (KES 400/kg), ketchup, chilli sauce, tamarind sauce', 'Net 14', 'Active', 'Bulk sauces and condiments for sandwiches, burgers, dips')
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. INVENTORY ITEMS FOR KEY CATALOGUE INGREDIENTS
-- (Supplements existing seed inventory items)
-- =============================================
INSERT INTO inventory_items (name, type, category, quantity, unit, unit_cost, reorder_level, supplier, last_restocked) VALUES
  -- Beverages ingredients
  ('Tea Leaves (Premium Kenya)', 'Consumable', 'Raw Materials', 10, 'kg', 400, 3, 'Local Tea Supplier', CURRENT_DATE),
  ('Coffee Beans (Kenya Arabica)', 'Consumable', 'Raw Materials', 10, 'kg', 800, 3, 'Kenya Coffee Roaster', CURRENT_DATE),
  ('Honey', 'Consumable', 'Raw Materials', 5, 'kg', 600, 2, 'Fresh Produce Market', CURRENT_DATE),
  ('Fresh Lemons', 'Consumable', 'Raw Materials', 50, 'pcs', 8, 20, 'Fresh Produce Market', CURRENT_DATE),
  -- Proteins
  ('Minced Beef', 'Consumable', 'Raw Materials', 20, 'kg', 880, 5, 'Local Butcher', CURRENT_DATE),
  ('Beef Bone-in', 'Consumable', 'Raw Materials', 20, 'kg', 850, 5, 'Local Butcher', CURRENT_DATE),
  ('Chicken Legs', 'Consumable', 'Raw Materials', 15, 'kg', 600, 5, 'Local Butcher', CURRENT_DATE),
  ('Chicken Wings', 'Consumable', 'Raw Materials', 10, 'kg', 700, 3, 'Local Butcher', CURRENT_DATE),
  ('Smokies (Pack of 10)', 'Consumable', 'Raw Materials', 20, 'packs', 350, 5, 'Smokies Supplier', CURRENT_DATE),
  ('Dried Omena', 'Consumable', 'Raw Materials', 5, 'kg', 200, 2, 'Omena Supplier', CURRENT_DATE),
  -- Grains & Staples
  ('Maize Flour', 'Consumable', 'Raw Materials', 100, 'kg', 78, 20, 'Grain Mills Ltd', CURRENT_DATE),
  ('Basmati Rice', 'Consumable', 'Raw Materials', 50, 'kg', 140, 10, 'Rice & Pulses Supplier', CURRENT_DATE),
  ('Lentils', 'Consumable', 'Raw Materials', 20, 'kg', 100, 5, 'Rice & Pulses Supplier', CURRENT_DATE),
  ('Dried Beans', 'Consumable', 'Raw Materials', 20, 'kg', 120, 5, 'Rice & Pulses Supplier', CURRENT_DATE),
  ('Chickpea Flour (Besan)', 'Consumable', 'Raw Materials', 10, 'kg', 150, 3, 'Rice & Pulses Supplier', CURRENT_DATE),
  ('Noodles', 'Consumable', 'Raw Materials', 10, 'kg', 120, 3, 'Rice & Pulses Supplier', CURRENT_DATE),
  -- Fresh Produce
  ('Potatoes', 'Consumable', 'Raw Materials', 100, 'kg', 45, 20, 'Fresh Produce Market', CURRENT_DATE),
  ('Tomatoes', 'Consumable', 'Raw Materials', 30, 'kg', 50, 10, 'Fresh Produce Market', CURRENT_DATE),
  ('Onions', 'Consumable', 'Raw Materials', 50, 'kg', 40, 10, 'Fresh Produce Market', CURRENT_DATE),
  ('Cabbage', 'Consumable', 'Raw Materials', 20, 'kg', 30, 5, 'Fresh Produce Market', CURRENT_DATE),
  ('Carrots', 'Consumable', 'Raw Materials', 20, 'kg', 40, 5, 'Fresh Produce Market', CURRENT_DATE),
  ('Fresh Spinach', 'Consumable', 'Raw Materials', 10, 'kg', 50, 3, 'Fresh Produce Market', CURRENT_DATE),
  ('Avocados', 'Consumable', 'Raw Materials', 30, 'pcs', 30, 10, 'Fresh Produce Market', CURRENT_DATE),
  ('Sukuma Wiki (Collard Greens)', 'Consumable', 'Raw Materials', 15, 'kg', 30, 5, 'Fresh Produce Market', CURRENT_DATE),
  ('Kienyeji Greens', 'Consumable', 'Raw Materials', 10, 'kg', 40, 3, 'Fresh Produce Market', CURRENT_DATE),
  ('Bell Peppers', 'Consumable', 'Raw Materials', 10, 'kg', 80, 3, 'Fresh Produce Market', CURRENT_DATE),
  ('Strawberries', 'Consumable', 'Raw Materials', 5, 'kg', 200, 2, 'Fresh Produce Market', CURRENT_DATE),
  -- Oils & Dairy
  ('Cooking Oil (20L)', 'Consumable', 'Raw Materials', 3, 'drums', 3800, 1, 'Cooking Oil Supplier', CURRENT_DATE),
  ('Cheese (Cheddar/Mozzarella)', 'Consumable', 'Dairy & Eggs', 10, 'kg', 900, 3, 'Cheese & Paneer Supplier', CURRENT_DATE),
  ('Paneer', 'Consumable', 'Dairy & Eggs', 5, 'kg', 700, 2, 'Cheese & Paneer Supplier', CURRENT_DATE),
  -- Spices & Condiments
  ('Cardamom', 'Consumable', 'Flavoring & Additives', 2, 'kg', 1500, 1, 'Spice & Condiments Supplier', CURRENT_DATE),
  ('Pilau Masala', 'Consumable', 'Flavoring & Additives', 3, 'kg', 500, 1, 'Spice & Condiments Supplier', CURRENT_DATE),
  ('Biryani Spice Mix', 'Consumable', 'Flavoring & Additives', 2, 'kg', 600, 1, 'Spice & Condiments Supplier', CURRENT_DATE),
  ('Soy Sauce', 'Consumable', 'Flavoring & Additives', 5, 'L', 200, 2, 'Spice & Condiments Supplier', CURRENT_DATE),
  ('Mayonnaise', 'Consumable', 'Flavoring & Additives', 5, 'kg', 400, 2, 'Mayo & Sauces Supplier', CURRENT_DATE),
  ('Coconut Milk', 'Consumable', 'Raw Materials', 10, 'L', 150, 3, 'Fresh Produce Market', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Done! All 57 catalogue products, pricing tiers, distributor categories,
-- 17 distributors/suppliers, and 36 additional inventory items have been inserted.
