import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Download, Search, Calendar as CalendarIcon, FileSpreadsheet, FileText,
  Users, Briefcase, CalendarCheck, CalendarX, Loader2, ChevronDown, UserCog
} from 'lucide-react';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfQuarter, endOfQuarter, eachDayOfInterval, isWeekend
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';

const HIDDEN_EMAILS = ['andreimagagna@gmail.com', 'andrei@futuree.org'];
const CHART_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e40af', '#2563eb', '#1d4ed8', '#1e3a8a'];

type PeriodPreset = 'month' | 'week' | 'quarter' | 'custom';
// O que o relatório traz: dias com agenda, dias livres, ou os dois.
type AgendaKind = 'ocupadas' | 'disponiveis' | 'todas';

type Consultant = { id: string; full_name: string };
type Project = { id: string; name: string; client: string | null };

type AgendaRow = {
  id: string;
  date: string;
  os: string | null;
  manager: string | null;
  consultantId: string;
  consultantName: string;
  projectName: string;
  projectClient: string | null;
};

// Um bloco contínuo de dias livres do mesmo consultor (é o "período disponível").
type FreeBlock = {
  consultantId: string;
  consultantName: string;
  start: string;
  end: string;
  days: number;
};

type Result = {
  rows: AgendaRow[];          // agendas já filtradas (tabela + gráficos)
  free: FreeBlock[];          // períodos disponíveis
  days: string[];             // dias considerados no período
  scope: Consultant[];        // consultores que entraram na conta de disponibilidade
  occupiedByConsultant: Record<string, number>;
  period: { start: string; end: string };
  kind: AgendaKind;
  businessOnly: boolean;
  truncated: boolean;
};

