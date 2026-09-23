# Deploying Ship Asaan to Vercel + Supabase (100% Free)

This guide walks you step-by-step through setting up your free Supabase PostgreSQL database and deploying the entire application (React SPA + Express API) onto Vercel.

---

## Step 1: Create Your Free Supabase Project (3 Minutes)

1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **"New Project"**.
3. Choose an organization, enter:
   - **Name**: `ship-asaan`
   - **Database Password**: Choose a strong password and save it securely.
   - **Region**: Select a region close to your users (e.g. `Singapore` or `Frankfurt`).
4. Click **"Create new project"** and wait ~1 minute for Supabase to provision.

---

## Step 2: Initialize Database Schema in Supabase

1. In your Supabase dashboard sidebar, click **SQL Editor** (the `>_` terminal icon).
2. Click **"New Query"**.
3. Open the file `supabase/schema.sql` from this codebase.
4. Copy all its contents, paste it into the Supabase SQL Editor, and click **"Run"** (or `Ctrl + Enter`).
5. You will see a success output: `"Ship Asaan Supabase schema created successfully"`.

---

## Step 3: Copy Your Supabase API Credentials

1. In Supabase, go to **Project Settings** (gear icon in sidebar) $\rightarrow$ **API**.
2. Find and copy:
   - **Project URL**: (e.g. `https://xyzcompany.supabase.co`)
   - **Project API keys**:
     - `anon` `public` key
     - `service_role` `secret` key *(Never share this key publicly)*

---

## Step 4: Push / Import Code to GitHub & Vercel

### A. Push Code to GitHub
Ensure all codebase files (including `vercel.json`, `api/index.ts`, `server/`, and `src/`) are committed and pushed to your GitHub repository.

### B. Deploy on Vercel
1. Log in to [https://vercel.com](https://vercel.com).
2. Click **"Add New..."** $\rightarrow$ **"Project"**.
3. Select your GitHub repository and click **"Import"**.
4. In the Project Configuration:
   - **Framework Preset**: `Vite` (automatically detected from `vercel.json`).
   - **Root Directory**: `./` (leave default).
   - **Build Command**: `vite build` (or leave default).
   - **Output Directory**: `dist` (leave default).

5. **Environment Variables**: Expand the "Environment Variables" section and add:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` secret key |
   | `SUPABASE_ANON_KEY` | Your Supabase `anon` public key |
   | `SESSION_SECRET` | A secure random string (e.g. `ship_asaan_secret_998124`) |
   | `ADMIN_EMAIL` | `admin@shipasaan.pk` (or your preferred initial admin email) |
   | `ADMIN_PASSWORD` | `AdminPass@2026` (or your preferred initial admin password) |

6. Click **"Deploy"**.
7. Vercel will build the frontend and deploy the serverless API in ~60 seconds.

---

## Step 5: Test & Verify Live Deployment

1. Once the deployment finishes, open your live Vercel domain (e.g. `https://ship-asaan.vercel.app`).
2. Test the health endpoint:
   ```
   https://your-app.vercel.app/health
   ```
   It should return:
   ```json
   {
     "status": "healthy",
     "system": "Ship Asaan Courier + Fulfillment",
     "timestamp": "..."
   }
   ```
3. Log in with the pre-seeded admin credentials:
   - **Email**: `admin@shipasaan.pk`
   - **Password**: `AdminPass@2026`
4. Verify you can view:
   - **Fulfillment Orders**
   - **Carrier Dispatch & Handover Manifests**
   - **Inventory Management & SKU Catalog**
   - **Receiving Freight Batches & Thermal Barcode Printing**
   - **Merchant Accounts & Financial Wallets**

---

## Step 6: Testing & Iteration Loop

As you test on Vercel, simply reply here with any issues, desired UI enhancements, or business rule changes:
1. You report findings.
2. I apply the fixes and adjustments.
3. You pull/deploy to Vercel and verify!
