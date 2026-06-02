import React, { useState, useEffect } from 'react';
import {
  Calendar, Search, LogOut, Loader2, AlertCircle, Lock, Mail,
  User, Briefcase, FileText, CalendarDays, ChevronRight, ArrowRight
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

const MASKED_PROJECT_ID = 'private-masked';
const HIDDEN_EMAILS = ['andreimagagna@gmail.com', 'andrei@futuree.org'];

// Normaliza nome de gerente p/ casar GERENTE logado ↔ campo manager das agendas.
const normManager = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

type Role = 'ADM' | 'GERENTE' | 'CONSULTOR' | null;
type Consultant = { id: string; name: string; email?: string };
type Project = { id: string; name: string; is_private?: boolean };
type Alloc = {
  id: string;
  consultantId: string;
  projectId: string;
  date: string;
  os: string | null;
  manager: string | null;
};

export function MobileView() {
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return session ? <MobileSchedule /> : <MobileLogin />;
}

// ---------------- Login compacto ----------------
function MobileLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch {
      setError('Credenciais inválidas. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-50 flex flex-col justify-center px-5">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-md">
          <Calendar className="w-8 h-8" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-navy-900">
          Agendas
        </h1>
        <p className="text-sm text-navy-500 mt-1">Consulta rápida no celular</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}
        <div className="relative">
          <Mail className="w-5 h-5 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="nome@empresa.com"
            className="w-full pl-11 pr-4 py-3.5 text-base border border-navy-200 rounded-xl bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="relative">
          <Lock className="w-5 h-5 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full pl-11 pr-4 py-3.5 text-base border border-navy-200 rounded-xl bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 rounded-xl text-base font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-70 transition-all"
        >
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Entrando...</> : <>Entrar <ArrowRight className="ml-2 w-5 h-5" /></>}
        </button>
      </form>
    </div>
  );
}

// ---------------- Consulta ----------------
function MobileSchedule() {
  const [loading, setLoading] = useState(true);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Alloc[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'today' | 'week'>('today');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let r: Role = 'CONSULTOR';
      let managerKey: string | null = null;
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role, manager_key').eq('id', user.id).single();
        if (profile) {
          r = profile.role as Role;
          managerKey = profile.manager_key ?? null;
        }
      }

      const { data: consData } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
      let cons = (consData || [])
        .map((c: any) => ({ id: c.id, name: c.full_name, email: c.email }))
        .filter(c => !HIDDEN_EMAILS.includes((c.email || '').toLowerCase()));
      if (r === 'CONSULTOR' && user) cons = cons.filter(c => c.id === user.id);
      setConsultants(cons);

      const { data: projData } = await supabase.from('projects').select('id, name, is_private');
      const visible = new Set((projData || []).map((p: any) => p.id));
      setProjects([
        ...((projData || []) as Project[]),
        { id: MASKED_PROJECT_ID, name: 'Particular', is_private: true }
      ]);

      let allocQ = supabase.from('allocations').select('*');
      if (r === 'CONSULTOR' && user) allocQ = allocQ.eq('consultant_id', user.id);
      const { data: allocData } = await allocQ;
      let allocs: Alloc[] = (allocData || []).map((a: any) => {
        const masked = r !== 'ADM' && !visible.has(a.project_id);
        return {
          id: a.id,
          consultantId: a.consultant_id,
          projectId: masked ? MASKED_PROJECT_ID : a.project_id,
          date: a.date,
          os: masked ? null : a.os,
          manager: masked ? null : a.manager,
        };
      });
      // Escopo do GERENTE: só as agendas do manager vinculado a ele (privado já vem mascarado).
      if (r === 'GERENTE' && managerKey) {
        allocs = allocs.filter(a => normManager(a.manager) === normManager(managerKey));
      }
      setAllocations(allocs);
      setLoading(false);
    })();
  }, []);

  const consultantName = (id: string) => consultants.find(c => c.id === id)?.name || '—';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || '—';

  const today = new Date();
  const weekDays = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 })
  });

  const dateRange = tab === 'today' ? [today] : weekDays;

  const q = query.trim().toLowerCase();
  const matches = (a: Alloc) =>
    !q ||
    consultantName(a.consultantId).toLowerCase().includes(q) ||
    projectName(a.projectId).toLowerCase().includes(q) ||
    (a.os || '').toLowerCase().includes(q) ||
    (a.manager || '').toLowerCase().includes(q);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen bg-navy-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-navy-100 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="font-bold text-navy-900">Agendas</span>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-primary-500">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Search */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar consultor, projeto ou OS..."
            className="w-full pl-11 pr-4 py-3 text-base border border-navy-200 rounded-xl bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-xl border border-navy-100">
          {([['today', 'Hoje'], ['week', 'Semana']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === v ? 'bg-primary-600 text-white' : 'text-navy-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4 pb-8 space-y-5">
        {loading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : (
          dateRange.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayAllocs = allocations.filter(a => a.date === dayStr && matches(a));
            if (tab === 'today' && dayAllocs.length === 0) {
              return (
                <div key={dayStr} className="text-center text-navy-400 pt-12">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">Nenhuma agenda para hoje</p>
                  {q && <p className="text-xs mt-1">com o filtro "{query}"</p>}
                </div>
              );
            }
            if (dayAllocs.length === 0) return null;
            return (
              <div key={dayStr}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isSameDay(day, today) ? 'text-primary-600' : 'text-navy-500'}`}>
                    {format(day, "EEEE, dd 'de' MMM", { locale: ptBR })}
                  </span>
                  {isSameDay(day, today) && (
                    <span className="text-[10px] font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">HOJE</span>
                  )}
                </div>
                <div className="space-y-2">
                  {dayAllocs.map(a => (
                    <div key={a.id} className="bg-white rounded-xl border border-navy-100 p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-navy-900 flex items-center gap-1.5 truncate">
                            <Briefcase className="w-4 h-4 text-primary-600 shrink-0" />
                            {projectName(a.projectId)}
                          </p>
                          <p className="text-sm text-navy-600 flex items-center gap-1.5 mt-1 truncate">
                            <User className="w-3.5 h-3.5 text-navy-400 shrink-0" />
                            {consultantName(a.consultantId)}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-navy-300 mt-1 shrink-0" />
                      </div>
                      {(a.os || a.manager) && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {a.os && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 bg-navy-50 border border-navy-100 rounded-full px-2 py-0.5">
                              <FileText className="w-3 h-3" /> OS {a.os}
                            </span>
                          )}
                          {a.manager && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 bg-navy-50 border border-navy-100 rounded-full px-2 py-0.5">
                              <User className="w-3 h-3" /> {a.manager}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
