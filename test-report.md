# Test Report — Snackoh Bakers Management System

**Date:** 2026-02-27
**Framework:** Vitest 4.x
**Environment:** Node.js v22.22.0

## Summary

| Metric | Value |
|---|---|
| Total Tests | 278 |
| Passed | 278 |
| Failed | 0 |
| Skipped | 0 |
| Pass Rate | 100.0% |
| Test Suites | 81 |
| Status | PASS |

## Test Suites

### [PASS] api-routes.test.ts

**API: /api/auth/create-user**

| Test | Status | Duration |
|---|---|---|
| should return 400 when email is missing | PASS | 24.89514500000007ms |
| should return 400 when password is missing | PASS | 1.8103580000000647ms |
| should return 400 when password is too short | PASS | 1.7056630000000723ms |
| should return 400 for invalid email format | PASS | 1.5697890000000143ms |
| should successfully create a user with valid input | PASS | 2.8290199999999004ms |

**API: /api/mpesa**

| Test | Status | Duration |
|---|---|---|
| should return 400 when phone is missing | PASS | 23.639175000000023ms |
| should return 400 when amount is missing | PASS | 0.6363119999999753ms |
| should return 400 when match action has no amount | PASS | 0.6145750000000589ms |

**API: /api/mpesa/settings**

| Test | Status | Duration |
|---|---|---|
| should return 400 when settings object is missing (POST) | PASS | 9.163635ms |
| should return success for GET request | PASS | 0.8867279999999482ms |

**API: /api/distance**

| Test | Status | Duration |
|---|---|---|
| should return 400 when origin is missing | PASS | 6.3468540000000075ms |
| should return 400 when destination is missing | PASS | 0.40085099999998874ms |

**API: /api/mpesa/callback**

| Test | Status | Duration |
|---|---|---|
| should handle empty body gracefully | PASS | 8.173865999999975ms |
| should handle invalid JSON body gracefully | PASS | 0.7117470000000594ms |
| should handle successful payment callback | PASS | 1.2164050000000088ms |
| should handle failed payment callback | PASS | 0.7755050000000665ms |

### [PASS] audit-logger.test.ts

**Audit Logger**

| Test | Status | Duration |
|---|---|---|
| should log an audit entry with user info | PASS | 30.698684999999955ms |
| should log with "System" when no user is authenticated | PASS | 0.4570840000000089ms |
| should handle insert errors gracefully (fire-and-forget) | PASS | 1.3982140000000527ms |
| should handle auth errors gracefully | PASS | 0.6745240000000194ms |
| should use email prefix as name when full_name is not set | PASS | 0.5082310000000234ms |
| should support all audit action types | PASS | 0.2874219999999923ms |

### [PASS] cart-context.test.tsx

**Cart Context**

| Test | Status | Duration |
|---|---|---|
| should start with empty cart | PASS | 12.828466999999932ms |

**Cart Context > addItem**

| Test | Status | Duration |
|---|---|---|
| should add an item to the cart | PASS | 3.881654000000026ms |
| should increment quantity when adding same item twice | PASS | 3.2696600000000444ms |
| should add multiple different items | PASS | 2.0994680000000017ms |
| should open cart when item is added | PASS | 1.7853169999999636ms |

**Cart Context > removeItem**

| Test | Status | Duration |
|---|---|---|
| should remove an item from the cart | PASS | 1.4649530000000368ms |
| should handle removing non-existent item gracefully | PASS | 1.42025000000001ms |

**Cart Context > updateQty**

| Test | Status | Duration |
|---|---|---|
| should update item quantity | PASS | 1.3132970000000341ms |
| should remove item when quantity is set to 0 | PASS | 1.8165920000000142ms |
| should remove item when quantity is negative | PASS | 1.4088420000000497ms |

**Cart Context > clearCart**

| Test | Status | Duration |
|---|---|---|
| should remove all items from the cart | PASS | 1.2421749999999747ms |

**Cart Context > Cart Calculations**

