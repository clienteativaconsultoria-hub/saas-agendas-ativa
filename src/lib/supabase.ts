import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'ADM' | 'CONSULTOR';
          avatar_url: string | null;
          phone: string | null;
          location: string | null;
          status: 'Ativo' | 'Inativo';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'ADM' | 'CONSULTOR';
          avatar_url?: string | null;
          phone?: string | null;
          location?: string | null;
          status?: 'Ativo' | 'Inativo';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'ADM' | 'CONSULTOR';
          avatar_url?: string | null;
          phone?: string | null;
          location?: string | null;
          status?: 'Ativo' | 'Inativo';
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          client_name: string;
          color: string;
          status: string;
          deadline: string | null;
          progress: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          client_name: string;
          color: string;
          status: string;
          deadline?: string | null;
          progress?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          client_name?: string;
          color?: string;
          status?: string;
          deadline?: string | null;
          progress?: number;
          created_at?: string;
        };
      };
      allocations: {
        Row: {
          id: string;
          consultant_id: string;
          project_id: string;
          start_date: string;
          end_date: string; // Using start/end simplifies ranges vs just 'week'
          days: number;
          os: string | null;
          manager: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultant_id: string;
          project_id: string;
          start_date: string;
          end_date: string;
          days: number;
          os?: string | null;
          manager?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          consultant_id?: string;
          project_id?: string;
          start_date?: string;
          end_date?: string;
          days?: number;
          os?: string | null;
          manager?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
