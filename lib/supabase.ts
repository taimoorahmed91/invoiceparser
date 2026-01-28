import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('Supabase Key:', supabaseAnonKey ? 'Set' : 'Missing');
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Log that Supabase is configured (but don't log the actual values)
console.log('Supabase configured:', {
  url: supabaseUrl.substring(0, 20) + '...',
  keyPrefix: supabaseAnonKey.substring(0, 10) + '...'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