| Test | Status | Duration |
|---|---|---|
| should calculate correct total with mixed quantities | PASS | 1.0749369999999772ms |

**Cart Context > Cart Visibility**

| Test | Status | Duration |
|---|---|---|
| should open and close cart | PASS | 0.9860509999999749ms |

**Cart Context > Error Handling**

| Test | Status | Duration |
|---|---|---|
| should throw when useCart is used outside CartProvider | PASS | 4.294434000000024ms |

### [PASS] db-utils.test.ts

**db-utils > toSnake**

| Test | Status | Duration |
|---|---|---|
| should convert camelCase keys to snake_case | PASS | 1.1681559999999536ms |
| should handle single-word keys (no conversion needed) | PASS | 0.15761800000007042ms |
| should handle empty object | PASS | 0.0875260000000253ms |
| should handle keys with multiple uppercase letters | PASS | 0.2606509999999389ms |
| should preserve values of different types | PASS | 0.36873500000001513ms |
| should handle consecutive uppercase letters | PASS | 0.19941400000004705ms |

**db-utils > toCamel**

| Test | Status | Duration |
|---|---|---|
| should convert snake_case keys to camelCase | PASS | 0.2360599999999522ms |
| should handle single-word keys (no conversion needed) | PASS | 0.09766000000001895ms |
| should handle empty object | PASS | 0.22852199999999812ms |
| should handle database-style keys | PASS | 0.16716500000006818ms |
| should preserve values of different types | PASS | 0.12735300000008465ms |

**db-utils > toSnake <-> toCamel roundtrip**

| Test | Status | Duration |
|---|---|---|
| should roundtrip camelCase -> snake_case -> camelCase | PASS | 0.07856300000003102ms |
| should roundtrip snake_case -> camelCase -> snake_case | PASS | 0.06626800000003641ms |

**db-utils > mapFromDb**

| Test | Status | Duration |
|---|---|---|
| should convert array of snake_case rows to camelCase | PASS | 0.11424799999997504ms |
| should handle empty array | PASS | 0.050116000000002714ms |
| should handle single-item array | PASS | 0.0655420000000504ms |

**db-utils > mapToDb**

| Test | Status | Duration |
|---|---|---|
| should convert camelCase to snake_case and exclude default keys | PASS | 0.4793490000000702ms |
| should exclude custom keys | PASS | 0.08825400000000627ms |
| should exclude undefined values | PASS | 0.0903569999999263ms |
| should handle empty object | PASS | 0.05046700000002602ms |
| should keep null values (only exclude undefined) | PASS | 0.06289300000003095ms |

### [PASS] module-crud-schemas.test.ts

**Module CRUD Schema Validation > Module: recipes (table: recipes)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 1.0133830000000899ms |
| should have sample data available | PASS | 0.1306049999999459ms |
| sample data should satisfy all required fields | PASS | 0.2817129999999679ms |
| sample data fields should have correct types | PASS | 0.3325370000000021ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.122820000000047ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.19472399999995105ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.11854200000004766ms |

**Module CRUD Schema Validation > Module: inventory (table: inventory_items)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.08646199999998316ms |
| should have sample data available | PASS | 0.16756999999995514ms |
| sample data should satisfy all required fields | PASS | 0.19344100000000708ms |
| sample data fields should have correct types | PASS | 0.09397500000000036ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.033049000000005435ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.08968899999990754ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.031245000000012624ms |

**Module CRUD Schema Validation > Module: orders (table: orders)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.0484679999999571ms |
| should have sample data available | PASS | 0.029760000000010223ms |
| sample data should satisfy all required fields | PASS | 0.1845260000000053ms |
| sample data fields should have correct types | PASS | 0.0651509999999007ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.02873299999998835ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.062190000000100554ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.030494999999973516ms |

**Module CRUD Schema Validation > Module: customers (table: customers)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.0439689999999473ms |
| should have sample data available | PASS | 0.028155999999967207ms |
| sample data should satisfy all required fields | PASS | 0.05880200000001423ms |
| sample data fields should have correct types | PASS | 0.06261299999994208ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.027760000000057516ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.08202099999994061ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.030397999999991043ms |