// Casa nome de gerente ignorando acento/caixa/espaço (ROSE, Rose e Rosé são o mesmo).
const normManager = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const br = (iso: string) => {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<string[]>([]);

  const [selectedConsultant, setSelectedConsultant] = useState('all');
  const [selectedManager, setSelectedManager] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [kind, setKind] = useState<AgendaKind>('todas');
  const [businessOnly, setBusinessOnly] = useState(true);

  const [result, setResult] = useState<Result | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  // A lista de gerentes vem do campo livre `manager` das agendas, e o PostgREST
  // não faz DISTINCT — então varre em páginas, senão só apareceriam os gerentes
  // que aparecem nas primeiras 1.000 agendas.
  const fetchManagerNames = async () => {
    const PAGE = 1000;
    const MAX_PAGES = 10;
    const out: (string | null)[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase
        .from('allocations')
        .select('manager')
        .not('manager', 'is', null)
        .order('manager', { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) break;
      out.push(...(data || []).map(m => (m as { manager: string | null }).manager));
      if (!data || data.length < PAGE) break;
    }
    return out;
  };

  const fetchFilters = async () => {
    const [{ data: profileData }, { data: projectData }, managerData] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').neq('role', 'GERENTE').order('full_name'),
      supabase.from('projects').select('id, name, client').order('name'),
      fetchManagerNames()
    ]);

    const visible = (profileData || []).filter(
      p => !HIDDEN_EMAILS.includes(((p as { email?: string }).email || '').toLowerCase())
    );
    setConsultants(visible.map(p => ({ id: p.id, full_name: p.full_name })));
    setProjects((projectData || []) as Project[]);

    // Um nome por gerente, mesmo que o campo esteja escrito de jeitos diferentes.
    const seen = new Map<string, string>();
    (managerData || []).forEach(raw => {
      const key = normManager(raw);
      if (key && !seen.has(key)) seen.set(key, (raw || '').trim());
    });
    setManagers([...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  };

  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    if (preset === 'month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (preset === 'week') {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (preset === 'quarter') {
      setStartDate(format(startOfQuarter(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfQuarter(now), 'yyyy-MM-dd'));
    }
  };

  const periodLabel = () => `${br(startDate)} — ${br(endDate)}`;

  // O Supabase devolve no máximo 1.000 linhas por chamada; períodos longos precisam de página.
  const fetchAllAllocations = async (consultantId: string) => {
    const PAGE = 1000;
    const MAX_PAGES = 20;
    const all: Record<string, unknown>[] = [];
    let page = 0;
    let truncated = false;

    while (page < MAX_PAGES) {
      let q = supabase
        .from('allocations')
        .select('id, date, os, manager, consultant_id, project_id')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (consultantId !== 'all') q = q.eq('consultant_id', consultantId);

      const { data, error } = await q;
      if (error) throw error;

      all.push(...(data || []));
      if (!data || data.length < PAGE) break;
      page++;
      if (page === MAX_PAGES) truncated = true;
    }

    return { rows: all, truncated };
  };

  const handleGenerate = async () => {
    if (startDate > endDate) {
      alert('A data inicial não pode ser maior que a final.');
      return;
    }
    setLoading(true);
    try {
      const { rows: raw, truncated } = await fetchAllAllocations(selectedConsultant);

      const consultantById = new Map(consultants.map(c => [c.id, c]));
      const projectById = new Map(projects.map(p => [p.id, p]));

      // Linhas de consultores ocultos (contas Andrei) não entram no relatório.
      const visibleRaw = raw.filter(a => consultantById.has(String(a.consultant_id)));

      const allRows: AgendaRow[] = visibleRaw.map(a => {
        const c = consultantById.get(String(a.consultant_id))!;
        const p = projectById.get(String(a.project_id));
        return {
          id: String(a.id),
          date: String(a.date),
          os: (a.os as string | null) ?? null,
          manager: (a.manager as string | null) ?? null,
          consultantId: c.id,
          consultantName: c.full_name,
          projectName: p?.name || '—',
          projectClient: p?.client || null
        };
      });

      // Dias do período: por padrão só úteis, que é como as agendas são montadas.
      const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
        .filter(d => !businessOnly || !isWeekend(d))
        .map(d => format(d, 'yyyy-MM-dd'));

      // Ocupação é calculada ANTES dos filtros de projeto/gerente: um dia com
      // agenda de outro projeto continua ocupado, não vira dia livre.
      const occupied = new Map<string, Set<string>>();
      allRows.forEach(r => {
        if (!occupied.has(r.consultantId)) occupied.set(r.consultantId, new Set());
        occupied.get(r.consultantId)!.add(r.date);
      });

      // Filtros que valem só para a lista de agendas e para os gráficos.
      let rows = allRows;
      if (selectedProject !== 'all') {
        const projName = projectById.get(selectedProject)?.name;
        rows = rows.filter(r => r.projectName === projName);
      }
      if (selectedManager !== 'all') {
        rows = rows.filter(r => normManager(r.manager) === normManager(selectedManager));
      }

      // Quem entra na conta de disponibilidade.
      let scope = selectedConsultant === 'all'
        ? consultants
        : consultants.filter(c => c.id === selectedConsultant);

      if (selectedManager !== 'all') {
        // Com filtro de gerente, a disponibilidade é a de quem trabalha com ele no período.
        const ids = new Set(rows.map(r => r.consultantId));
        scope = scope.filter(c => ids.has(c.id));
      }

      const daySet = new Set(days);
      const free: FreeBlock[] = [];
      const occupiedByConsultant: Record<string, number> = {};

      scope.forEach(c => {
        const occ = occupied.get(c.id) || new Set<string>();
        occupiedByConsultant[c.id] = [...occ].filter(d => daySet.has(d)).length;

        let runStart: string | null = null;
        let runEnd: string | null = null;
        let count = 0;

        const flush = () => {
          if (runStart && runEnd) {
            free.push({ consultantId: c.id, consultantName: c.full_name, start: runStart, end: runEnd, days: count });
          }
          runStart = null;
          runEnd = null;
          count = 0;
        };

        days.forEach(d => {
          if (occ.has(d)) {
            flush();
          } else {
            if (!runStart) runStart = d;
            runEnd = d;
            count++;
          }
        });
        flush();
      });

      rows.sort((a, b) => a.date.localeCompare(b.date) || a.consultantName.localeCompare(b.consultantName));
      free.sort((a, b) => a.consultantName.localeCompare(b.consultantName) || a.start.localeCompare(b.start));

      setResult({
        rows, free, days, scope, occupiedByConsultant,
        period: { start: startDate, end: endDate },
        kind, businessOnly, truncated
      });
    } catch (error) {
      console.error('Erro ao gerar relatório de agendas:', error);
      alert('Erro ao buscar as agendas. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  // --- Indicadores ---
  const stats = useMemo(() => {
    if (!result) return null;
    const totalDias = result.scope.length * result.days.length;
    const ocupados = Object.values(result.occupiedByConsultant).reduce((s, n) => s + n, 0);
    const livres = result.free.reduce((s, b) => s + b.days, 0);
    return {
      agendas: result.rows.length,
      ocupados,
      livres,
      taxa: totalDias > 0 ? Math.round((ocupados / totalDias) * 100) : 0,
      consultores: new Set(result.rows.map(r => r.consultantId)).size,
      projetos: new Set(result.rows.map(r => r.projectName)).size
    };
  }, [result]);

  // --- Gráficos estratégicos ---
  const ocupacaoPorConsultor = useMemo(() => {
    if (!result) return [];
    const total = result.days.length;
    return result.scope
      .map(c => {
        const dias = result.occupiedByConsultant[c.id] || 0;
        const first = c.full_name.split(' ')[0];
        return {
          name: first.length > 12 ? `${first.slice(0, 12)}…` : first,
          fullName: c.full_name,
          dias,
          livres: Math.max(total - dias, 0),
          ocupacao: total > 0 ? Math.round((dias / total) * 100) : 0
        };
      })
      .sort((a, b) => b.ocupacao - a.ocupacao);
  }, [result]);

  const diasPorProjeto = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, number>();
    result.rows.forEach(r => map.set(r.projectName, (map.get(r.projectName) || 0) + 1));
    return [...map.entries()]
      .map(([name, dias]) => ({ name: name.length > 22 ? `${name.slice(0, 22)}…` : name, fullName: name, dias }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8);
  }, [result]);

  const evolucaoMensal = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, number>();
    result.rows.forEach(r => {
      const key = r.date.slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, dias]) => ({
        name: format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR }),
        dias
      }));
  }, [result]);

  const diasPorGerente = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { label: string; dias: number }>();
    result.rows.forEach(r => {
      const key = normManager(r.manager) || 'SEM GERENTE';
      const label = (r.manager || '').trim() || 'Sem gerente';
      const cur = map.get(key);
      if (cur) cur.dias++;
      else map.set(key, { label, dias: 1 });
    });
    return [...map.values()]
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 6)
      .map(v => ({ name: v.label, dias: v.dias }));
  }, [result]);

  // --- Exportação ---
  const agendaExportRows = () => (result?.rows || []).map(r => ({
    'Data': br(r.date),
    'Consultor': r.consultantName,
    'Projeto': r.projectName,
    'Cliente': r.projectClient || '',
    'OS': r.os || '',
    'Gerente': r.manager || ''
  }));

  const freeExportRows = () => (result?.free || []).map(b => ({
    'Consultor': b.consultantName,
    'Disponível de': br(b.start),
    'Até': br(b.end),
    'Dias': b.days
  }));

  const resumoRows = () => [
    { 'Indicador': 'Período', 'Valor': periodLabel() },
    { 'Indicador': 'Dias considerados', 'Valor': result?.businessOnly ? 'Somente dias úteis' : 'Todos os dias' },
    { 'Indicador': 'Agendas no período', 'Valor': stats?.agendas ?? 0 },
    { 'Indicador': 'Dias ocupados', 'Valor': stats?.ocupados ?? 0 },
    { 'Indicador': 'Dias disponíveis', 'Valor': stats?.livres ?? 0 },
    { 'Indicador': 'Taxa de ocupação', 'Valor': `${stats?.taxa ?? 0}%` },
    { 'Indicador': 'Consultores', 'Valor': stats?.consultores ?? 0 },
    { 'Indicador': 'Projetos', 'Valor': stats?.projetos ?? 0 }
  ];

  const autoCols = (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map(key => {
      const maxLen = Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length));
      return { wch: Math.min(maxLen + 2, 60) };
    });
  };

  const handleExportExcel = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();

    if (result.kind !== 'disponiveis') {
      const rows = agendaExportRows();
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Data': 'sem agendas no período' }]);
      ws['!cols'] = autoCols(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Agendas');
    }

    if (result.kind !== 'ocupadas') {
      const rows = freeExportRows();
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Consultor': 'sem períodos livres' }]);
      ws['!cols'] = autoCols(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Disponibilidade');
    }

    const wsResumo = XLSX.utils.json_to_sheet(resumoRows());
    wsResumo['!cols'] = [{ wch: 22 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    XLSX.writeFile(wb, `agendas_${result.period.start}_a_${result.period.end}.xlsx`);
    setShowExportMenu(false);
  };

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob(['﻿' + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportTxt = () => {
    if (!result) return;
    const pad = (s: string, n: number) => String(s).padEnd(n).slice(0, n);
    const lines: string[] = [];

    lines.push('RELATORIO DE AGENDAS');
    lines.push(`Periodo: ${periodLabel()}   (${result.businessOnly ? 'somente dias uteis' : 'todos os dias'})`);
    lines.push(`Consultor: ${selectedConsultant === 'all' ? 'Todos' : consultants.find(c => c.id === selectedConsultant)?.full_name}`);
    lines.push(`Gerente: ${selectedManager === 'all' ? 'Todos' : selectedManager}`);
    lines.push(`Projeto: ${selectedProject === 'all' ? 'Todos' : projects.find(p => p.id === selectedProject)?.name}`);
    lines.push('');
    lines.push(`Agendas: ${stats?.agendas} | Dias ocupados: ${stats?.ocupados} | Dias disponiveis: ${stats?.livres} | Ocupacao: ${stats?.taxa}%`);
    lines.push('');

    if (result.kind !== 'disponiveis') {
      lines.push('== AGENDAS ==');
      lines.push(`${pad('DATA', 12)}${pad('CONSULTOR', 32)}${pad('PROJETO', 34)}${pad('OS', 12)}GERENTE`);
      lines.push('-'.repeat(110));
      result.rows.forEach(r => {
        lines.push(`${pad(br(r.date), 12)}${pad(r.consultantName, 32)}${pad(r.projectName, 34)}${pad(r.os || '', 12)}${r.manager || ''}`);
      });
      if (result.rows.length === 0) lines.push('(nenhuma agenda no periodo)');
      lines.push('');
    }

    if (result.kind !== 'ocupadas') {
      lines.push('== PERIODOS DISPONIVEIS ==');
      lines.push(`${pad('CONSULTOR', 32)}${pad('DE', 12)}${pad('ATE', 12)}DIAS`);
      lines.push('-'.repeat(70));
      result.free.forEach(b => {
        lines.push(`${pad(b.consultantName, 32)}${pad(br(b.start), 12)}${pad(br(b.end), 12)}${b.days}`);
      });
      if (result.free.length === 0) lines.push('(nenhum periodo livre)');
    }

    download(lines.join('\n'), `agendas_${result.period.start}_a_${result.period.end}.txt`, 'text/plain;charset=utf-8;');
  };

  const handleExportCSV = () => {
    if (!result) return;
    const rows = result.kind === 'disponiveis' ? freeExportRows() : agendaExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(';'),
      ...rows.map(row => headers.map(h => `"${String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    download(csv, `agendas_${result.period.start}_a_${result.period.end}.csv`, 'text/csv;charset=utf-8;');
  };

  const hasExport = !!result && (result.rows.length > 0 || result.free.length > 0);

  return (
    <div className="min-h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.375rem] font-extrabold text-navy-950 tracking-tight">
            Relatório de Agendas
          </h1>
          <p className="text-sm text-navy-500 mt-0.5">
            Agendas e períodos disponíveis por consultor, gerente e projeto.
          </p>
        </div>

        {hasExport && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-navy-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <button onClick={handleExportExcel} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50">
                    <FileSpreadsheet className="w-4 h-4 text-navy-400" /> Excel (.xlsx)
                  </button>
                  <button onClick={handleExportTxt} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50">
                    <FileText className="w-4 h-4 text-navy-400" /> Texto (.txt)
                  </button>
                  <button onClick={handleExportCSV} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50">
                    <FileSpreadsheet className="w-4 h-4 text-navy-400" /> CSV (.csv)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-navy-600 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <CalendarIcon className="w-3.5 h-3.5 text-navy-400" /> Período
          </span>
          {([
            { v: 'week', label: 'Semana' },
            { v: 'month', label: 'Mês' },
            { v: 'quarter', label: 'Trimestre' },
            { v: 'custom', label: 'Personalizado' }
          ] as const).map(p => (
            <button
              key={p.v}
              onClick={() => applyPreset(p.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                periodPreset === p.v
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-navy-600 border-navy-200 hover:bg-navy-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Início</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPeriodPreset('custom'); }}
              className="input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPeriodPreset('custom'); }}
              className="input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-navy-400" /> Consultor
            </label>
            <select value={selectedConsultant} onChange={e => setSelectedConsultant(e.target.value)} className="input">
              <option value="all">Todos</option>
              {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <UserCog className="w-3.5 h-3.5 text-navy-400" /> Gerente
            </label>
            <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} className="input">
              <option value="all">Todos</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5 text-navy-400" /> Projeto
            </label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input">
              <option value="all">Todos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Tipo de agenda</label>
            <select value={kind} onChange={e => setKind(e.target.value as AgendaKind)} className="input">
              <option value="todas">Todas</option>
              <option value="ocupadas">Ocupadas</option>
              <option value="disponiveis">Disponíveis</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-navy-600 cursor-pointer">
            <input
              type="checkbox"
              checked={businessOnly}
              onChange={e => setBusinessOnly(e.target.checked)}
              className="rounded border-navy-300"
            />
            Considerar apenas dias úteis (seg–sex)
          </label>

          <button onClick={handleGenerate} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Buscando...' : 'Gerar relatório'}
          </button>
        </div>
      </div>

      {result && stats && (
        <>
          {result.truncated && (
            <div className="card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">
              O período devolveu mais linhas do que o limite de leitura. Reduza o intervalo para não perder agendas.
            </div>
          )}

          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Agendas', value: stats.agendas, icon: CalendarCheck },
              { label: 'Dias ocupados', value: stats.ocupados, icon: CalendarCheck },
              { label: 'Dias disponíveis', value: stats.livres, icon: CalendarX },
              { label: 'Ocupação', value: `${stats.taxa}%`, icon: CalendarCheck },
              { label: 'Projetos', value: stats.projetos, icon: Briefcase }
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center gap-2 text-navy-500 text-xs font-semibold uppercase tracking-wider">
                  <s.icon className="w-3.5 h-3.5 text-navy-400" />
                  {s.label}
                </div>
                <p className="text-2xl font-extrabold text-navy-950 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos estratégicos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy-900 mb-4">Ocupação por consultor</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={ocupacaoPorConsultor} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(value: unknown, _n: unknown, props: { payload?: { dias?: number; livres?: number } }) =>
                        [`${value}% — ${props.payload?.dias} dias ocupados, ${props.payload?.livres} livres`, 'Ocupação']}
                      labelFormatter={(label: unknown, payload: readonly { payload?: { fullName?: string } }[]) =>
                        payload?.[0]?.payload?.fullName || String(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="ocupacao" radius={[0, 6, 6, 0]} barSize={16}>
                      {ocupacaoPorConsultor.map((e, i) => (
                        <Cell key={i} fill={e.ocupacao >= 90 ? '#1e3a8a' : e.ocupacao >= 60 ? '#3b82f6' : '#93c5fd'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy-900 mb-4">Dias alocados por projeto</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diasPorProjeto} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip
                      labelFormatter={(label: unknown, payload: readonly { payload?: { fullName?: string } }[]) =>
                        payload?.[0]?.payload?.fullName || String(label)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="dias" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy-900 mb-4">Evolução mensal das agendas</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucaoMensal} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="dias" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy-900 mb-4">Distribuição por gerente</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diasPorGerente} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                      {diasPorGerente.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Agendas */}
          {result.kind !== 'disponiveis' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-navy-900">Agendas ({result.rows.length})</h2>
                <span className="text-xs text-navy-500">{periodLabel()}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-50 text-navy-600">
                    <tr>
                      {['Data', 'Consultor', 'Projeto', 'Cliente', 'OS', 'Gerente'].map(h => (
                        <th key={h} className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map(r => (
                      <tr key={r.id} className="border-t border-navy-100 hover:bg-navy-50/50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{br(r.date)}</td>
                        <td className="px-4 py-2.5">{r.consultantName}</td>
                        <td className="px-4 py-2.5">{r.projectName}</td>
                        <td className="px-4 py-2.5 text-navy-500">{r.projectClient || '—'}</td>
                        <td className="px-4 py-2.5 text-navy-500">{r.os || '—'}</td>
                        <td className="px-4 py-2.5 text-navy-500">{r.manager || '—'}</td>
                      </tr>
                    ))}
                    {result.rows.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-400">Nenhuma agenda no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disponibilidade */}
          {result.kind !== 'ocupadas' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-navy-900">Períodos disponíveis ({result.free.length})</h2>
                <span className="text-xs text-navy-500">
                  {stats.livres} dias livres{result.businessOnly ? ' (úteis)' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-50 text-navy-600">
                    <tr>
                      {['Consultor', 'Disponível de', 'Até', 'Dias'].map(h => (
                        <th key={h} className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.free.map((b, i) => (
                      <tr key={`${b.consultantId}-${b.start}-${i}`} className="border-t border-navy-100 hover:bg-navy-50/50">
                        <td className="px-4 py-2.5">{b.consultantName}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{br(b.start)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{br(b.end)}</td>
                        <td className="px-4 py-2.5 font-semibold text-navy-900">{b.days}</td>
                      </tr>
                    ))}
                    {result.free.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-navy-400">Nenhum período livre — agenda cheia.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div className="card p-12 text-center text-navy-400">
          Escolha o período e os filtros e clique em <span className="font-semibold text-navy-600">Gerar relatório</span>.
        </div>
      )}
    </div>
  );
}
