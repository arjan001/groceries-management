# Snackoh Bakers Management System

A comprehensive bakery ERP (Enterprise Resource Planning) and e-commerce platform built with Next.js. The system manages production, inventory, sales, deliveries, finance, and multi-branch operations for a bakery business.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 with Shadcn/UI components
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + Auth)
- **Payments:** M-Pesa STK Push integration
- **Package Manager:** pnpm

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [pnpm](https://pnpm.io/) package manager
- A [Supabase](https://supabase.com/) project with the database schema applied

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd bakery-system
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and fill in your Supabase and M-Pesa credentials. See the [Environment Variables](#environment-variables) section below for details.

4. Set up the database:

   Apply the base schema from `lib/supabase-schema.sql` to your Supabase project, then apply any migration files from `lib/migration-*.sql` in order.

5. Start the development server:

   ```bash
   pnpm dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure the following:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |
| `NEXT_PUBLIC_SITE_URL` | Your deployed site URL (used for callbacks) |
| `MPESA_CONSUMER_KEY` | M-Pesa Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | M-Pesa Daraja API consumer secret |
| `MPESA_PASSKEY` | M-Pesa passkey for STK Push |
| `MPESA_SHORTCODE` | M-Pesa business shortcode |
| `MPESA_CALLBACK_URL` | Public URL for M-Pesa payment callbacks |
| `MPESA_ENV` | M-Pesa environment: `sandbox` or `production` |
| `MPESA_B2C_*` | B2C disbursement configuration (optional) |

## Project Structure

```
app/
  (website)/          # Public e-commerce storefront (shop, cart, checkout)
  admin/              # Admin dashboard with 40+ modules
    pos/              # Point of Sale system
    orders/           # Order management
    production/       # Production runs and scheduling
    recipes/          # Recipe management with AI generation
    inventory/        # Stock tracking and reorder alerts
    outlets/          # Multi-branch management
    delivery/         # Delivery scheduling and rider tracking
    employees/        # HR and employee management
    expenses/         # Finance and expense tracking
    documentation/    # In-app employee training manual
    ...
  api/                # API routes (auth, M-Pesa, distance)
  auth/               # Authentication pages (login, signup)
components/
  ui/                 # Shadcn/UI component library
lib/
  supabase.ts         # Supabase client and CRUD helpers
  supabase-schema.sql # Complete database schema
  migration-*.sql     # Database migration files
  user-permissions.tsx # Permission context and role-based routing
  products.ts         # Product catalog data
middleware.ts         # Server-side route protection and auth
```

## Key Features

- **Role-Based Access Control** -- Granular permissions with roles like Admin, Baker, Cashier, Sales, Rider, and custom roles
- **Point of Sale (POS)** -- In-store sales processing with M-Pesa and cash payments
- **Production Management** -- Recipe costing, production runs, picking lists, lot tracking, and waste control
- **Inventory & Purchasing** -- Stock tracking, reorder alerts, purchase orders, and supplier management
- **Multi-Branch Operations** -- Independent branch inventory, requisitions, returns, and reporting
- **Order & Delivery Tracking** -- End-to-end order lifecycle with rider assignments and real-time tracking
- **Finance** -- Expense recording, debtors/creditors tracking, and financial reporting
- **E-Commerce** -- Public storefront with M-Pesa checkout and delivery scheduling
- **Audit Logging** -- Full system activity tracking for compliance
- **AI Recipe Generation** -- AI-powered recipe creation with ingredient lists and costing

## Documentation

- **Employee Training Manual:** Available at `/admin/documentation` within the app, or see [`EMPLOYEE_TRAINING_MANUAL.md`](./EMPLOYEE_TRAINING_MANUAL.md)
- **Database Schema:** See [`lib/supabase-schema.sql`](./lib/supabase-schema.sql) for the full schema definition

## Deployment

The project is configured for deployment on [Netlify](https://netlify.com/). Push to the main branch to trigger an automatic build and deploy.

For manual deployment:

```bash
pnpm build
```

Ensure all environment variables are configured in your hosting platform's settings.

## License

Private -- All rights reserved.
