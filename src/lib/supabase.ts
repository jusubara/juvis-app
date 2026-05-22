import { createClient } from '@supabase/supabase-js';
import { LogbookEntry } from '@/types/logbook';

export interface Database {
  public: {
    Tables: {
      logbook_entries: {
        Row: LogbookEntry;
        Insert: Omit<LogbookEntry, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<LogbookEntry, 'id'>>;
      };
    };
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
