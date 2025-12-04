import { createClient } from '@supabase/supabase-js'

// 1. Read env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 2. Debug log BEFORE createClient
console.log('URL:', supabaseUrl)
console.log(
  'ANON KEY:',
  supabaseAnonKey ? 'Loaded' : 'Missing'
)

// 3. Helpful errors if missing
if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL. Check your .env.local file in the project root.'
  )
}
if (!supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env.local file in the project root.'
  )
}

// 4. Create client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
