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
          role: 'ADM' | 'GERENTE' | 'CONSULTOR';
          manager_key: string | null;
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
          role?: 'ADM' | 'GERENTE' | 'CONSULTOR';
          manager_key?: string | null;
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
          role?: 'ADM' | 'GERENTE' | 'CONSULTOR';
          manager_key?: string | null;
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
          client: string | null;
          color: string;
          status: string;
          manager: string | null;
          os: string | null;
          deadline: string | null;
          progress: number;
          is_private: boolean;
          tipo: 'MV' | 'Particular';
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          client?: string | null;
          color?: string;
          status?: string;
          manager?: string | null;
          os?: string | null;
          deadline?: string | null;
          progress?: number;
          is_private?: boolean;
          tipo?: 'MV' | 'Particular';
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          client?: string | null;
          color?: string;
          status?: string;
          manager?: string | null;
          os?: string | null;
          deadline?: string | null;
          progress?: number;
          is_private?: boolean;
          tipo?: 'MV' | 'Particular';
          created_at?: string;
        };
      };
      allocations: {
        Row: {
          id: string;
          consultant_id: string;
          project_id: string;
          date: string; // 1 registro = 1 dia
          os: string | null;
          manager: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultant_id: string;
          project_id: string;
          date: string;
          os?: string | null;
          manager?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          consultant_id?: string;
          project_id?: string;
          date?: string;
          os?: string | null;
          manager?: string | null;
          created_at?: string;
        };
      };
      expense_reports: {
        Row: {
          id: string;
          consultant_id: string;
          project_id: string | null;
          reference_date: string; // data da prestação de contas (coluna date)
          amount: number;
          kind: 'MV' | 'Particular';
          notes: string | null;
          status: 'pending' | 'paid';
          paid_at: string | null;
          paid_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultant_id: string;
          project_id?: string | null;
          reference_date: string;
          amount: number;
          kind?: 'MV' | 'Particular';
          notes?: string | null;
          status?: 'pending' | 'paid';
          paid_at?: string | null;
          paid_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          consultant_id?: string;
          project_id?: string | null;
          reference_date?: string;
          amount?: number;
          kind?: 'MV' | 'Particular';
          notes?: string | null;
          status?: 'pending' | 'paid';
          paid_at?: string | null;
          paid_by?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