**Module CRUD Schema Validation > Module: employees (table: employees)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.042248000000085995ms |
| should have sample data available | PASS | 0.026920000000018263ms |
| sample data should satisfy all required fields | PASS | 0.1912049999999681ms |
| sample data fields should have correct types | PASS | 0.06436700000006113ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.030571000000009008ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.07006300000000465ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.03265699999997196ms |

**Module CRUD Schema Validation > Module: production (table: production_runs)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.04888000000005377ms |
| should have sample data available | PASS | 0.027910000000019863ms |
| sample data should satisfy all required fields | PASS | 0.13704900000004727ms |
| sample data fields should have correct types | PASS | 0.08786200000008648ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.030833000000029642ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.8195759999999837ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.10572700000000168ms |

**Module CRUD Schema Validation > Module: pricing (table: pricing_tiers)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.06240500000001248ms |
| should have sample data available | PASS | 0.0402360000000499ms |
| sample data should satisfy all required fields | PASS | 0.153020999999967ms |
| sample data fields should have correct types | PASS | 0.045995000000061737ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.02749000000005708ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.0428229999999985ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.029178000000001703ms |

**Module CRUD Schema Validation > Module: expenses (table: expenses)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03669600000000628ms |
| should have sample data available | PASS | 0.025840000000016516ms |
| sample data should satisfy all required fields | PASS | 0.13184100000000853ms |
| sample data fields should have correct types | PASS | 0.05020999999999276ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.02560300000004645ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.04856599999993705ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.03351899999995567ms |

**Module CRUD Schema Validation > Module: debtors (table: debtors)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.037336999999979525ms |
| should have sample data available | PASS | 0.025339999999914653ms |
| sample data should satisfy all required fields | PASS | 0.07226199999990968ms |
| sample data fields should have correct types | PASS | 0.03384800000003452ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.0771869999999808ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.03687800000000152ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.02736200000003919ms |

**Module CRUD Schema Validation > Module: creditors (table: creditors)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.04397700000004079ms |
| should have sample data available | PASS | 0.02746300000001156ms |
| sample data should satisfy all required fields | PASS | 0.07563700000002882ms |
| sample data fields should have correct types | PASS | 0.03259200000002238ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.027779000000009546ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.03300000000001546ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.03694900000004964ms |

**Module CRUD Schema Validation > Module: deliveries (table: deliveries)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.034639999999967586ms |
| should have sample data available | PASS | 0.025388999999904627ms |
| sample data should satisfy all required fields | PASS | 0.07333900000003268ms |
| sample data fields should have correct types | PASS | 0.04099400000006881ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.02366499999993721ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.0405750000001035ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.029990999999995438ms |

**Module CRUD Schema Validation > Module: pos_sales (table: pos_sales)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03379900000004454ms |
| should have sample data available | PASS | 0.023843000000056236ms |
| sample data should satisfy all required fields | PASS | 0.11816099999998642ms |
| sample data fields should have correct types | PASS | 0.043385000000057516ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.02459400000009282ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.0422240000000329ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.026515000000017608ms |

**Module CRUD Schema Validation > Module: waste_records (table: waste_records)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.032409000000029664ms |
| should have sample data available | PASS | 0.024271999999996297ms |
| sample data should satisfy all required fields | PASS | 0.10182000000008884ms |
| sample data fields should have correct types | PASS | 0.04157599999996364ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.024232999999981075ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.04026699999997163ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.026275000000055115ms |

**Module CRUD Schema Validation > Module: assets (table: assets)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03225800000006984ms |
| should have sample data available | PASS | 0.023608999999964908ms |
| sample data should satisfy all required fields | PASS | 0.1005729999999403ms |
| sample data fields should have correct types | PASS | 0.04112299999997049ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.0240120000000843ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.039603000000056454ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.02437099999997372ms |

