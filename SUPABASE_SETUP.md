# Supabase Setup Guide

This application now uses Supabase as its database backend instead of localStorage and file system storage.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Setup Steps

### 1. Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Wait for your project to be provisioned (takes 1-2 minutes)

### 2. Run the Database Schema

1. In your Supabase project dashboard, navigate to the **SQL Editor**
2. Copy the contents of `supabase-schema.sql` from this project
3. Paste it into the SQL Editor
4. Click **Run** to execute the schema

This will create three tables:
- `invoiceparser_invoices` - Stores invoice header data
- `invoiceparser_line_items` - Stores invoice line items
- `invoiceparser_manual_values` - Stores manual value entries

### 3. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon public key** (under "Project API keys")

### 4. Configure Environment Variables

1. Create a file named `.env.local` in the project root (next to `package.json`)
2. Add the following content, replacing with your actual values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Never commit `.env.local` to version control! It's already in `.gitignore`.

### 5. Deploy to Vercel

When deploying to Vercel:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add both environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redeploy your application

## Migrating Existing Data

If you have existing data in localStorage or JSON files, you can:

1. Export your data using the "Export as JSON" button in the application
2. Import it back using the "Import JSON" button after setting up Supabase
3. The imported data will be automatically saved to Supabase

## Database Security

The current setup uses Row Level Security (RLS) with policies that allow all operations. For production use, you should:

1. Update the RLS policies to restrict access based on user authentication
2. Implement user authentication (Supabase Auth)
3. Update policies to only allow users to access their own data

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env.local` exists in the project root
- Verify the variable names are exactly: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart your development server after creating `.env.local`

### "Failed to load invoices" error
- Check that you ran the `supabase-schema.sql` script in your Supabase SQL Editor
- Verify the table names have the `invoiceparser_` prefix
- Check the browser console for detailed error messages

### Connection issues
- Verify your Supabase project is active (not paused)
- Check that your API keys are correct
- Ensure you're using the anon key, not the service role key
