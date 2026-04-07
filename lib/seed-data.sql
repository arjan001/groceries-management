-- =============================================
-- SNACKOH BAKERY - SEED DATA
-- Run AFTER supabase-schema.sql
-- =============================================

-- ── Employees ──
INSERT INTO employees (first_name, last_name, designation, email, phone, department, role, category, hire_date, status, id_number, bank_name, bank_account_no, nhif_no, nssf_no, kra_pin, next_of_kin, next_of_kin_phone, address) VALUES
('John', 'Mwangi', 'Mr', 'john@snackoh.com', '+254712345678', 'Production', 'Head Baker', 'Baker', '2024-01-15', 'Active', 'ID12345678', 'KCB', '1234567890', 'NHIF-001', 'NSSF-001', 'A001234567Z', 'Jane Mwangi', '+254798765432', 'Nairobi'),
('Mary', 'Kipchoge', 'Mrs', 'mary@snackoh.com', '+254723456789', 'Sales', 'Cashier', 'Sales', '2024-02-01', 'Active', 'ID23456789', 'Equity', '2345678901', 'NHIF-002', 'NSSF-002', 'B002345678Z', 'Tom Kipchoge', '+254787654321', 'Nairobi'),
('Peter', 'Odhiambo', 'Mr', 'peter@snackoh.com', '+254734567890', 'Delivery', 'Delivery Rider', 'Driver', '2024-02-15', 'Active', 'ID34567890', 'NCBA', '3456789012', 'NHIF-003', 'NSSF-003', 'C003456789Z', 'Grace Odhiambo', '+254776543210', 'Mombasa Rd'),
('Sarah', 'Wanjiku', 'Ms', 'sarah@snackoh.com', '+254745678901', 'Production', 'Assistant Baker', 'Baker', '2024-03-01', 'Active', 'ID45678901', 'KCB', '4567890123', 'NHIF-004', 'NSSF-004', 'D004567890Z', 'James Wanjiku', '+254765432109', 'Westlands'),
('David', 'Kamau', 'Mr', 'david@snackoh.com', '+254756789012', 'Administration', 'Admin Manager', 'Manager', '2024-01-01', 'Active', 'ID56789012', 'Equity', '5678901234', 'NHIF-005', 'NSSF-005', 'E005678901Z', 'Lucy Kamau', '+254754321098', 'Karen');

-- ── Customers ──
INSERT INTO customers (name, type, phone, email, location, purchase_volume, rating) VALUES
('Walk-in Customer', 'Retail', '', '', 'Counter', 0, 0),
('Naivas Supermarket', 'Wholesale', '+254700111222', 'orders@naivas.co.ke', 'Nairobi CBD', 5000, 4.8),
('Java House', 'Wholesale', '+254700222333', 'supply@javahouse.co.ke', 'Westlands', 3000, 4.5),
('QuickMart', 'Wholesale', '+254700333444', 'procurement@quickmart.co.ke', 'Langata', 2500, 4.2),
('Mrs. Wambui Shop', 'Retail', '+254712000111', '', 'Kangemi', 500, 4.0),
('Kiosk Corner Store', 'Retail', '+254712000222', '', 'Kawangware', 300, 3.8);

-- ── Inventory Categories ──
INSERT INTO inventory_categories (name, type, description) VALUES
('Raw Materials', 'Consumable', 'Flour, sugar, yeast, etc'),
('Dairy & Eggs', 'Consumable', 'Milk, butter, eggs, cream'),
('Packaging', 'Consumable', 'Bread bags, boxes, paper, labels'),
('Flavoring & Additives', 'Consumable', 'Vanilla, cocoa, food coloring'),
('Equipment', 'Non-Consumable', 'Ovens, mixers, machinery'),
('Utensils', 'Non-Consumable', 'Baking trays, spatulas, molds');