**Module CRUD Schema Validation > Module: outlets (table: outlets)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.033392999999932726ms |
| should have sample data available | PASS | 0.024994999999989886ms |
| sample data should satisfy all required fields | PASS | 0.07488799999998719ms |
| sample data fields should have correct types | PASS | 0.04137500000001637ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.025187999999957356ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.042397000000050866ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.02535800000009658ms |

**Module CRUD Schema Validation > Module: food_info (table: food_info)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03407500000002983ms |
| should have sample data available | PASS | 0.02469199999995908ms |
| sample data should satisfy all required fields | PASS | 0.0465439999999262ms |
| sample data fields should have correct types | PASS | 0.043756000000030326ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.025328999999942425ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.04197799999997187ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.03750400000001264ms |

**Module CRUD Schema Validation > Module: lot_tracking (table: lot_tracking)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03539499999999407ms |
| should have sample data available | PASS | 0.025977000000011685ms |
| sample data should satisfy all required fields | PASS | 0.10737700000004224ms |
| sample data fields should have correct types | PASS | 0.04296799999997347ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.024994999999989886ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.04242199999998775ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.029178000000001703ms |

**Module CRUD Schema Validation > Module: audit_log (table: audit_log)**

| Test | Status | Duration |
|---|---|---|
| should have a defined schema with fields | PASS | 0.03649499999994532ms |
| should have sample data available | PASS | 0.025109999999926913ms |
| sample data should satisfy all required fields | PASS | 0.10887700000000677ms |
| sample data fields should have correct types | PASS | 0.04400199999997767ms |
| CREATE: should fail validation when required fields are missing | PASS | 0.025218999999992775ms |
| READ: schema fields should have consistent naming (snake_case) | PASS | 0.043337999999948806ms |
| UPDATE: partial data should be valid (not all fields required) | PASS | 0.029527000000030057ms |

**Business Rule Validation > orders — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.6157079999999269ms |
| should have multiple valid status transitions defined | PASS | 0.07471800000007534ms |

**Business Rule Validation > production — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.08343200000001616ms |
| should have multiple valid status transitions defined | PASS | 0.03329800000005889ms |

**Business Rule Validation > deliveries — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.05797000000006847ms |
| should have multiple valid status transitions defined | PASS | 0.028593999999998232ms |

**Business Rule Validation > pos_sales — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.051341999999976906ms |
| should have multiple valid status transitions defined | PASS | 0.026791000000002896ms |

**Business Rule Validation > assets — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.06676699999991342ms |
| should have multiple valid status transitions defined | PASS | 0.029605999999944288ms |

**Business Rule Validation > outlets — status values**

| Test | Status | Duration |
|---|---|---|
| should have valid status in sample data | PASS | 0.048377999999956955ms |
| should have multiple valid status transitions defined | PASS | 0.026336000000014792ms |

**Business Rule Validation > Payment validation**

| Test | Status | Duration |
|---|---|---|
| order payment_status should be valid | PASS | 0.05648400000006859ms |
| POS payment_method should be valid | PASS | 0.05046500000003107ms |
| order total should be positive | PASS | 0.03752699999995457ms |
| POS sale total should be positive | PASS | 0.03355799999997089ms |

**Business Rule Validation > Employee role validation**

| Test | Status | Duration |
|---|---|---|
| employee login_role should be a valid role | PASS | 0.14346399999999448ms |
| should have comprehensive role list covering all access levels | PASS | 0.07381600000007893ms |

**Business Rule Validation > Pricing validation**

| Test | Status | Duration |
|---|---|---|
| base_price should be >= cost_price | PASS | 0.04445500000008451ms |
| prices should be positive numbers | PASS | 0.046469999999999345ms |

**Business Rule Validation > Inventory validation**

| Test | Status | Duration |
|---|---|---|
| quantity should be non-negative | PASS | 0.0352420000000393ms |
| reorder_level should be non-negative | PASS | 0.03556000000003223ms |
| unit_cost should be positive | PASS | 0.05810400000007121ms |

**Business Rule Validation > Audit log validation**

