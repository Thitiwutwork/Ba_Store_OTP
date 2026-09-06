import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://zbbzampukyqdjjbbcjzl.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnphbXB1a3lxZGpqYmJjanpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjE3NzUsImV4cCI6MjEwMDc5Nzc3NX0.BZCJrefgz504fke2Pvr00mqY6_d5bt9yerjdM2w4IOk";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