-- ── Inventory Items ──
INSERT INTO inventory_items (name, type, category, quantity, unit, unit_cost, reorder_level, supplier, last_restocked) VALUES
('Bread Flour (All Purpose)', 'Consumable', 'Raw Materials', 500, 'kg', 45, 100, 'Grain Mills Ltd', '2024-02-15'),
('Sugar (White)', 'Consumable', 'Raw Materials', 200, 'kg', 60, 50, 'Mumias Sugar', '2024-02-10'),
('Yeast (Active Dry)', 'Consumable', 'Raw Materials', 20, 'kg', 500, 5, 'Lesaffre Kenya', '2024-02-12'),
('Salt (Fine)', 'Consumable', 'Raw Materials', 50, 'kg', 30, 10, 'Kensalt', '2024-02-01'),
('Baking Powder', 'Consumable', 'Raw Materials', 15, 'kg', 300, 3, 'Local Supplier', '2024-02-05'),
('Butter (Unsalted)', 'Consumable', 'Dairy & Eggs', 100, 'kg', 350, 20, 'Brookside Dairy', '2024-02-14'),
('Eggs (Large)', 'Consumable', 'Dairy & Eggs', 50, 'trays', 450, 10, 'Kenchic', '2024-02-15'),
('Fresh Milk', 'Consumable', 'Dairy & Eggs', 100, 'L', 55, 20, 'Brookside Dairy', '2024-02-15'),
('Cocoa Powder', 'Consumable', 'Flavoring & Additives', 10, 'kg', 800, 3, 'Import Supplier', '2024-02-01'),
('Vanilla Extract', 'Consumable', 'Flavoring & Additives', 5, 'L', 1200, 1, 'Import Supplier', '2024-01-20'),
('Bread Bags (Medium)', 'Consumable', 'Packaging', 5000, 'pieces', 2, 1000, 'Packaging Co', '2024-02-10'),
('Bread Bags (Large)', 'Consumable', 'Packaging', 3000, 'pieces', 3, 500, 'Packaging Co', '2024-02-10'),
('Cake Boxes (8 inch)', 'Consumable', 'Packaging', 200, 'pieces', 25, 50, 'Packaging Co', '2024-02-05'),
('Cake Boxes (10 inch)', 'Consumable', 'Packaging', 100, 'pieces', 35, 30, 'Packaging Co', '2024-02-05'),
('Paper Bags (Brown)', 'Consumable', 'Packaging', 2000, 'pieces', 5, 500, 'Packaging Co', '2024-02-08'),
('Sticker Labels', 'Consumable', 'Packaging', 10, 'rolls', 350, 2, 'Print Shop', '2024-01-25'),
('Baking Trays (Full)', 'Non-Consumable', 'Utensils', 20, 'pieces', 1500, 5, 'Equipment Dealer', '2024-01-01'),
('Mixing Bowls (Large)', 'Non-Consumable', 'Utensils', 10, 'pieces', 800, 3, 'Equipment Dealer', '2024-01-01'),
('Industrial Oven', 'Non-Consumable', 'Equipment', 2, 'units', 150000, 1, 'Oven Suppliers Ltd', '2024-01-01'),
('Dough Mixer (50L)', 'Non-Consumable', 'Equipment', 1, 'units', 85000, 1, 'Equipment Dealer', '2024-01-01');

-- ── Pricing Tiers ──
INSERT INTO pricing_tiers (product_code, product_name, cost, base_price, wholesale_price, retail_price, margin, active) VALUES
('WB-001', 'White Bread (400g)', 85, 200, 150, 200, 57.5, true),
('WB-002', 'White Bread (800g)', 140, 350, 280, 350, 60.0, true),
('BB-001', 'Brown Bread (400g)', 90, 220, 170, 220, 59.1, true),
('CR-001', 'Butter Croissant', 45, 150, 100, 150, 70.0, true),
('CR-002', 'Chocolate Croissant', 55, 180, 130, 180, 69.4, true),
('MF-001', 'Blueberry Muffin', 35, 120, 90, 120, 70.8, true),
('MF-002', 'Chocolate Muffin', 35, 120, 90, 120, 70.8, true),
('DN-001', 'Glazed Donut', 20, 50, 35, 50, 60.0, true),
('DN-002', 'Chocolate Donut', 25, 60, 45, 60, 58.3, true),
('BG-001', 'Plain Bagel', 30, 100, 75, 100, 70.0, true),
('CC-001', 'Chocolate Cake (8")', 350, 1500, 1200, 1500, 76.7, true),
('CC-002', 'Vanilla Cake (8")', 320, 1400, 1100, 1400, 77.1, true),
('BN-001', 'Dinner Rolls (6 pack)', 60, 180, 140, 180, 66.7, true),
('SC-001', 'Cheese Scone', 25, 80, 60, 80, 68.8, true),
('PT-001', 'Sausage Roll', 30, 100, 75, 100, 70.0, true);

