import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileText, Download, Search, Filter, Calendar as CalendarIcon,
  FileSpreadsheet, Users, Briefcase, CheckCircle2, Clock, ChevronDown
} from 'lucide-react';
import { format, parseISO, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const HIDDEN_EMAILS = ['andreimagagna@gmail.com', 'andrei@futuree.org'];

type LogEntry = {
  id: string;
  date: string;
  description: string | null;
  status: string;
  allocation: {
    os: string | null;
    manager: string | null;
    consultant: { id: string; full_name: string };
    project: { name: string; client: string | null };
  };
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [consultants, setConsultants] = useState<{ id: string; full_name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    const [{ data: profileData }, { data: projectData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('role', ['CONSULTOR', 'GERENTE']),
      supabase.from('projects').select('id, name').order('name')
    ]);
    // Filter hidden emails
    const visible = (profileData || []).filter(
      p => !HIDDEN_EMAILS.includes((p as any).email?.toLowerCase() || '')
    );
    setConsultants(visible.map(p => ({ id: p.id, full_name: p.full_name })));
    setProjects(projectData || []);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');

      let query = supabase
        .from('project_daily_logs')
        .select(`
          id,
          date,
          description,
          status,
          allocation:allocations!inner (
            os,
            manager,
            consultant:profiles!inner (id, full_name),
            project:projects!inner (name, client)
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (selectedConsultant !== 'all') {
        query = query.eq('allocation.consultant.id', selectedConsultant);
      }

      if (selectedProject !== 'all') {
        query = query.eq('allocation.project.id', selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as unknown as LogEntry[];

      // Filter by status client-side
      if (selectedStatus !== 'all') {
        results = results.filter(l => {
          const isCompleted = l.status === 'completed' || l.status === 'concluido' || (l.description && l.description.trim() !== '');
          return selectedStatus === 'completed' ? isCompleted : !isCompleted;
        });
      }

      // Filter out hidden emails (if all consultants selected)
      // The query already excludes by ID if a specific one is selected
      setLogs(results);
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert('Erro ao buscar dados. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  // --- Summary stats ---
  const stats = useMemo(() => {
    const total = logs.length;
    const completed = logs.filter(l =>
      l.status === 'completed' || l.status === 'concluido' || (l.description && l.description.trim() !== '')
    ).length;
    const pending = total - completed;
    const uniqueConsultants = new Set(logs.map(l => l.allocation?.consultant?.id)).size;
    const uniqueProjects = new Set(logs.map(l => l.allocation?.project?.name)).size;
    return { total, completed, pending, uniqueConsultants, uniqueProjects };
  }, [logs]);

  // --- Export ---
  const buildExportRows = () => {
    return logs.map(log => {
      const isCompleted = log.status === 'completed' || log.status === 'concluido' || (log.description && log.description.trim() !== '');
      return {
        'Data': format(parseISO(log.date), 'dd/MM/yyyy'),
        'Consultor': log.allocation?.consultant?.full_name || '',
        'Projeto': log.allocation?.project?.name || '',
        'Cliente': log.allocation?.project?.client || '',
        'OS': log.allocation?.os || '',
        'Gerente': log.allocation?.manager || '',
        'Descrição da Atividade': log.description || '',
        'Status': isCompleted ? 'Concluído' : 'Pendente'
      };
    });
  };

  const handleExportExcel = () => {
    if (logs.length === 0) return;
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths
    const colWidths = Object.keys(rows[0]).map(key => {
      const maxLen = Math.max(key.length, ...rows.map(r => String((r as any)[key] || '').length));
      return { wch: Math.min(maxLen + 2, 60) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diário de Bordo');

    // Summary sheet
    const summaryRows = [
      { 'Indicador': 'Período', 'Valor': format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR }) },
      { 'Indicador': 'Total de Registros', 'Valor': stats.total },
      { 'Indicador': 'Concluídos', 'Valor': stats.completed },
      { 'Indicador': 'Pendentes', 'Valor': stats.pending },
      { 'Indicador': 'Consultores', 'Valor': stats.uniqueConsultants },
      { 'Indicador': 'Projetos', 'Valor': stats.uniqueProjects },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    XLSX.writeFile(wb, `relatorio_diario_${month}.xlsx`);
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const rows = buildExportRows();
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map(row =>
        headers.map(h => `"${String((row as any)[h] || '').replace(/"/g, '""')}"`).join(';')
      )
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_diario_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" />
            Relatório — Diário de Bordo
          </h1>
          <p className="text-navy-500 text-sm mt-1">
            Gere, visualize e exporte os registros de atividades dos consultores.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl border border-navy-100 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Month */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <CalendarIcon className="w-3.5 h-3.5 text-navy-400" />
              Mês
            </label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full p-2.5 text-sm border border-navy-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all"
            />
          </div>

          {/* Consultant */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-navy-400" />
              Consultor
            </label>
            <select
              value={selectedConsultant}
              onChange={e => setSelectedConsultant(e.target.value)}
              className="w-full p-2.5 text-sm border border-navy-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all bg-white"
            >
              <option value="all">Todos</option>
              {consultants.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5 text-navy-400" />
              Projeto
            </label>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full p-2.5 text-sm border border-navy-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all bg-white"
            >
              <option value="all">Todos</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-navy-400" />
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 text-sm border border-navy-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all bg-white"
            >
              <option value="all">Todos</option>
              <option value="completed">Concluídos</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <span className="animate-pulse">Buscando...</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Gerar
                </>
              )}
            </button>

            {logs.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="h-full px-3 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition-colors flex items-center gap-1"
                  title="Exportar"
                >
                  <Download className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-navy-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
                      <button
                        onClick={handleExportExcel}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-navy-50 flex items-center gap-2 text-navy-700"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Exportar Excel (.xlsx)
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-navy-50 flex items-center gap-2 text-navy-700"
                      >
                        <FileText className="w-4 h-4 text-primary-600" />
                        Exportar CSV (.csv)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {hasSearched && logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-navy-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.total}</p>
            <p className="text-xs text-navy-500 mt-0.5">Total Registros</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-navy-500 mt-0.5">Concluídos</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-navy-500 mt-0.5">Pendentes</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary-600">{stats.uniqueConsultants}</p>
            <p className="text-xs text-navy-500 mt-0.5">Consultores</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.uniqueProjects}</p>
            <p className="text-xs text-navy-500 mt-0.5">Projetos</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-navy-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-navy-500 animate-pulse">
            Carregando dados...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-navy-400">
            {hasSearched ? (
              <>
                <Search className="w-12 h-12 mb-2 opacity-20" />
                <p className="font-medium">Nenhum registro encontrado</p>
                <p className="text-xs mt-1">Tente ajustar os filtros acima.</p>
              </>
            ) : (
              <>
                <FileText className="w-12 h-12 mb-2 opacity-20" />
                <p className="font-medium">Selecione os filtros e clique em Gerar</p>
                <p className="text-xs mt-1">Os registros do diário de bordo serão exibidos aqui.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-50 border-b border-navy-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider">Consultor</th>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider">Projeto</th>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider">OS</th>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider w-[35%]">Atividade</th>
                  <th className="px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {logs.map(log => {
                  const isCompleted = log.status === 'completed' || log.status === 'concluido' || (log.description && log.description.trim() !== '');
                  return (
                    <tr key={log.id} className="hover:bg-navy-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy-900 whitespace-nowrap">
                        {format(parseISO(log.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 text-navy-700">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {log.allocation?.consultant?.full_name
                              ?.split(' ')
                              .map(w => w[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="truncate max-w-[120px]">{log.allocation?.consultant?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-navy-50 text-navy-700 border border-navy-100 truncate max-w-[140px]">
                          {log.allocation?.project?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy-500 text-xs whitespace-nowrap">
                        {log.allocation?.os || '—'}
                      </td>
                      <td className="px-4 py-3 text-navy-600">
                        <p className="line-clamp-2 text-sm" title={log.description || ''}>
                          {log.description || <span className="text-navy-300 italic">Sem descrição</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium text-xs bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with count */}
        {logs.length > 0 && (
          <div className="px-4 py-3 border-t border-navy-100 bg-navy-50/50 flex items-center justify-between text-xs text-navy-500">
            <span>{logs.length} registro{logs.length !== 1 ? 's' : ''} encontrado{logs.length !== 1 ? 's' : ''}</span>
            <span className="capitalize">{format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