| Test | Status | Duration |
|---|---|---|
| action should be a valid audit action | PASS | 0.08645400000000336ms |
| module should be a non-empty string | PASS | 0.05647600000008879ms |

**Module Coverage Summary**

| Test | Status | Duration |
|---|---|---|
| should cover all 18 major modules | PASS | 0.041835999999989326ms |
| all modules should have sample data for CREATE testing | PASS | 0.25782700000002023ms |
| should have status validation for stateful modules | PASS | 0.10258499999997639ms |

### [PASS] products.test.ts

**Products Module > Product Data Integrity**

| Test | Status | Duration |
|---|---|---|
| should have products loaded | PASS | 1.0127780000000257ms |
| should have unique product IDs | PASS | 0.2604350000000295ms |
| every product should have required fields | PASS | 6.4073000000000775ms |
| every product should belong to a valid category | PASS | 1.9445090000000391ms |
| should have products in each category | PASS | 0.24164199999995617ms |
| all products should have stock > 0 and be in stock | PASS | 0.9350410000000693ms |

**Products Module > getProduct**

| Test | Status | Duration |
|---|---|---|
| should find a product by ID | PASS | 0.18203400000004422ms |
| should return undefined for non-existent product | PASS | 0.09819500000003245ms |
| should find products for all known IDs | PASS | 0.2528790000000072ms |

**Products Module > getBestSellers**

| Test | Status | Duration |
|---|---|---|
| should return only products marked as best sellers | PASS | 0.18596200000001772ms |
| should return a subset of all products | PASS | 0.08003100000007635ms |

**Products Module > getOnOffer**

| Test | Status | Duration |
|---|---|---|
| should return products that are on sale or have offers | PASS | 0.14386000000001786ms |
| should include products with originalPrice | PASS | 0.059290000000032705ms |

**Products Module > getRelated**

| Test | Status | Duration |
|---|---|---|
| should return products in the same category | PASS | 0.12286799999992581ms |
| should not include the original product | PASS | 0.06548500000008062ms |
| should return at most 4 products by default | PASS | 0.06728099999997994ms |
| should respect custom count parameter | PASS | 0.04293700000005174ms |
| should return empty array when no related products exist for a unique category | PASS | 0.4138709999999719ms |

**Products Module > Category Constants**

| Test | Status | Duration |
|---|---|---|
| CATEGORY_LIST should contain expected categories | PASS | 0.23883299999999963ms |
| CIRCLE_CATEGORIES should have entries with required fields | PASS | 0.25133500000004005ms |

### [PASS] supabase-crud.test.ts

**CRUD Helpers (lib/supabase.ts) > dbFetchAll**

| Test | Status | Duration |
|---|---|---|
| should fetch all rows from a table ordered by created_at descending | PASS | 28.952613000000042ms |
| should return empty array on error | PASS | 1.1800399999999627ms |
| should accept custom ordering | PASS | 0.5232100000000628ms |
| should return empty array when data is null | PASS | 0.589937999999961ms |

**CRUD Helpers (lib/supabase.ts) > dbFetchWithFilter**

| Test | Status | Duration |
|---|---|---|
| should fetch rows with filters applied | PASS | 0.7520129999999199ms |
| should apply multiple filters | PASS | 0.3279300000000376ms |
| should return empty array on error | PASS | 0.40277499999990596ms |

**CRUD Helpers (lib/supabase.ts) > dbInsert**

| Test | Status | Duration |
|---|---|---|
| should insert a row and return the result | PASS | 0.44601299999999355ms |
| should throw error on insert failure | PASS | 1.5033379999999852ms |

**CRUD Helpers (lib/supabase.ts) > dbUpdate**

| Test | Status | Duration |
|---|---|---|
| should update a row by id and return the result | PASS | 0.5316849999999249ms |
| should throw error on update failure | PASS | 0.45215600000005907ms |

**CRUD Helpers (lib/supabase.ts) > dbDelete**

