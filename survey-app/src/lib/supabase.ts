import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Safety Check: Prevents initialization if keys are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing! Ensure .env.local is configured.")
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
)