# Snackoh Bakers - Employee Training Manual

## System Overview

The Snackoh Bakers Management System is a comprehensive bakery ERP (Enterprise Resource Planning) and e-commerce platform purpose-built for bakery operations of all sizes. It integrates every aspect of the business into a single, unified system -- from recipe development and production scheduling to point-of-sale transactions, delivery logistics, multi-branch management, and financial accounting.

The platform is designed around role-based access control, ensuring each employee sees only the tools and data relevant to their job. Whether you are a baker managing production runs, a cashier processing in-store sales, a delivery rider tracking assignments, or an administrator overseeing the entire operation, the system adapts to your needs.

**Key system capabilities include:**
- **Production Pipeline:** Manage recipes, schedule production batches, generate picking lists, and track lot numbers for full traceability from raw ingredients to finished products.
- **Sales & Commerce:** Process in-store sales via the POS system, manage online orders with M-Pesa payments, track order status, and handle delivery logistics end-to-end.
- **Inventory Management:** Track raw materials, packaging, and finished goods across all locations. Automated reorder alerts, supplier management, purchase orders, and asset tracking keep operations running smoothly.
- **Multi-Branch Operations:** Manage multiple bakery outlets with independent inventory, product catalogs, requisition workflows, employee assignments, and branch-level reporting.
- **Financial Management:** Record and categorize expenses, manage debtors and creditors, generate financial reports, and maintain a general ledger for accounting.
- **People & Compliance:** Comprehensive employee management, productivity reporting, granular roles and permissions, full audit logging, and food safety documentation.
- **E-Commerce Storefront:** A public-facing website where customers can browse products, place orders, and pay via M-Pesa with real-time order tracking.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [System Setup Guide (First-Time Setup)](#2-system-setup-guide-first-time-setup)
3. [Employee Roles](#3-employee-roles)
4. [Dashboard](#4-dashboard)
5. [POS System (Point of Sale)](#5-pos-system)
6. [Production Modules](#6-production-modules)
7. [Sales & Orders Modules](#7-sales--orders-modules)
8. [Inventory Modules](#8-inventory-modules)
9. [Outlet (Branch) Modules](#9-outlet-branch-modules)
10. [Finance Modules](#10-finance-modules)
11. [People Management Modules](#11-people-management-modules)
12. [System & Settings Modules](#12-system--settings-modules)
13. [E-Commerce Website](#13-e-commerce-website)
14. [Roles & Permissions Guide (Admin)](#14-roles--permissions-guide)
15. [Security Best Practices](#15-security-best-practices)
16. [Tips & Tricks](#16-tips--tricks)
17. [Troubleshooting](#17-troubleshooting)
18. [Glossary](#glossary)

---

## 1. Getting Started

This section walks you through the essential first steps to begin using the Snackoh Bakers Management System, from logging in for the first time to navigating the interface and installing the system as a standalone application on your device.

### Logging In

1. Open your web browser and navigate to the Snackoh Bakers system URL.
2. Click the **Staff Admin** icon (person icon) in the top-right of the website, or go directly to \`/auth/login\`.
3. Enter your **email address** and **password** provided by your administrator.
4. Click **Sign In**.

If you cannot log in:
- Make sure your email is correct (check with your manager).
- Your account must have **System Access** enabled by an administrator.
- If your password is forgotten, contact your administrator for a reset.
- Note: The system uses Supabase authentication with server-side session management, so your login is secure and encrypted.

### Your Account Settings

Once logged in, go to **Account Settings** (bottom of the sidebar) to:
- View your profile information.
- Update your password.
- Manage your certificates and personal info.

![Account Settings — View and manage your profile, password, and personal information](/docs/account-settings.png)
*Figure 1: Account Settings page where employees can update their profile and password.*

### Navigation

- The **sidebar** (left panel) shows only the modules you have access to.
- The **header** (top bar) shows your name, role, notifications, and logout option.
- Click the **collapse button** (arrow) to minimize the sidebar for more screen space.
- If you see a notification bell ringing red, there is a new online order waiting for review.

### Installing the App

The system can be installed as an app on your phone or computer:
1. Look for the **Install App** button in the sidebar or header.
2. Click it to install the system as a standalone app.
3. You can then access it directly from your home screen.

---

## 2. System Setup Guide (First-Time Setup)

This section is the step-by-step process guide for setting up the Snackoh Bakers system from scratch. Follow these phases in order. Each phase builds on the previous one, so do not skip ahead. By the end, your products will appear on the public-facing website and the bakery will be ready for daily operations.

> **Important:** You do not need to wait for production batches to display products on the website. As long as a product is registered in the Product Catalogue (Food Info), it will appear on the shop -- even with zero stock. Products with zero inventory show as "Sold Out" and customers can still view them, they just cannot add them to the cart until stock is available.

---

### Phase 1: Administrator Account and System Access

**What you need:** A working system deployment with the database schema applied.

**Why this comes first:** Nothing else in the system can be configured without an administrator account. The administrator role has full access to every module and is required to set up everything that follows.

**Steps:**

1. Navigate to the system URL and go to **Login** (`/auth/login`).
2. If this is a brand-new deployment, use the signup flow or the admin create-user API to create the first **Administrator** account.
3. Log in with the administrator credentials.
4. Go to **Account Settings** and verify your profile details are correct.

**Result:** You now have full admin access to the system and can proceed with configuration.

---

### Phase 2: Roles, Permissions, and Employee Setup

**What you need:** Phase 1 complete (admin account active).

**Why this comes second:** Employees need accounts to operate different parts of the system. Setting up roles and permissions before adding employees ensures each person gets the correct access from day one.

**Steps:**

1. Go to **Admin > Roles & Permissions**.
2. Review the default roles (Administrator, Manager, Baker, Cashier, Sales, Rider, Viewer). These are pre-configured with appropriate permissions for each job function.
3. If you need custom roles (e.g., Branch Manager, Inventory Clerk), create them here and assign the relevant permissions.
4. Go to **Admin > Employees**.
5. Add each employee with their personal details, role assignment, and contact information.
6. For employees who need to log in to the system, ensure **System Access** is enabled and they have login credentials (email and password).
7. Assign each employee to the appropriate role (Baker, Cashier, etc.).

**Key roles to fill at minimum:**
- At least one **Administrator** (already done in Phase 1)
- **Bakers** for production management
- **Cashiers** for POS operations
- **Sales** staff for order management (if applicable)
- **Riders/Drivers** for delivery (if applicable)

**Result:** Your team can now log in with appropriate access levels. Each employee sees only the modules relevant to their role.

---

### Phase 3: Main Bakery Outlet Setup

**What you need:** Phase 2 complete.

**Why this comes third:** The outlet (branch) is the physical location where production, sales, and inventory happen. Many other modules reference the outlet, so it must exist before you proceed.

**Steps:**

1. Go to **Admin > Branch Management** (under Outlets).
2. Create the **main bakery** as your primary outlet. Set the type to "Bakery" and mark it as the primary location.
3. Add the bakery's address, phone number, and operating hours.
4. If you have additional branches (coffee shops, retail outlets, satellite kitchens), add those as secondary outlets.
5. Go to **Branch Employees** and assign employees to their respective outlets.

**Result:** Your physical locations are registered in the system and employees are linked to specific branches.

---

### Phase 4: Suppliers and Inventory (Raw Materials)

**What you need:** Phase 3 complete.

**Why this comes fourth:** Recipes need ingredients, and ingredients come from inventory. You must set up your raw material inventory before you can create recipes with accurate costing.

**Steps:**

1. **Add Suppliers** -- Go to **Admin > Suppliers** (under Inventory) and add your ingredient and packaging suppliers with contact details and payment terms.
2. **Set Up Inventory Categories** -- Go to **Admin > Inventory** and create categories for your raw materials (e.g., Flour & Grains, Dairy, Sugars & Sweeteners, Fats & Oils, Packaging, Flavourings, Fruits & Fillings).
3. **Add Inventory Items** -- For each raw material and packaging item you use:
   - Enter the item name, SKU/code, category, and unit of measurement (kg, litres, pieces, etc.).
   - Set the current stock quantity (enter 0 if you have not purchased yet).
   - Set the **reorder level** (the minimum stock that triggers a reorder alert).
   - Set the **cost per unit** -- this is critical because recipe costing depends on it.
   - Link the item to its supplier.

**Common inventory items to add first:**
- Wheat flour, sugar, salt, yeast, baking powder
- Butter, margarine, cooking oil, eggs, milk, cream
- Chocolate, vanilla extract, food colouring
- Packaging: bread bags, cake boxes, pastry trays, labels

**Result:** Your raw material inventory is set up with costs. The system can now calculate recipe costs accurately and alert you when stock is low.

---

### Phase 5: Recipes (Product Definitions with Costing)

**What you need:** Phase 4 complete (inventory items with costs).

**Why this comes fifth:** Recipes define *what* you make and *how much it costs* to make it. Each recipe links to inventory items (ingredients) and calculates the cost per batch. This cost data flows into pricing and ultimately determines your profit margins.

**Steps:**

1. Go to **Admin > Recipes & Products** (under Production).
2. Click **Add New Recipe**.
3. For each recipe, fill in:
   - **Recipe name** (e.g., "White Bread Loaf", "Butter Croissant", "Chocolate Cake")
   - **Recipe code** (a short identifier, e.g., "WBL-001")
   - **Category** (Bread, Pastry, Cake, Cookies, Donuts, etc.)
   - **Batch size** (how many units one batch produces, e.g., 20 loaves)
   - **Preparation time** and **Bake time** (in minutes)
   - **Bake temperature** (in degrees Celsius)
4. **Add Ingredients** to the recipe:
   - Select each ingredient from your inventory items (added in Phase 4).
   - Enter the quantity needed per batch and the unit.
   - The system auto-calculates the cost per ingredient based on your inventory cost-per-unit.
   - The total batch cost and cost-per-unit are calculated automatically.
5. Repeat for every product you make.

**Tip:** Use the **AI Recipe Generation** tool to speed things up -- it can auto-generate ingredient lists and costing estimates for common bakery products. You can then refine the generated recipe to match your exact formulations.

**Result:** All your product recipes are defined with accurate ingredient costs. The system knows exactly what goes into each product and what it costs to produce.

---

### Phase 6: Pricing Tiers

**What you need:** Phase 5 complete (recipes with calculated costs).

**Why this comes sixth:** Pricing determines what you charge for each product across different sales channels. Without pricing, products on the website will display a default placeholder price. Pricing tiers allow different rates for retail customers, wholesale buyers, and internal costing.

**Steps:**

1. Go to **Admin > Pricing** (under Sales & Orders).
2. For each recipe/product, set up a pricing tier:
   - **Cost price** (auto-populated from recipe ingredient costs).
   - **Base price** (your standard markup over cost).
   - **Wholesale price** (discounted rate for bulk/trade buyers).
   - **Retail price** (the price customers see on the website and POS).
3. Mark the pricing tier as **Active**.

**Pricing guidance:**
- The **retail price** is what appears on the public website shop page.
- The **wholesale price** is used for B2B orders and outlet transfers.
- If no pricing tier exists for a product, the website will show a default placeholder price -- so always set pricing before going live.

**Result:** Every product now has defined pricing for all sales channels. The retail price is what customers will see on the website.

---

### Phase 7: Product Catalogue (Food Info) -- Products Go Live on the Website

**What you need:** Phase 5 and Phase 6 complete (recipes and pricing set up).

**Why this is the critical step:** The **Product Catalogue (Food Info)** is the master product registry that powers the public website. When you add a product here, it becomes visible on the `/shop` page immediately. This is the module that makes products appear for customers.

**Steps:**

1. Go to **Admin > Product Catalogue** (under Production).
2. Click **Add Product**.
3. For each product, fill in:
   - **Product Name** (required -- this is the only strictly mandatory field).
   - **Product Code** (auto-generated if left blank).
   - **Link to Recipe** (select the recipe from Phase 5 -- recommended for traceability).
   - **Image** (upload a product photo or the system uses a category-appropriate placeholder).
   - **Description** (what customers see on the shop page).
   - **Current Stock** (set to 0 if you have not produced yet -- the product will show as "Sold Out" on the website, which is fine for initial setup).
   - **Stock Unit** (pieces, kg, boxes, etc.).
   - **Shelf Life** (in days -- shown to customers in product details).
   - **Allergen Information** (gluten, dairy, eggs, nuts, soy, etc. -- important for food safety).
   - **Nutritional Information** (calories, protein, fat, carbs -- optional but recommended).
   - **Dietary Labels** (halal, vegan, gluten-free, organic, etc.).
   - **Reorder Level** (when stock drops below this, you get an alert).
4. Save the product.

**What happens on the website:**
- The product immediately appears on the `/shop` page.
- If `current_stock > 0`: The product shows as available with an "Add to Cart" button.
- If `current_stock = 0`: The product shows as **"Sold Out"** -- customers can see it and view details, but cannot purchase until stock is added.
- The product image, name, price (from pricing tiers), and category are all displayed.
- Products are automatically categorized by name (Bread, Pastry, Cake, Cookies, Donuts) for filtering.

**Result:** Your products are now visible on the public website. Customers can browse your full product range even before you start production -- products with zero stock simply show as "Sold Out".

---

### Phase 8: Business Settings and Delivery Configuration

**What you need:** Phase 7 complete.

**Why this comes eighth:** Before customers can complete purchases, the system needs delivery fees, operating hours, and payment configuration in place.

**Steps:**

1. Go to **Admin > Settings** (under System).
2. Configure **Business Settings:**
   - Business name, logo, and contact information.
   - Operating hours and days.
   - Receipt format and branding.
   - Currency settings (KES).
3. Configure **Delivery Settings:**
   - Delivery fee (flat rate or distance-based).
   - Minimum order amount for delivery.
   - Free delivery threshold (e.g., orders over KES 2,000 get free delivery).
   - Delivery areas/zones.
4. Verify **M-Pesa Settings** are configured (environment variables or database settings) for customer payments.

**Result:** The checkout flow is fully functional. Customers can place orders, select delivery or pickup, and pay via M-Pesa.

---

### Phase 9: Start Production (Products Become Available for Purchase)

**What you need:** All previous phases complete.

**Why this comes last for operations:** Now that everything is configured, you can begin actual production. Completed production runs update product stock, which changes "Sold Out" products to "Available" on the website.

**Steps:**

1. Go to **Admin > Production Runs** (under Production).
2. Click **Add Production Run** and create a batch:
   - Select the product/recipe to produce.
   - Enter the planned quantity.
   - Set the scheduled date and time.
   - Status starts as **Planned**.
3. When bakers begin the batch, update the status to **In Progress**.
4. When the batch is complete, update the status to **Completed** and record the actual output.
5. The system generates a **Picking List** (ingredient requirements) automatically.
6. Go to **Lot Tracking** and record the lot number, production date, and expiry date for the finished batch.
7. Update the product's **current stock** in the Product Catalogue to reflect the produced quantity.

**What happens on the website:**
- Once `current_stock` is updated to a value greater than 0, the product changes from "Sold Out" to **available for purchase**.
- Customers can now add it to their cart and complete checkout.

**Result:** Products are in stock and available for sale on the website and through POS.

---

### Quick Reference: Setup Order at a Glance

| Phase | Module | What to Do | Depends On |
|-------|--------|-----------|------------|
| 1 | Login / Auth | Create administrator account | Database deployed |
| 2 | Roles & Permissions, Employees | Set up roles, add employees with system access | Phase 1 |
| 3 | Branch Management | Create main bakery outlet, assign employees | Phase 2 |
| 4 | Suppliers, Inventory | Add suppliers, raw materials with costs | Phase 3 |
| 5 | Recipes & Products | Create recipes with ingredients from inventory | Phase 4 |
| 6 | Pricing | Set retail, wholesale, and cost prices per product | Phase 5 |
| 7 | Product Catalogue (Food Info) | Register products -- they appear on website immediately | Phase 5 & 6 |
| 8 | Settings | Configure delivery fees, business hours, M-Pesa | Phase 7 |
| 9 | Production Runs | Produce batches, update stock -- products become purchasable | All above |

### What If I Want to Skip Ahead?

- **Can I add products without recipes?** Yes. The Product Catalogue (Food Info) does not strictly require a linked recipe. You can add a product with just a name, image, and price. However, you will lose recipe costing, ingredient tracking, and production run integration.
- **Can I display products with zero stock?** Yes. Products with `current_stock = 0` appear on the website as "Sold Out". This is useful for showing customers your full range while you are still setting up production.
- **Can I skip inventory setup?** You can, but recipe costing will not work without ingredient costs from inventory. You can always go back and add inventory items later.
- **Do I need all employees set up before adding products?** No. Only an administrator account is needed to set up the system. Other employees can be added at any time.
- **Can I add outlets later?** Yes. Multi-branch management is optional and can be configured whenever you expand to additional locations.

---

## 3. Employee Roles

The Snackoh Bakers Management System uses a role-based access control (RBAC) model to ensure that every employee sees only the modules and data relevant to their responsibilities. Each employee is assigned a single login role that determines their default module access, and administrators can further fine-tune access using granular permissions. This approach maximizes security while keeping the interface clean and focused for each user.

Each employee is assigned a role that determines what they can see and do in the system. Here are the standard roles:

### Administrator / Super Admin
- **Full access** to all modules and settings.
- Can manage employees, roles, permissions, and system configuration.
- Can impersonate other users for troubleshooting.
- Both "Admin", "Administrator", and "Super Admin" login roles grant full access.

### Outlet Admin / Branch Manager
- Employees assigned as **Admin** or **Manager** at a specific outlet automatically gain access to all outlet/branch modules.
- This access is granted in addition to their base role permissions.
- **Automatic modules:** Branch Management, Outlet Inventory, Outlet Requisitions, Outlet Returns, Outlet Products, Branch Employees, Branch Reports, Branch Waste, Branch Settings.

### Baker
- **Production-focused** access.
- **Modules:** Dashboard, Recipes & Products, Product Catalogue, Production Runs, Picking Lists, Lot Tracking, Waste Control, Account Settings.
- **Cannot access:** Orders, POS, Inventory, Finance, Employees, or Settings.

### Cashier / POS Attendant
- **Sales-focused** access.
- **Modules:** Dashboard, POS System, Orders, Customers, Account Settings.
- **Cannot access:** Production, Inventory management, Finance, Employees, or Settings.

### Sales
- **Order and customer management** access.
- **Modules:** Dashboard, Orders, Order Tracking, Delivery, Customers, Pricing, Account Settings.
- **Cannot access:** Production, detailed Inventory, Finance, Employees, or Settings.

### Rider / Driver
- **Delivery-focused** access (strictly restricted).
- **Modules:** Dashboard, Delivery, Order Tracking, Rider Reports, Account Settings.
- **Cannot access any other module** regardless of additional permissions.

### Viewer
- **Minimal** access — only the Account Settings page by default.
- Additional access must be explicitly granted via permissions in the Roles & Permissions module.
- Suitable for employees who need read-only access to specific modules.

### Custom Roles
Administrators can create custom roles (e.g., Branch Manager, Inventory Clerk) with specific permissions.

---

## 4. Dashboard

**Who can see this:** All roles (with "View Dashboard" permission)

The Dashboard is the first screen employees see after logging in and serves as the central command center for the entire business. It provides a real-time snapshot of key business metrics, recent activity, and quick-access shortcuts to frequently used functions. The dashboard content adapts based on the user's role, showing only the most relevant information.

**Key features include:**
- **Key Performance Indicators (KPIs):** Real-time metrics including daily/monthly revenue, total orders, active customers, production output, and delivery completion rates. KPIs update automatically as transactions occur throughout the day.
- **Recent Activity Feed:** A live feed showing the latest orders placed (both in-store and online), recent deliveries completed, production batches started or finished, and other significant system events.
- **Quick Actions:** One-click shortcuts to common tasks like creating a new order, starting a production run, checking inventory levels, or accessing the POS system -- reducing the number of clicks needed for everyday operations.
- **Alerts & Notifications:** Visual indicators for urgent items such as low stock warnings, pending online orders awaiting confirmation, overdue deliveries, and system alerts that need attention.

![Dashboard — Overview of key business metrics and recent activity](/docs/dashboard.png)
*Figure 2: The main Dashboard showing KPIs, recent orders, and quick-action shortcuts.*

---

## 5. POS System

**Who can see this:** Cashier, POS Attendant, Admin (or anyone with "Access POS" permission)

The Point of Sale (POS) module is the system's in-store sales processing hub, designed for fast and efficient transaction handling during busy bakery hours. It provides a full-screen, touch-friendly interface optimized for both desktop monitors and tablet devices, allowing cashiers to process sales quickly while minimizing errors.

**Core capabilities:**
- **Process Sales:** Browse or search the product catalog, add items to the cart, adjust quantities, and apply discounts or special pricing. The product grid highlights frequently sold items for quick access.
- **Multiple Payment Methods:** Accept payments via M-Pesa (STK push sent directly to the customer's phone), cash (with automatic change calculation), credit card, or store credit. Split payments across multiple methods are also supported.
- **Receipt Generation:** Automatically generate professional receipts after each transaction. Receipts can be printed directly, shared via WhatsApp, emailed to the customer, or downloaded as PDF. Receipt templates are customizable per branch through Settings.
- **Shift & Transaction History:** View a complete log of all sales processed during the current shift, including payment breakdowns, voids, and returns. Useful for end-of-day reconciliation.
- **Held Orders:** Save in-progress orders to resume later, useful when a customer needs to step away or when processing multiple orders simultaneously.
- **Tax & Currency Configuration:** Configurable tax rates, currency symbols, and business branding that appear on receipts and transaction records.

![POS System — Process in-store sales with product search, payment, and receipt generation](/docs/pos.png)
*Figure 3: The POS System interface for processing in-store sales with product browsing, cart management, and payment options.*

### How to Process a Sale:
1. Open **POS System** from the sidebar.
2. Search or browse products to add to the order.
3. Adjust quantities as needed.
4. Select the payment method (M-Pesa or Cash).
5. Complete the transaction and print/share the receipt.

---

## 6. Production Modules

**Who can see this:** Baker, Admin (or anyone with "Manage Recipes" permission)

The Production module group forms the backbone of the bakery's manufacturing operations. These interconnected modules manage the entire production pipeline -- from defining recipes and their ingredient costs, through scheduling and executing production batches, to tracking finished goods with full lot-level traceability. Together, they ensure consistent product quality, minimize waste, and provide complete visibility into what is being produced, when, and at what cost.

### 6.1 Recipes & Products
The Recipe Management module is where all product recipes are defined, costed, and maintained. Each recipe documents the exact ingredients, quantities, preparation steps, and associated costs required to produce a specific bakery product.

**Key features:**
- Create and manage recipes with detailed ingredient lists, quantities, units of measurement, and per-unit costs. The system automatically calculates the total cost per batch and cost per unit.
- Set product selling prices based on ingredient costs and desired profit margins, ensuring pricing stays aligned with production costs.
- Track recipe variations and versions so historical recipes are preserved when updates are made.
- **AI-Powered Recipe Generation:** Use the built-in AI tool to automatically generate recipe details, ingredient lists, and costing estimates for new products -- saving time during product development.
- Link recipes to inventory items so ingredient consumption is tracked when production runs are completed.

![Recipes Overview — View all recipes with ingredients, costing, and product details](/docs/recipe.png)
*Figure 4: The Recipes overview listing all recipes with their ingredients, costing information, and product links.*

![AI Recipe Generation — Use AI to auto-generate recipe details and ingredient lists](/docs/recipe-ai.png)
*Figure 5: The AI Recipe tool that automatically generates recipe details, ingredient lists, and costing estimates.*

![Manual Recipe — Create and manage detailed recipes with ingredients and costing](/docs/manual-recipe.png)
*Figure 6: The Manual Recipe page where bakers define ingredients, quantities, and costing for each product.*

### 6.2 Product Catalogue & Food Information
The Product Catalogue serves as the master product database for the entire system. Every product sold through the POS, website, or outlets is defined here with comprehensive details including allergen information, nutritional facts, dietary labels, and food safety data.

**Key features:**
- Manage detailed allergen information for each product (gluten, dairy, eggs, nuts, soy, etc.) to ensure compliance with food safety regulations and customer safety.
- Add nutritional facts including calories, protein, fat, carbohydrates, and other nutritional values per serving.
- Mark products with dietary labels such as halal, vegan, gluten-free, organic, or other certifications.
- Track product codes, batch numbers, shelf life, and FIFO (First-In-First-Out) settings for quality control.
- Set stock levels, minimum order quantities, reorder levels, and maximum stock thresholds for each product.
- Link products to their source recipes and supplier information for complete traceability.

![Product Catalogue — View and manage all products with allergen info and dietary labels](/docs/product.png)
*Figure 7: The Product Catalogue listing all products with their allergen information, dietary labels, and pricing.*

![Add Product — Create a new product entry with details, allergens, and nutritional facts](/docs/product-add.png)
*Figure 8: Adding a new product to the catalogue with allergen details, nutritional information, and dietary labels.*

### 6.3 Production Runs
Production Runs is the scheduling and execution engine for bakery production. It allows production managers and bakers to plan daily or weekly production batches, track their progress in real time, and record actual output against planned targets for performance analysis.

**Key features:**
- Schedule production batches for the day or week with specific product targets, quantities, and timelines.
- Track batch status through a clear workflow: **Planned** (scheduled but not started), **In Progress** (currently being produced), and **Completed** (finished and ready for sale/delivery).
- Record actual output vs. planned output for each batch, helping identify efficiency gaps and production capacity.
- Link production runs to recipes so ingredient requirements are automatically calculated.
- View production history and performance trends over time to optimize scheduling.

![Production Runs — Schedule and track production batches with status monitoring](/docs/production-runs-batch.png)
*Figure 9: The Production Runs page showing scheduled batches with their status, planned output, and progress.*

![Add Production Run — Create a new production batch with product selection and scheduling](/docs/production-runs-batch-add.png)
*Figure 10: Creating a new production run batch with product selection, quantity targets, and scheduling details.*

### 6.4 Picking Lists
Picking Lists bridge the gap between production planning and execution. When a production run is scheduled, the system automatically generates a picking list that details every ingredient needed, in the exact quantities required, so bakers can efficiently gather all materials before starting production.

**Key features:**
- Auto-generated ingredient lists based on the recipes and quantities in scheduled production runs -- no manual calculation needed.
- Used by bakers as a physical checklist to gather all ingredients from storage before production begins.
- Cross-references available inventory to flag any ingredients that may be insufficient, helping prevent production delays.
- Supports printing for use on the production floor.

![Add Picking List — Create a new picking list for scheduled production runs](/docs/add-picking-list.png)
*Figure 11: Adding a new picking list to prepare ingredients for a production batch.*

### 6.5 Lot Tracking
Lot Tracking provides complete traceability for every production batch, enabling the bakery to trace any finished product back to its exact production date, batch number, ingredients used, and expiry date. This is essential for food safety compliance, quality assurance, and rapid response to any quality issues.

**Key features:**
- Track production batch numbers (lot numbers) for every finished product, creating a permanent traceability record.
- Record expiry dates and shelf life for each lot, ensuring products are sold within their safe consumption window.
- Trace any product back to its specific production batch if a quality issue, customer complaint, or recall situation arises.
- View lot history with dates, quantities produced, and current status (Active, Expiring Soon, Expired).
- Support FIFO (First-In-First-Out) compliance by highlighting oldest lots that should be sold first.

![Lot Tracking Overview — View all tracked production lots with batch numbers and expiry dates](/docs/lot-tracking.png)
*Figure 12: The Lot Tracking overview listing all production batches with their status, batch numbers, and expiry dates.*

![Add Lot — Record a new production lot with batch number and expiry date](/docs/add-lot.png)
*Figure 13: Adding a new lot entry to track batch numbers and expiry dates for traceability.*

### 6.6 Waste Control
Waste Control is a critical module for monitoring and reducing production losses. Every unit of waste -- whether from overproduction, damage during handling, equipment failures, or product expiry -- is recorded, categorized, and analyzed to identify patterns and drive improvement.

**Key features:**
- Record and categorize all production waste with detailed reasons: overproduction, damage, equipment malfunction, ingredient spoilage, product expiry, or customer returns.
- Track waste by product type, date, shift, and responsible area to identify where losses are concentrated.
- Analyze waste trends and patterns over time with reporting to pinpoint the biggest sources of loss.
- Calculate the financial impact of waste to understand the true cost of production losses.
- Compare waste rates across branches (when used with outlet modules) to identify best practices and problem areas.

![Add Waste Record — Log production waste by product type and cause](/docs/ad-waste.png)
*Figure 14: Recording waste in the Waste Control module to track and reduce production losses.*

---

## 7. Sales & Orders Modules

The Sales & Orders module group handles every aspect of customer-facing transactions beyond the POS counter. From managing customer relationships and processing orders from multiple channels (in-store, phone, online) to coordinating delivery logistics and managing product pricing, these modules work together to ensure smooth order fulfillment from placement to delivery.

### 7.1 Customers
**Who can see this:** Sales, Cashier, Admin (or anyone with "Manage Customers" permission)

The Customer Management module maintains a comprehensive database of all customers, enabling personalized service, targeted marketing, and efficient delivery planning. Each customer profile stores contact details, order history, location data, and preferences.

**Key features:**
- View and manage customer profiles with full contact information, delivery addresses, and communication preferences.
- Track complete order history per customer, including past purchases, spending patterns, and preferred products.
- Segment customers by location, purchase frequency, order value, or custom tags for targeted promotions and service.
- Store customer geo-location data (GPS coordinates) for accurate delivery planning and route optimization.
- Record customer notes and special requirements (e.g., allergies, delivery instructions, preferred contact times).

![Customer Management — View and manage customer profiles and order history](/docs/customer.png)
*Figure 15: The Customer Management page showing customer profiles, contact details, and order history.*

![Add Customer — Create a new customer profile with contact and location details](/docs/ad-customer.png)
*Figure 16: Adding a new customer record with contact information and delivery location.*

### 7.2 Orders
**Who can see this:** Sales, Cashier, Admin (or anyone with "Manage Orders" permission)

The Orders module is the central hub for managing all customer orders regardless of how they are placed. It supports walk-in orders, phone orders, and online orders from the e-commerce website, all in one unified interface with real-time status tracking.

**Key features:**
- **Create Orders:** Place new orders for any customer through multiple channels -- walk-in, phone call, or on behalf of a customer. Each order captures products, quantities, customer details, delivery preferences, and payment method.
- **Manage Order Lifecycle:** Track and update order status through a complete workflow: **Pending** (just placed) → **Confirmed** (accepted by staff) → **In Production** (being prepared) → **Ready** (baked and packaged) → **Out for Delivery** (dispatched) → **Delivered** (completed). Each status change is logged for accountability.
- **Online Orders with M-Pesa:** Automatically receive online orders placed through the website. An audible alarm alerts staff when a new online order arrives. Payment is verified via M-Pesa callback integration, showing real-time payment status.
- **Order Details:** Each order shows a complete breakdown including itemized products, pricing, discounts, delivery fees, payment method, payment status, and customer contact information.
- **Search & Filtering:** Quickly find orders using search by customer name, order number, or status. Filter by date range, payment status, or delivery method.

![Orders Overview — View and manage all customer orders with status tracking](/docs/orders.png)
*Figure 17: The Orders page showing all orders with their current status, customer details, and payment information.*

![Manual Order — Create a new order manually for walk-in or phone customers](/docs/orders-manual.png)
*Figure 18: Creating a manual order with product selection, customer details, and payment method.*

### How to Process an Online Order:
1. You will hear an **alarm** when a new online order arrives.
2. Click the notification bell or go to **Orders**.
3. Review the order details and payment status.
4. Confirm the order to begin processing.
5. Update the status as it moves through production and delivery.

### 7.3 Order Tracking
**Who can see this:** Sales, Rider, Admin (or anyone with "Manage Deliveries" permission)

Order Tracking provides a real-time, visual overview of where every order stands in the fulfillment pipeline. It is the go-to module for staff who need to monitor order progress, identify bottlenecks, and ensure timely delivery.

**Key features:**
- Track the real-time status of all active orders across the entire fulfillment process, from placement to delivery.
- View delivery progress including estimated time of arrival (ETA), assigned rider, and route information.
- Filter orders by status (Pending, In Production, Ready, Out for Delivery, Delivered), date range, customer, or payment status.
- Detailed timeline view for each order showing every status change with timestamps, giving full visibility into the order's journey.
- Identify delayed or stuck orders that may need intervention.

![Order Tracking — Track real-time status and progress of all orders](/docs/orders-tracking.png)
*Figure 19: The Order Tracking page showing all orders with real-time status updates, filters, and delivery progress.*

![Order Tracking Detail — Detailed view of a specific order's delivery timeline](/docs/order-tracking-detail.png)
*Figure 20: A detailed order tracking view showing the full delivery timeline and status milestones.*

### 7.4 Delivery
**Who can see this:** Sales, Rider, Admin (or anyone with "Manage Deliveries" permission)

The Delivery module manages the logistics of getting orders from the bakery to the customer's doorstep. It coordinates rider/driver assignments, delivery scheduling, route management, and delivery completion tracking.

**Key features:**
- Schedule deliveries for orders that require dispatch, setting pickup times and delivery windows.
- Assign available riders or drivers to delivery routes based on location, capacity, and availability.
- View all delivery assignments in a centralized dashboard with status indicators (Pending, Dispatched, In Transit, Delivered).
- Track delivery completion with confirmation, customer feedback, and proof of delivery.
- Monitor rider performance including delivery times, completion rates, and customer ratings.

![Delivery Overview — View all scheduled deliveries with rider assignments and status](/docs/delivery.png)
*Figure 21: The Delivery module showing all deliveries with assigned riders, routes, and completion status.*

![Add Delivery — Schedule a new delivery with rider assignment and route details](/docs/delivery-add.png)
*Figure 22: Creating a new delivery assignment with rider selection, route, and delivery schedule.*

### How to Assign a Delivery:
1. Go to **Delivery** module.
2. Find the order that needs delivery.
3. Assign an available rider/driver.
4. The rider will see the delivery in their dashboard.

### 7.5 Rider Reports
**Who can see this:** Rider, Sales, Admin (or anyone with "Manage Deliveries" permission)

Rider Reports provide a dedicated channel for delivery personnel to report issues encountered during deliveries. This module ensures accountability, helps track product loss during transit, and provides data for improving delivery operations.

**Key features:**
- Riders can report damaged, spoiled, or missing products discovered during delivery with detailed descriptions and reasons.
- Record specific reasons for delivery issues such as customer not available, wrong address, product damage in transit, or vehicle breakdown.
- Attach photos or notes to reports as supporting evidence for accountability.
- Reports feed into the Waste Control module and financial tracking to capture the true cost of delivery losses.
- Management can review and act on reports to address recurring issues and improve delivery processes.

### 7.6 Pricing
**Who can see this:** Sales, Admin (or anyone with "Manage Pricing" permission)

The Pricing module provides centralized control over all product pricing across the business. It supports multiple pricing tiers (retail, wholesale, distributor), bulk discount rules, and category-based pricing strategies to maximize revenue while remaining competitive.

**Key features:**
- Set and manage multiple pricing tiers for each product: retail (individual customer), wholesale (bulk buyers), and distributor (reseller) pricing.
- Create bulk pricing rules and volume-based discounts (e.g., buy 10+ loaves at a reduced price per unit).
- Compare pricing across product categories to ensure consistency and identify pricing opportunities.
- Track pricing history to analyze the impact of price changes on sales volume and revenue.
- Pricing updates apply across the POS, online store, and outlet systems automatically.

![Pricing Overview — View and manage retail and wholesale pricing tiers](/docs/pricing.png)
*Figure 23: The Pricing page showing product pricing tiers, bulk rules, and category comparisons.*

![Add Pricing — Create a new pricing tier or discount rule for products](/docs/pricing-add.png)
*Figure 24: Adding a new pricing tier with product selection, price levels, and discount rules.*

---

## 8. Inventory Modules

**Who can see this:** Admin (or anyone with "Manage Inventory" permission)

The Inventory module group provides end-to-end supply chain management for the bakery. From tracking raw materials and finished goods across all storage locations, to managing supplier relationships, purchase orders, and business assets, these modules ensure the bakery always has the right materials at the right time while controlling costs.

### 8.1 Inventory
The core Inventory module tracks every item the bakery holds in stock -- raw materials (flour, sugar, eggs, etc.), packaging supplies, and finished goods ready for sale. It provides real-time visibility into stock levels with automated alerts when items run low.

**Key features:**
- Track stock levels for raw materials, packaging, and finished goods with real-time quantity updates as items are received, used in production, or sold.
- Receive automated low-stock alerts when items fall below their configured minimum threshold, preventing production delays due to ingredient shortages.
- Record all stock movements including goods received from suppliers, materials consumed by production runs, stock adjustments for damage or counting errors, and inter-branch transfers.
- Categorize inventory items by type (raw material, packaging, finished product, cleaning supplies, etc.) for organized management.
- View stock valuation and cost tracking per item to understand inventory investment.

![Inventory Overview — Track stock levels of raw materials, packaging, and finished goods](/docs/inventory.png)
*Figure 25: The Inventory overview showing current stock levels, low-stock alerts, and item categories.*

![Add Inventory Item — Record a new stock entry with quantity and category details](/docs/inventory-add.png)
*Figure 26: Adding a new inventory item with details such as quantity, category, and reorder level.*

### 8.2 Stock Reorder & Requisitions
The Stock Reorder module provides proactive inventory management by monitoring stock levels against configured thresholds and facilitating the requisition process to replenish supplies before they run out.

**Key features:**
- Monitor all inventory items against their minimum stock levels, with clear visual indicators showing items that are low, critically low, or out of stock.
- Set minimum stock levels for each item that automatically trigger reorder notifications when breached.
- Create and manage internal stock requisitions -- formal requests for materials that go through an approval workflow (Pending → Approved → Issued) before purchase orders are created.
- Support priority levels (Low, Normal, High, Urgent) on requisitions to help management prioritize restocking.
- Link production schedules to ingredient availability, flagging items that will be needed for upcoming production runs but are currently insufficient.

![Stock Reorder — Monitor stock levels and trigger reorders for low-stock items](/docs/stock-reorder.png)
*Figure 27: The Stock Reorder page showing stock levels, reorder alerts, and out-of-stock items with restock actions.*

![Stock Reorder Requisitions — View and manage pending stock requisitions](/docs/stock-reorder-requisitions.png)
*Figure 28: The Requisitions tab showing pending stock requests with quantities, priority, and approval actions.*

### 8.3 Purchasing
The Purchasing module manages the full purchase order lifecycle from creating orders for suppliers to receiving goods and recording payments. It provides a structured workflow for procurement that ensures proper authorization and tracking.

**Key features:**
- Create and manage purchase orders for any supplier, specifying items, quantities, unit prices, and delivery expectations.
- Track purchase order status through a clear workflow: **Draft** (being prepared) → **Sent** (submitted to supplier) → **Received** (goods arrived and inspected) → **Paid** (payment completed).
- Compare quotes from multiple suppliers for the same items to ensure competitive pricing.
- Record goods received against purchase orders, automatically updating inventory levels when items arrive.
- Track payment status and amounts owed to suppliers, feeding into the Creditors module for financial management.

![Purchasing Overview — Create and manage purchase orders for suppliers](/docs/purchasing.png)
*Figure 29: The Purchasing page showing all purchase orders with their status, supplier details, and amounts.*

![Add Purchase Order — Create a new purchase order with supplier and item selection](/docs/purchasing-add.png)
*Figure 30: Creating a new purchase order with supplier selection, item quantities, and pricing details.*

### 8.4 Suppliers
The Supplier Management module maintains a database of all vendors and suppliers the bakery works with. It tracks contact information, pricing agreements, payment terms, and supplier performance to support informed procurement decisions.

**Key features:**
- Manage comprehensive supplier profiles with contact information, physical addresses, and primary contact persons.
- Track supplier-specific pricing and payment terms (net 30, COD, etc.) for each item they supply.
- Record and compare supplier performance including delivery reliability, product quality, and responsiveness.
- Maintain supplier banking details for payment processing.
- Link suppliers to specific inventory items and purchase orders for complete procurement traceability.

### 8.5 Distributors & Distribution
The Distributors module manages the bakery's wholesale distribution network -- the agents and resellers who purchase products in bulk and distribute them to retail outlets, shops, and other points of sale beyond the bakery's own branches.

**Key features:**
- Manage distributor agent profiles with full contact information, ID documentation, assigned territory, and GPS coordinates for geographic mapping.
- Configure commission structures per distributor -- either a percentage of sales or a fixed amount per transaction.
- Track distributor status (Active, Inactive, Suspended) and manage agent lifecycle.
- Record vehicle information (type and registration) for distributors who handle their own deliveries.
- Manage distribution records including product quantities dispatched, delivery confirmations, and return tracking.
- Track distribution order status through the workflow: **Pending** → **Dispatched** → **Delivered** → **Returned** (if applicable).
- Calculate and track commissions earned per distributor, with bank account details stored for payment processing.

![Distributors Overview — Manage distribution agents and wholesale channels](/docs/distributor.png)
*Figure 31: The Distributors page showing all distribution agents with their sales performance and commissions.*

![Add Distributor — Register a new distribution agent with contact and sales details](/docs/distributor-add.png)
*Figure 32: Adding a new distributor with contact information, commission rate, and assigned territory.*

### 8.6 Assets
The Asset Management module tracks all physical business assets including production equipment, delivery vehicles, office equipment, and tools. It provides a centralized register for monitoring asset value, depreciation, and maintenance requirements.

**Key features:**
- Maintain a complete register of all business assets with descriptions, serial numbers, purchase dates, and original costs.
- Track asset depreciation schedules to understand current book value and plan for replacements.
- Record maintenance schedules and repair history for each asset, ensuring equipment stays in good working condition.
- Categorize assets by type (equipment, vehicle, furniture, IT, etc.) and location (main bakery, branches).
- Track asset disposal, transfer between locations, and insurance details.

![Asset Management — View and manage all business assets, equipment, and vehicles](/docs/asset-manage.png)
*Figure 33: The Asset Management overview showing tracked equipment, vehicles, and tools.*

![Add Asset — Register a new business asset with details and depreciation schedule](/docs/asset-add.png)
*Figure 34: Adding a new asset to the system with details such as purchase date and depreciation.*

---

## 9. Outlet (Branch) Modules

**Who can see this:** Admin (or anyone with "Manage Outlets" or "View Outlets" permission)

The Outlet module group is designed for bakeries operating multiple physical locations. It provides a complete set of tools for managing each branch as a semi-independent operation while maintaining centralized control and visibility. Each outlet can have its own inventory, product catalog, employee roster, pricing, and performance reporting, while the main bakery retains oversight of all branches through consolidated dashboards and approval workflows.

These modules are particularly important for Outlet Admins and Branch Managers, who automatically gain access to all outlet-related modules for their assigned branch:

### 9.1 Branch Management
Branch Management is the central configuration module for all outlet locations. It handles the setup, configuration, and ongoing management of each physical bakery branch.

**Key features:**
- Create and manage branch outlets (e.g., CBD Branch, Westlands Branch, Karen Branch) with detailed location information.
- Set branch details including name, physical address, GPS coordinates, operating hours, and contact information.
- Assign staff members and designate branch managers/admins who will oversee daily operations.
- Monitor branch status (Active, Temporarily Closed, Permanently Closed) across the entire network.
- View a centralized dashboard of all branches with key performance indicators.

![Branch Overview — View all bakery branch outlets and their details](/docs/branch.png)
*Figure 35: The Branch Management page listing all outlet locations with their status and details.*

![Add Branch — Create a new branch outlet with location and operating details](/docs/branch-add.png)
*Figure 36: Adding a new branch outlet with name, location, and manager assignment.*

### 9.2 Outlet Inventory
Outlet Inventory provides branch-level stock management, giving each outlet visibility into its own stock levels independently from the main bakery's inventory.

**Key features:**
- Track stock levels at each individual branch location, showing available quantities for all products and materials.
- Compare inventory across branches side-by-side to identify imbalances or redistribution opportunities.
- Record stock movements between the main bakery and branches, including dispatches, receipts, and returns.

![Outlet Inventory — Track and manage stock levels at each branch location](/docs/outlet-inventory.png)
*Figure 37: The Outlet Inventory page showing stock levels per branch with comparison and movement tracking.*

### 9.3 Outlet Requisitions
Outlet Requisitions is the formal product ordering system between branch outlets and the main bakery. It ensures branches receive the products they need through a structured request-and-approval workflow.

**Key features:**
- Branches submit product requests specifying the items and quantities needed, with delivery date preferences.
- Managers and administrators can review, approve, or reject requisitions based on availability and business needs.
- Track requisition status through the complete lifecycle: **Pending** (submitted, awaiting review) → **Approved** (authorized by management) → **Dispatched** (sent from main bakery) → **Received** (confirmed by the branch).
- View requisition history for auditing and planning purposes.

![Outlet Requisitions — View and manage product requests from branch outlets](/docs/outlet-requisition.png)
*Figure 38: The Outlet Requisitions page showing all branch product requests with their approval status.*

![Add Outlet Requisition — Submit a new product request from a branch to the main bakery](/docs/outlet-requisition-add.png)
*Figure 39: Creating a new outlet requisition with product selection, quantities, and delivery preferences.*

### How to Submit a Requisition:
1. Go to **Outlet Requisitions**.
2. Click **New Requisition**.
3. Select the products and quantities needed.
4. Submit for approval.
5. The main bakery will review and dispatch the items.

### 9.4 Outlet Returns
Outlet Returns manages the reverse flow of products from branches back to the main bakery, ensuring proper documentation and accountability for returned items.

**Key features:**
- Process returns of unsold, expired, damaged, or excess products from branches to the main bakery.
- Document return reasons and quantities for each item, maintaining a clear audit trail.
- Track return processing status to ensure items are properly received and accounted for.
- Feed return data into waste tracking and inventory adjustment systems to maintain accurate records.

![Outlet Returns — Track and manage product returns from branch outlets to the main bakery](/docs/outlet-returns.png)
*Figure 40: The Outlet Returns page showing returned items with reasons, quantities, and processing status.*

### 9.5 Outlet Products
Outlet Products controls which products from the master catalog are available for sale at each specific branch, supporting different product mixes and pricing per location.

**Key features:**
- Define which products from the master catalog are available at each branch, allowing different locations to carry different product lines.
- Set branch-specific pricing if needed (e.g., a CBD branch may charge different prices than a suburban branch).
- Control product availability per outlet, enabling seasonal or location-based product offerings.
- Bulk-assign or remove products from outlet catalogs.

![Outlet Products — Manage the product catalog available at each branch](/docs/outlet-products.png)
*Figure 41: The Outlet Products page showing the product catalog for each branch with pricing and availability.*

### 9.6 Branch Employees
Branch Employees provides staff management at the outlet level, showing who is assigned to each branch and their roles within that location.

**Key features:**
- View all staff members currently assigned to a specific branch, with their roles, contact details, and schedules.
- Manage employee assignments -- transfer staff between branches, update roles, or remove employees from a branch.
- Track work schedules and attendance per branch for workforce planning.
- View employee productivity within the branch context.

![Branch Employees — View and manage staff assigned to a specific branch](/docs/branch-employees.png)
*Figure 42: The Branch Employees page showing staff assigned to a branch with their roles and schedules.*

![Branch Employee Assignments — Manage employee assignments, transfers, and roles per outlet](/docs/branch-employees-assign.png)
*Figure 43: The Branch Employee assignment management view with options to view, edit, transfer, or remove staff from outlets.*

### 9.7 Branch Reports
Branch Reports delivers performance analytics at the outlet level, enabling management to compare branches, identify top performers, and spot issues that need attention.

**Key features:**
- View detailed sales, inventory, and operational performance reports for each individual branch.
- Compare branch performance metrics side-by-side across the entire outlet network.
- Identify top-performing branches and those that need operational support or management attention.
- Track revenue, order volume, waste rates, and other KPIs per branch over configurable time periods.

![Branch Reports — Sales, inventory, and performance reports for each branch](/docs/branch-reports.png)
*Figure 44: Branch Reports showing performance metrics and sales comparisons across outlets.*

### 9.8 Branch Waste
Branch Waste extends the Waste Control module to the outlet level, allowing each branch to record and report on product waste independently.

**Key features:**
- Record waste events at each branch with product details, quantities, and specific reasons.
- Track waste by product type and cause (overproduction, expiry, damage, theft) per branch.
- Compare waste rates across all branches to identify outliers and share best practices from low-waste outlets.

![Branch Waste — Track and compare waste records across branch outlets](/docs/branch-waste.png)
*Figure 45: The Branch Waste module showing waste entries by product type and cause per outlet.*

### 9.9 Branch Settings
Branch Settings allows each outlet to be configured independently with its own receipt templates, POS preferences, and operational parameters.

**Key features:**
- Customize receipt templates per branch, including header text, footer messages, and branding elements.
- Configure POS settings specific to each branch, such as default payment methods and tax handling.
- Set branch-specific display options and operational parameters that differ from the main bakery's defaults.

![Branch Settings — Configure receipt templates and POS settings for each branch](/docs/branch-settings.png)
*Figure 46: Branch Settings page where managers can configure receipts and operating parameters.*

---

## 10. Finance Modules

**Who can see this:** Admin (or anyone with "Manage Finance" permission)

The Finance module group provides comprehensive financial management capabilities for the bakery. It covers all aspects of business accounting -- from recording daily expenses and tracking money owed by customers (debtors) to managing amounts payable to suppliers (creditors) and generating credit invoices for wholesale and credit customers. These modules work together to give management clear visibility into the bakery's financial health.

### 10.1 Expenses
The Expenses module records and categorizes all business expenditures, providing a clear picture of where money is being spent and supporting financial reporting and tax preparation.

**Key features:**
- Record and categorize business expenses by type (ingredients, utilities, rent, transport, marketing, equipment, salaries, etc.).
- Attach digital copies of receipts, invoices, and supporting documents to each expense entry for audit compliance.
- Track expense approval workflows and payment status (Pending, Approved, Paid, Rejected).
- View expense summaries by category, date range, or department to identify spending patterns and control costs.
- Export expense data for accounting and tax filing purposes.

![Expenses — Record and categorize business expenses with receipt attachments](/docs/expense.png)
*Figure 47: The Expenses page showing categorized expense entries with amounts, dates, and approval status.*

### 10.2 Debtors
The Debtors module tracks all credit sales -- customers who have purchased products but have not yet paid in full. It provides tools for managing outstanding balances, recording payments, and following up on overdue accounts.

**Key features:**
- Track all credit sales and outstanding customer debts with individual balance tracking per customer.
- Send payment reminders and follow up on overdue accounts to improve cash flow.
- Record partial and full payments against outstanding balances, with automatic balance recalculation.
- View debtor aging reports showing how long debts have been outstanding (30, 60, 90+ days).
- Maintain a complete payment history per customer for accounting and dispute resolution.

![Debtors — Track customer debts, credit sales, and payment status](/docs/debtor.png)
*Figure 48: The Debtors module showing outstanding customer balances and payment tracking.*

![Add Debtor — Record a new debtor entry with customer and payment details](/docs/debtor-add.png)
*Figure 49: Adding a new debtor record with customer information, amount owed, and payment terms.*

### 10.3 Creditors
The Creditors module tracks all amounts owed by the bakery to its suppliers and service providers. It ensures timely payment of supplier invoices and provides visibility into the bakery's outstanding financial obligations.

**Key features:**
- Track all amounts owed to suppliers with individual balance tracking per creditor.
- Manage payment schedules and due dates to avoid late payments and maintain good supplier relationships.
- Record payments made to suppliers with payment method, reference numbers, and dates.
- View creditor aging reports showing upcoming and overdue payments.
- Link creditor records to purchase orders and supplier profiles for complete financial traceability.

### 10.4 Credit Invoices
The Credit Invoices module handles invoice generation and management for credit-based customer transactions. It is used when customers purchase on credit terms and need formal invoices for their records.

**Key features:**
- Generate professional credit invoices with auto-assigned invoice numbers, customer details, and itemized line items.
- Configure payment terms (e.g., Net 15, Net 30, Net 60) and credit limits per customer.
- Track invoice status through a complete lifecycle: **Unpaid** → **Partial** (some payment received) → **Paid** (fully settled) → **Overdue** (past due date).
- Record payments against invoices with payment method and reference details, automatically updating outstanding balances.
- View payment history per invoice and per customer for financial reporting and reconciliation.

![Creditors Overview — Track amounts owed to suppliers with payment schedules](/docs/creditor.png)
*Figure 50: The Creditors page showing supplier balances, due dates, and payment status.*

![Add Creditor — Record a new creditor entry with supplier and payment details](/docs/creditor-add.png)
*Figure 51: Adding a new creditor record with supplier information and payment terms.*

---

## 11. People Management Modules

The People Management module group handles all aspects of human resource management within the bakery. From onboarding new employees and managing their profiles to tracking productivity, managing roles and permissions, and controlling system access, these modules ensure the right people have the right access and that employee performance is visible and measurable.

### 11.1 Employees
**Who can see this:** Admin (or anyone with "Manage Employees" permission)

The Employee Management module is the central HR hub for the bakery. It maintains comprehensive staff records and controls who can access the system.

**Key features:**
- Manage complete staff profiles including personal details, emergency contacts, next-of-kin information, and government ID numbers.
- Track professional certificates, licenses, food handler permits, and training records with expiry date monitoring.
- Manage payroll information including salary details, bank account information, and payment schedules.
- Control system access for each employee: enable or disable login access, assign login roles, and reset passwords.
- Track employee status (Active, On Leave, Suspended, Terminated) and employment dates.
- View a searchable, filterable directory of all staff with quick access to edit any profile.

![Employees — Manage staff profiles, payroll, and system access](/docs/employee.png)
*Figure 52: The Employees page showing all staff members with their roles, contact details, and system access status.*

### How to Add a New Employee:
1. Go to **Employees** module.
2. Click **Add Employee**.
3. Fill in personal details, role, and login credentials.
4. Set **System Access** to "Enabled" and assign a **Login Role**.
5. The employee will receive login credentials via email.

### 11.2 Productivity Report
**Who can see this:** Admin (or anyone with "View Reports" or "Manage Employees" permission)

The Productivity Report module provides data-driven insights into employee performance, helping management identify top performers, spot training needs, and make informed staffing decisions.

**Key features:**
- Track individual employee KPIs including orders processed, production output, delivery completion rates, and POS transaction volume.
- View attendance data and working hours per employee across configurable date ranges.
- Measure efficiency metrics such as average order processing time, production yield, and delivery speed.
- Generate performance reports suitable for periodic employee reviews and performance evaluations.
- Compare performance across employees, teams, or branches to identify best practices and improvement areas.

![Employee Productivity Report — Track employee KPIs, attendance, and performance metrics](/docs/employee-productivity-report.png)
*Figure 53: The Productivity Report showing employee performance metrics, attendance data, and efficiency ratings.*

### 11.3 Roles & Permissions
**Who can see this:** Admin only (or anyone with "System Settings" permission)

The Roles & Permissions module is where administrators define and manage the access control structure for the entire system. It provides granular control over which modules, features, and data each role can access.

**Key features:**
- Create custom roles with descriptive names (e.g., "Branch Manager", "Inventory Clerk", "Senior Baker") to match the bakery's organizational structure.
- Assign granular permissions to each role from a comprehensive list of 19+ individual permissions covering every module in the system.
- View which employees are assigned to each role and how many active users each role has.
- See the full guide for creating roles, assigning permissions, and understanding the role hierarchy in [Section 13](#13-roles--permissions-guide).

![Roles Overview — View all defined user roles in the system](/docs/roles.png)
*Figure 54: The Roles page listing all user roles with their descriptions and assigned employee counts.*

![Add Role — Create a new user role with name and description](/docs/roles-add.png)
*Figure 55: Adding a new role to the system with a name, description, and initial configuration.*

![Role Permissions — Assign granular permissions to a specific role](/docs/roles-permissions.png)
*Figure 56: The Permissions editor where administrators toggle individual access controls for each role.*

---

## 12. System & Settings Modules

The System & Settings modules provide the administrative backbone of the platform. They include financial reporting and ledger management, comprehensive audit logging for compliance, and system-wide configuration options that control everything from branding and receipt templates to security settings and website content.

### 12.1 Reports & Ledger
**Who can see this:** Admin (or anyone with "View Reports" permission)

The Reports & Ledger module is the bakery's financial reporting center. It generates key financial statements, provides ledger views for accounting, and supports data export for external accounting tools.

**Key features:**
- Generate standard financial reports including Profit & Loss statements, Revenue reports, Sales summaries, and Expense breakdowns.
- View the general ledger with account balances, transaction details, and period-end summaries.
- Filter reports by date range, category, branch, or other dimensions for focused analysis.
- Export reports in various formats for use with external accounting software and tax preparation.

![Reports & Ledger — Generate financial reports and view the general ledger](/docs/reports-ledger.png)
*Figure 57: The Reports & Ledger page showing financial reports, account balances, and export options.*

### 12.2 Audit Logs
**Who can see this:** Admin (or anyone with "View Audit Logs" permission)

The Audit Logs module maintains a complete, tamper-proof record of every significant action performed in the system. It is essential for accountability, compliance, security monitoring, and troubleshooting.

**Key features:**
- Automatically track all system activity including who performed each action, what was changed, and exactly when it happened.
- Log all authentication events: successful logins, failed login attempts, logouts, and session expirations.
- Record all data modifications: records created, updated, or deleted across every module, with before/after values where applicable.
- Track access events: which modules and records were viewed, and by whom.
- Filter and search logs by user, action type (Create, Update, Delete, Login, etc.), module, date range, or specific record IDs.
- Support 9+ distinct audit action types for comprehensive categorization of all system events.
- Audit data is stored permanently and cannot be edited or deleted by any user, ensuring integrity for compliance purposes.

![Audit Logs — Track all system activity including user actions and access events](/docs/audit-logs.png)
*Figure 58: The Audit Logs page showing a filterable record of all system activity by user, action, and date.*

### 12.3 Settings
**Who can see this:** Admin only (or anyone with "System Settings" permission)

The Settings module is the system-wide configuration center where administrators control the appearance, behavior, and integration settings for the entire platform.

**Key features:**
- **General Settings:** Configure business name, logo, branding colors, and contact information displayed across the system and on receipts.
- **Receipt Configuration:** Customize receipt templates including header text, footer messages, terms and conditions, and branding elements. Configure receipt printing and sharing options.
- **Theme & Appearance:** Configure the system's visual theme, color scheme, and display preferences.
- **Security Settings:** Manage authentication policies, session timeouts, password requirements, and access control defaults.
- **Navbar Ads / Announcement Bar:** Create and manage the website's top announcement bar messages for promotions, notices, or important updates visible to online customers.
- **Newsletter Configuration:** Set up and customize the pop-up newsletter modal that appears on the e-commerce website to capture customer email addresses.

![Dashboard Settings — Configure dashboard display preferences and widget options](/docs/dashboard-setting.png)
*Figure 59: The Settings page where administrators can customize dashboard display, branding, and system configuration.*

---

## 13. E-Commerce Website

The public-facing e-commerce website is an integral part of the Snackoh Bakers platform, allowing customers to browse the full product catalog, place orders online, and pay seamlessly via M-Pesa -- all without needing to visit a physical bakery location. The website is fully responsive (works on mobile, tablet, and desktop) and can be installed as a Progressive Web App (PWA) for a native app-like experience.

### Pages:
- **Home:** A visually rich landing page featuring best-selling products, seasonal promotions, customer testimonials, and quick navigation to the shop. Includes the announcement bar for special offers.
- **Shop:** The complete product catalog with search functionality, category filters, and sorting options. Each product displays its name, image, price, and availability status.
- **Product Detail:** An in-depth product page showing high-quality images, full description, pricing, nutritional information, allergen warnings, dietary labels, and related product suggestions.
- **Cart:** A review page where customers can see all items in their cart, adjust quantities, view subtotals, see delivery fee calculations, and proceed to checkout.
- **Checkout:** The final step where customers enter their contact email, select delivery or pickup, provide a delivery address, and complete payment via M-Pesa STK Push.
- **About:** The bakery's story, mission, values, and background information for customers who want to learn more about the business.
- **Contact:** Full contact information including phone numbers, email addresses, physical address, and operating hours for customer inquiries and support.

### Checkout Process (Customer View):
1. Browse products and add to cart.
2. Go to checkout.
3. Enter contact email and shipping/pickup details.
4. Pay via **M-Pesa** (STK push to phone).
5. Enter a valid Kenyan phone number (e.g. 0712 345 678 or +254712345678).
6. Enter M-Pesa PIN to confirm payment.
7. Order is confirmed and tracked.

### Delivery Policy:
- **Free delivery** on orders over KES 2,000.
- **KES 200** delivery fee for orders under KES 2,000.
- Delivery to Nairobi and surrounding areas.

---

## 14. Roles & Permissions Guide

This section is a detailed guide for Administrators who manage employee access. Understanding the permission system is essential for maintaining security while ensuring every employee can do their job effectively.

### Understanding Permissions

Permissions are granular controls that determine what a user can see and do. They are grouped into categories:

| Permission Name | What It Controls |
|---|---|
| **View Dashboard** | Access to the main dashboard with KPIs and metrics |
| **Access POS** | Use the Point of Sale system for in-store sales |
| **Manage Orders** | Create and manage customer orders, view order tracking |
| **Manage Customers** | View and edit customer profiles and data |
| **Manage Deliveries** | Schedule deliveries, assign riders, track orders |
| **Manage Pricing** | Set retail and wholesale pricing tiers |
| **Manage Inventory** | Track stock, reorders, purchasing, suppliers, distributors, assets |
| **Manage Purchases** | Create purchase orders and manage suppliers |
| **Manage Recipes** | Define recipes, production runs, picking lists, lot tracking, waste control |
| **Manage Employees** | Staff profiles, payroll, certificates, productivity |
| **View Reports** | Financial reports, P&L, employee productivity |
| **Manage Finance** | Expenses, debtors, and creditors management |
| **Manage Outlets** | Full branch management (all outlet modules) |
| **View Outlets** | Read-only access to outlet data |
| **Manage Outlet Inventory** | Branch-specific inventory management |
| **Manage Requisitions** | Create and manage product requests from branches |
| **Approve Requisitions** | Approve or reject branch product requests |
| **System Settings** | System configuration, roles & permissions, audit logs |
| **View Audit Logs** | View system activity and access logs |

### How to Create a New Role:
1. Go to **Roles & Permissions** in the sidebar.
2. Click **Add Role**.
3. Enter a role name and description (e.g., "Branch Manager").
4. Select the permissions this role should have.
5. Save the role.

### How to Assign a Role to an Employee:
1. Go to **Employees** module.
2. Find and edit the employee record.
3. Set the **Login Role** to the desired role (e.g., Baker, Cashier, Sales).
4. Ensure **System Access** is enabled.
5. Save the changes.

### Strictly Restricted Roles:
- **Rider** and **Driver** roles are strictly restricted. They can ONLY see:
  - Dashboard
  - Delivery
  - Order Tracking
  - Rider Reports
  - Account Settings
- No additional permissions can override this restriction.
- This restriction is enforced at both the server level (middleware) and client level (sidebar/route guard), so it cannot be bypassed.

### Role Hierarchy:
\`\`\`
Super Admin / Administrator
  └── Full access to everything

Outlet Admin / Branch Manager
  └── Base role permissions + all Outlet modules for their assigned branch

Sales
  └── Orders, Customers, Delivery, Pricing

Cashier / POS Attendant
  └── POS, Orders, Customers

Baker
  └── All Production modules (Recipes, Production, Picking Lists, etc.)

Rider / Driver
  └── Delivery, Order Tracking, Rider Reports only (strictly enforced)

Viewer
  └── Account Settings only; additional modules granted via permissions

Custom Roles
  └── Any combination of permissions as configured
\`\`\`

---

## 15. Security Best Practices

The Snackoh Bakers Management System handles sensitive business data, financial information, and customer personal details. Following these security practices is essential for protecting the business, its customers, and your own account. Every employee shares responsibility for maintaining system security.

### Password Safety
- Use a strong password with at least 8 characters, including uppercase, lowercase, numbers, and a symbol.
- Never share your login credentials with anyone, including colleagues.
- Change your password regularly through **Account Settings**.
- If you suspect someone else knows your password, change it immediately and notify your administrator.

### Session Management
- Always **log out** when you finish your shift or leave a shared device.
- Do not leave the system open on unattended computers or phones.
- If you use the installed app on a shared device, log out after every session.

### Data Handling
- Do not share customer information (phone numbers, email addresses, order details) outside the system.
- When processing M-Pesa payments, verify the phone number with the customer rather than sharing it aloud.
- Never take screenshots of customer data or financial reports for personal use.
- Report any unusual activity or suspicious data changes to your administrator immediately.

### Device Security
- Keep your browser and operating system updated.
- Avoid accessing the system on public Wi-Fi without a secure connection.
- If your phone or computer is lost or stolen, notify your administrator immediately so they can disable your system access.

### Recognizing Suspicious Activity
If you notice any of the following, report it to your administrator right away:
- Orders or transactions you did not create appearing under your name.
- Being logged out unexpectedly or your password no longer working.
- Unusual changes to inventory quantities, pricing, or customer records.
- Unfamiliar employees or roles appearing in the system.

---

## 16. Tips & Tricks

### Keyboard Shortcuts
- **Ctrl+R / Cmd+R:** Refresh the page to see the latest data.
- **Ctrl+F / Cmd+F:** Use browser search to quickly find text on any page.
- **Tab / Shift+Tab:** Navigate between form fields without using the mouse.
- **Enter:** Submit most forms after filling in the required fields.

### Productivity Tips
- **Install the App:** Use the "Install App" button to add the system to your home screen. It opens faster and works more reliably than a browser tab.
- **Collapse the Sidebar:** Click the arrow on the sidebar to collapse it and gain more workspace, especially on smaller screens.
- **Use Filters:** Most list pages (Orders, Inventory, Employees) have search bars and filter options. Use them to find records quickly rather than scrolling.
- **Bookmark Your Module:** If you primarily use one module (e.g., POS or Delivery), bookmark it directly in your browser for quick access.

### POS Tips
- **Quick Product Search:** Start typing a product name in the POS search bar to filter products instantly.
- **Frequent Items:** Products you sell most often appear first in the POS product grid.
- **Receipt Options:** After a sale, you can print, share via WhatsApp, or email the receipt to the customer.

### Order Management Tips
- **Online Order Alerts:** Keep your browser tab open or use the installed app so you can hear the alarm when new online orders arrive.
- **Status Updates:** Update order status promptly as it progresses (Confirmed, In Production, Ready, Out for Delivery, Delivered) so customers and riders have accurate information.
- **Bulk Actions:** Select multiple orders to perform batch status updates.

### Branch Management Tips
- **Requisition Planning:** Submit requisitions early in the day so the main bakery can include them in the current production run.
- **Stock Counts:** Regularly compare your outlet inventory with the system records to catch discrepancies early.
- **End-of-Day Returns:** Process returns before end of day to keep inventory accurate for the next morning.

---

## 17. Troubleshooting

### I can't see a module in the sidebar
- Your role may not have permission to access that module.
- Contact your administrator to check your permissions.
- Make sure your **System Access** is enabled.

### I can't log in
- Verify your email address is correct.
- Check that your account has been created by an administrator.
- Your **System Access** must be enabled.
- Try resetting your password through your administrator.

### The system is loading slowly
- Check your internet connection.
- Try refreshing the page (Ctrl+R or Cmd+R).
- Clear your browser cache if issues persist.
- Try the installed app version for better performance.

### Online order alarm won't stop
- Click the **STOP ALARM** button in the header.
- Or click **Acknowledge** on each order notification.
- You can also mute the alarm using the speaker icon.

### M-Pesa payment timed out (for customers)
- Wait 30 seconds and try again.
- Make sure your phone has network connectivity.
- Check that the M-Pesa phone number is correct.
- Use the "Verify Payment" option if you already paid manually.

### I'm seeing an "Access Denied" or redirect
- You are trying to access a module outside your role's permissions.
- The system enforces restrictions at both the server and browser level.
- Riders and Drivers are strictly limited and will be redirected automatically.
- Contact your administrator if you need additional access.

### I'm seeing "System access is disabled"
- Your administrator has disabled your system access.
- Contact your manager or administrator to re-enable it.

### POS is not showing any products
- Check that products have been added to the **Product Catalogue**.
- If you are at a branch, verify that products have been assigned to your outlet via **Outlet Products**.
- Try refreshing the page. If the issue persists, contact your administrator.

### A customer says they paid via M-Pesa but the order still shows "Pending"
- Go to the order and click **Verify Payment** to manually check with M-Pesa.
- M-Pesa callbacks can occasionally be delayed by up to a few minutes.
- If the payment is confirmed but the status did not update, manually update the order status and notify your administrator.

### Inventory quantities seem incorrect
- Check the **Audit Logs** for recent changes to that inventory item.
- Verify whether any production runs consumed the material.
- Confirm that outlet requisitions or returns were recorded properly.
- Run a physical stock count and update the records using a stock adjustment.

### I accidentally created a duplicate order or record
- Do not delete it yourself. Contact your administrator, who can review the **Audit Logs** and safely remove the duplicate.
- Avoid rapid double-clicks on "Create" or "Submit" buttons to prevent duplicates in the future.

### The receipt is not printing
- Ensure your printer is connected and powered on.
- Check that your browser allows pop-ups for the system URL.
- Try using the "Share" or "Download" option to save the receipt as a PDF and print manually.
- Contact your administrator if the issue continues.

---

## Glossary

| Term | Definition |
|------|------------|
| **ERP** | Enterprise Resource Planning -- a system that integrates all business operations into one platform. |
| **POS** | Point of Sale -- the module used to process in-store customer purchases. |
| **M-Pesa** | A mobile money transfer service widely used in Kenya for payments. |
| **STK Push** | A payment prompt sent directly to a customer's phone by M-Pesa during checkout. |
| **KPI** | Key Performance Indicator -- a metric used to evaluate business performance. |
| **Requisition** | A formal request from a branch outlet to the main bakery for products or materials. |
| **Lot Tracking** | Recording production batch numbers and expiry dates for traceability and quality control. |
| **Picking List** | A list of ingredients needed for a production run, used to gather materials before baking. |
| **RLS** | Row-Level Security -- a database feature that restricts data access based on user identity. |
| **Audit Log** | A chronological record of all actions performed in the system for accountability and compliance. |
| **Debtor** | A customer who has purchased on credit and owes money to the business. |
| **Creditor** | A supplier to whom the business owes money for goods or services received. |
| **Branch / Outlet** | A physical bakery location separate from the main production facility. |
| **Production Run** | A scheduled batch of products to be baked, with planned quantities and timelines. |
| **Waste Control** | The process of recording and analyzing product loss due to overproduction, damage, or expiry. |
| **Login Role** | The role assigned to an employee's system account that determines their module access. |
| **System Access** | A toggle that enables or disables an employee's ability to log into the system. |
| **Impersonation** | An admin feature that allows viewing the system as another user for troubleshooting. |

---

## Quick Reference Card

| I need to... | Go to... |
|---|---|
| Process an in-store sale | POS System |
| View today's orders | Orders |
| Check ingredient stock | Inventory |
| Start a production batch | Production Runs |
| See my delivery assignments | Delivery |
| Report damaged goods | Rider Reports |
| Request products for my branch | Outlet Requisitions |
| Record an expense | Expenses |
| Check a customer's debt | Debtors |
| See who did what | Audit Logs |
| Change my password | Account Settings |
| Add a new employee | Employees |
| Create a new role | Roles & Permissions |

---

## Contact & Support

- **Online Orders:** 0733 67 52 67 | sales@snackoh-bakers.com
- **Complaints & Compliments:** 0722 587 222 | 0799 55 94 34 | feedback@snackoh-bakers.com
- **Leadership:** ceo@snackoh-bakers.com

**Operating Hours:**
- Monday - Saturday: 6:00 AM - 8:00 PM
- Sunday: 7:00 AM - 6:00 PM

---

*Snackoh Bakers Management System v2.0*
*Last Updated: February 2026*