| Test | Status | Duration |
|---|---|---|
| should delete a row by id and return true | PASS | 0.5403240000000551ms |
| should throw error on delete failure | PASS | 0.41291400000000067ms |

**CRUD Helpers (lib/supabase.ts) > dbUpsert**

| Test | Status | Duration |
|---|---|---|
| should upsert a row and return the result | PASS | 0.43602899999996225ms |
| should throw error on upsert failure | PASS | 0.4502949999999828ms |

**CRUD Helpers (lib/supabase.ts) > isSupabaseConfigured**

| Test | Status | Duration |
|---|---|---|
| should return true when environment variables are set | PASS | 0.20265100000005987ms |

### [PASS] user-permissions.test.ts

**User Permissions > getAllowedRoutes**

| Test | Status | Duration |
|---|---|---|
| should return empty array for admin users (meaning all routes allowed) | PASS | 1.2292410000000018ms |
| should return empty array for Super Admin | PASS | 0.14566600000000562ms |
| should return strictly limited routes for Rider role | PASS | 0.9478940000000193ms |
| should return strictly limited routes for Driver role | PASS | 0.40045600000007653ms |
| should return Baker default routes plus permission-based routes | PASS | 5.531573999999978ms |
| should return Cashier default routes | PASS | 0.22543999999993503ms |
| should return Sales default routes | PASS | 0.15612099999998463ms |
| should return minimal routes for Viewer role | PASS | 0.20595800000000963ms |
| should always include /admin/account and /admin/documentation | PASS | 23.02243400000009ms |
| should add outlet routes for outlet admin | PASS | 0.3707519999999249ms |
| should deduplicate routes | PASS | 0.16609600000003866ms |
| should map permission "Manage Finance" to finance routes | PASS | 0.14723500000002332ms |
| should map permission "System Settings" to settings routes | PASS | 0.1078420000000051ms |
| should map permission "Manage Recipes" to production routes | PASS | 0.1909449999999424ms |
| should map permission "Manage Employees" to HR routes | PASS | 0.08270099999992908ms |

**User Permissions > isRouteAllowed**

| Test | Status | Duration |
|---|---|---|
| should always return true for admin users | PASS | 0.11930799999993269ms |
| should return true for allowed routes | PASS | 0.07780300000001716ms |
| should return true for routes covered by /admin prefix in Cashier defaults | PASS | 0.0640250000000151ms |
| should return true for account page for all roles | PASS | 0.1857799999999088ms |
| should handle sub-routes (prefix matching) | PASS | 0.06041799999991326ms |
| should allow Driver access to delivery and default routes | PASS | 0.08019899999999325ms |
| should allow outlet admin routes when user is outlet admin | PASS | 0.05558900000005451ms |
| should deny outlet routes when user is not outlet admin | PASS | 0.0364519999999402ms |

### [PASS] utils.test.ts

**Utils > cn (className merger)**

| Test | Status | Duration |
|---|---|---|
| should merge class names | PASS | 4.747736000000032ms |
| should handle conditional classes | PASS | 0.21765700000003108ms |
| should remove conflicting Tailwind classes (last wins) | PASS | 0.2596690000000308ms |
| should handle falsy values | PASS | 0.23785499999996773ms |
| should handle empty input | PASS | 0.11149699999998575ms |
| should handle arrays of class names | PASS | 0.20520199999998567ms |
| should merge padding classes correctly | PASS | 0.14107799999999315ms |
| should handle complex conditional patterns | PASS | 0.20176499999990938ms |

## Modules Covered

| Module | Description |
|---|---|
| db-utils | camelCase/snake_case conversion utilities |
| supabase-crud | Generic CRUD helpers (fetch, insert, update, delete, upsert) |
| user-permissions | Role-based access control & route permissions |
| products | Product catalog, search, filtering |
| utils | CSS class name merger (cn) |
| audit-logger | Compliance audit trail logging |
| api-routes | API endpoint validation (auth, mpesa, distance) |
| module-crud-schemas | Schema validation for 18 database modules |
| cart-context | Shopping cart state management |