-- ── Recipes ──
INSERT INTO recipes (name, code, product_type, batch_size, expected_output, output_unit, instructions, prep_time, bake_time, bake_temp, status) VALUES
('Standard White Bread', 'WB-001', 'White Bread', 1, 10, 'loaves', '1. Mix dry ingredients 2. Add water and butter 3. Knead 10 min 4. Rise 1hr 5. Shape loaves 6. Bake at 200C for 35 min', 90, 35, 200, 'active'),
('Butter Croissant', 'CR-001', 'Croissant', 1, 24, 'pieces', '1. Make dough 2. Laminate with butter 3. Shape croissants 4. Proof 1hr 5. Egg wash 6. Bake at 200C for 15 min', 180, 15, 200, 'active'),
('Chocolate Muffin', 'MF-002', 'Muffin', 1, 24, 'pieces', '1. Mix dry ingredients 2. Combine wet ingredients 3. Fold together 4. Fill tins 5. Bake at 180C for 20 min', 20, 20, 180, 'active'),
('Dinner Rolls', 'BN-001', 'Buns', 1, 30, 'pieces', '1. Mix dough 2. Knead 8 min 3. Rise 45 min 4. Shape rolls 5. Rise 20 min 6. Bake at 190C for 18 min', 75, 18, 190, 'active'),
('Glazed Donut', 'DN-001', 'Donut', 1, 36, 'pieces', '1. Make dough 2. Rise 1hr 3. Roll and cut rings 4. Rise 30 min 5. Deep fry 6. Glaze', 60, 5, 180, 'active');

-- ── Food Info ──
INSERT INTO food_info (product_name, code, allergens, calories, protein, fat, carbs, shelf_life_days, certification) VALUES
('White Bread', 'WB-001', ARRAY['Gluten'], 265, 9, 3.2, 49, 3, 'KEBS Certified'),
('Butter Croissant', 'CR-001', ARRAY['Gluten','Dairy','Eggs'], 406, 8, 21, 45, 2, 'KEBS Certified'),
('Chocolate Muffin', 'MF-002', ARRAY['Gluten','Dairy','Eggs'], 340, 5, 14, 50, 3, 'KEBS Certified'),
('Glazed Donut', 'DN-001', ARRAY['Gluten','Dairy'], 290, 4, 15, 35, 2, 'KEBS Certified'),
('Plain Bagel', 'BG-001', ARRAY['Gluten'], 245, 10, 1.5, 48, 3, 'KEBS Certified');

-- ── Creditors ──
INSERT INTO creditors (supplier_name, total_credit, credit_days, next_payment_date, status) VALUES
('Grain Mills Ltd', 120000, 30, '2024-03-15', 'Current'),
('Brookside Dairy', 45000, 14, '2024-03-01', 'Current'),
('Packaging Co', 25000, 30, '2024-03-20', 'Current');

-- ── Debtors ──
INSERT INTO debtors (name, total_debt, debt_days, last_payment_date, status) VALUES
('Naivas Supermarket', 85000, 15, '2024-02-20', 'Current'),
('Java House', 42000, 7, '2024-02-25', 'Current');

-- ── Asset Categories ──
INSERT INTO asset_categories (name, description) VALUES
('Equipment', 'Production machinery and equipment'),
('Vehicles', 'Delivery vehicles and transport'),
('Furniture', 'Office and production furniture'),
('Electronics', 'Computers, POS terminals, printers');

-- ── Assets ──
INSERT INTO assets (name, category, serial_number, purchase_date, purchase_price, current_value, condition, location, assigned_to, notes) VALUES
('Industrial Oven (Main)', 'Equipment', 'IOV-2024-001', '2024-01-15', 150000, 140000, 'Excellent', 'Production Floor', 'John Mwangi', 'Main bakery oven'),
('Dough Mixer 50L', 'Equipment', 'MIX-2024-001', '2024-01-15', 85000, 80000, 'Good', 'Production Floor', 'John Mwangi', 'Primary mixer'),
('Delivery Van', 'Vehicles', 'VAN-2024-001', '2024-02-01', 1200000, 1100000, 'Good', 'Parking', 'Peter Odhiambo', 'Main delivery vehicle'),
('POS Terminal', 'Electronics', 'POS-2024-001', '2024-01-20', 35000, 32000, 'Excellent', 'Sales Counter', 'Mary Kipchoge', 'Touchscreen POS'),
('Receipt Printer', 'Electronics', 'PRT-2024-001', '2024-01-20', 12000, 11000, 'Good', 'Sales Counter', 'Mary Kipchoge', 'Thermal receipt printer');

-- ── P&L Reports ──
INSERT INTO pl_reports (period, revenue, costs, profit, margin) VALUES
('January 2024', 500000, 300000, 200000, 40.0),
('February 2024', 620000, 350000, 270000, 43.5);
