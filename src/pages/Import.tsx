import { useState, useEffect } from 'react';
import {
  Upload, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, Loader2, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

// Conferência de planilha Excel x sistema (somente leitura — não grava nada)

type Consultant = { id: string; name: string };
type Project = { id: string; name: string };
type Alloc = { consultantId: string; projectId: string; date: string; os: string | null };

// Normaliza texto p/ comparação: maiúsculas, sem acento, espaços colapsados
const norm = (s: any) =>
  String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim().replace(/\s+/g, ' ');

// Converte célula de data (serial Excel, dd/MM/yyyy, yyyy-MM-dd) p/ yyyy-MM-dd
const toISODate = (v: any): string | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Serial date do Excel (base 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const HEADER_ALIASES: Record<string, string[]> = {
  consultor: ['consultor', 'consultora', 'nome', 'colaborador', 'profissional'],
  data: ['data', 'dia', 'date'],
  projeto: ['projeto', 'cliente', 'project'],
  os: ['os', 'o.s', 'os ', 'ordem', 'numero os', 'n os', 'nº os'],
};

type RowDiff = {
  consultor: string;
  data: string;
  projetoExcel: string;
  osExcel: string;
  status: 'match' | 'divergente' | 'so_excel' | 'so_sistema';
  detalhe?: string;
};

export function Import() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Alloc[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [diffs, setDiffs] = useState<RowDiff[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<RowDiff['status'] | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      const [{ data: cons }, { data: projs }, { data: allocs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name'),
        supabase.from('projects').select('id, name'),
        supabase.from('allocations').select('consultant_id, project_id, date, os'),
      ]);
      setConsultants((cons || []).map((c: any) => ({ id: c.id, name: c.full_name })));
      setProjects((projs || []).map((p: any) => ({ id: p.id, name: p.name })));
      setAllocations((allocs || []).map((a: any) => ({
        consultantId: a.consultant_id, projectId: a.project_id, date: a.date, os: a.os
      })));
      setLoadingData(false);
    })();
  }, []);

  const detectColumns = (headers: string[]) => {
    const map: Record<string, number> = {};
    headers.forEach((h, i) => {
      const hn = norm(h).toLowerCase();
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (map[key] === undefined && aliases.some(a => hn === a || hn.includes(a))) {
          map[key] = i;
        }
      }
    });
    return map;
  };

  const handleFile = async (file: File) => {
    setError('');
    setDiffs(null);
    setFileName(file.name);
    setProcessing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) throw new Error('Planilha vazia ou sem dados.');

      const headers = rows[0].map(String);
      const cols = detectColumns(headers);
      if (cols.consultor === undefined || cols.data === undefined) {
        throw new Error('Não encontrei as colunas obrigatórias "Consultor" e "Data" no cabeçalho. Cabeçalho lido: ' + headers.join(', '));
      }

      // Índice do sistema por consultor+data
      const consByNorm = new Map(consultants.map(c => [norm(c.name), c]));
      const projById = new Map(projects.map(p => [p.id, p.name]));
      const sysByKey = new Map<string, Alloc>();
      allocations.forEach(a => sysByKey.set(`${a.consultantId}|${a.date}`, a));

      const seenSysKeys = new Set<string>();
      const result: RowDiff[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const consName = String(row[cols.consultor] ?? '').trim();
        const dateISO = toISODate(row[cols.data]);
        if (!consName && !dateISO) continue; // linha vazia
        const projExcel = cols.projeto !== undefined ? String(row[cols.projeto] ?? '').trim() : '';
        const osExcel = cols.os !== undefined ? String(row[cols.os] ?? '').trim() : '';

        const dataFmt = dateISO ? format(parseISO(dateISO), 'dd/MM/yyyy') : String(row[cols.data] ?? '');

        const cons = consByNorm.get(norm(consName));
        if (!cons) {
          result.push({ consultor: consName, data: dataFmt, projetoExcel: projExcel, osExcel, status: 'so_excel', detalhe: 'Consultor não encontrado no sistema' });
          continue;
        }
        if (!dateISO) {
          result.push({ consultor: consName, data: dataFmt, projetoExcel: projExcel, osExcel, status: 'so_excel', detalhe: 'Data inválida na planilha' });
          continue;
        }

        const key = `${cons.id}|${dateISO}`;
        const sys = sysByKey.get(key);
        if (!sys) {
          result.push({ consultor: cons.name, data: dataFmt, projetoExcel: projExcel, osExcel, status: 'so_excel', detalhe: 'Sem agenda no sistema nessa data' });
          continue;
        }
        seenSysKeys.add(key);

        const sysProj = projById.get(sys.projectId) || '';
        const projetoBate = !projExcel || norm(projExcel) === norm(sysProj);
        const osBate = !osExcel || norm(osExcel) === norm(sys.os || '');

        if (projetoBate && osBate) {
          result.push({ consultor: cons.name, data: dataFmt, projetoExcel: projExcel || sysProj, osExcel: osExcel || (sys.os || ''), status: 'match' });
        } else {
          const det: string[] = [];
          if (!projetoBate) det.push(`Projeto: planilha "${projExcel}" ≠ sistema "${sysProj}"`);
          if (!osBate) det.push(`OS: planilha "${osExcel}" ≠ sistema "${sys.os || '—'}"`);
          result.push({ consultor: cons.name, data: dataFmt, projetoExcel: projExcel, osExcel, status: 'divergente', detalhe: det.join(' · ') });
        }
      }

      // Agendas que existem no sistema mas não estavam na planilha (dentro das datas da planilha)
      const excelDates = new Set(result.map(r => r.data));
      allocations.forEach(a => {
        const key = `${a.consultantId}|${a.date}`;
        if (seenSysKeys.has(key)) return;
        const dataFmt = format(parseISO(a.date), 'dd/MM/yyyy');
        if (!excelDates.has(dataFmt)) return; // só compara dentro das datas presentes na planilha
        const cons = consultants.find(c => c.id === a.consultantId);
        result.push({
          consultor: cons?.name || '—',
          data: dataFmt,
          projetoExcel: projById.get(a.projectId) || '',
          osExcel: a.os || '',
          status: 'so_sistema',
          detalhe: 'Existe no sistema, ausente na planilha'
        });
      });

      setDiffs(result);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao processar a planilha.');
    } finally {
      setProcessing(false);
    }
  };

  const counts = {
    all: diffs?.length || 0,
    match: diffs?.filter(d => d.status === 'match').length || 0,
    divergente: diffs?.filter(d => d.status === 'divergente').length || 0,
    so_excel: diffs?.filter(d => d.status === 'so_excel').length || 0,
    so_sistema: diffs?.filter(d => d.status === 'so_sistema').length || 0,
  };

  const shown = diffs?.filter(d => filter === 'all' || d.status === filter) || [];

  const STATUS_META: Record<RowDiff['status'], { label: string; cls: string; icon: any }> = {
    match: { label: 'Confere', cls: 'bg-navy-50 text-navy-900 border-emerald-200', icon: CheckCircle2 },
    divergente: { label: 'Divergente', cls: 'bg-navy-50 text-amber-700 border-amber-200', icon: AlertTriangle },
    so_excel: { label: 'Só na planilha', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowRight },
    so_sistema: { label: 'Só no sistema', cls: 'bg-primary-50 text-purple-700 border-purple-200', icon: ArrowRight },
  };

  return (
    <div className="min-h-full p-6 space-y-6">
      <div>
        <h1 className="text-[1.375rem] font-extrabold text-navy-950 tracking-tight flex items-center gap-2">
          Conferência por Excel
        </h1>
        <p className="text-sm text-navy-500 mt-0.5">
          Importe uma planilha e veja onde ela <strong>bate ou diverge</strong> do sistema. Nada é alterado — é só conferência.
        </p>
      </div>

      {/* Upload */}
      <div className="card p-6">
        <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${loadingData ? 'opacity-50 pointer-events-none' : 'border-navy-200 hover:border-primary-400 hover:bg-navy-50/50'}`}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={loadingData}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {processing ? (
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-navy-400" />
          )}
          <div className="text-center">
            <p className="font-medium text-navy-700">{fileName || 'Clique para escolher a planilha'}</p>
            <p className="text-xs text-navy-400 mt-1">.xlsx, .xls ou .csv — colunas: Consultor, Data, Projeto, OS</p>
          </div>
        </label>

        {loadingData && (
          <p className="text-xs text-navy-400 mt-3 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando dados do sistema para comparação...
          </p>
        )}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      {/* Resultado */}
      {diffs && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              ['all', 'Total', counts.all, 'text-navy-900'],
              ['match', 'Confere', counts.match, 'text-navy-900'],
              ['divergente', 'Divergente', counts.divergente, 'text-navy-900'],
              ['so_excel', 'Só planilha', counts.so_excel, 'text-blue-600'],
              ['so_sistema', 'Só sistema', counts.so_sistema, 'text-primary-600'],
            ] as const).map(([key, label, val, color]) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`bg-white rounded-xl border p-4 text-center transition-all ${filter === key ? 'border-primary-400 ring-2 ring-primary-100' : 'border-navy-100 hover:border-navy-200'}`}
              >
                <p className={`text-2xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-navy-500 mt-0.5">{label}</p>
              </button>
            ))}
          </div>

          {counts.divergente === 0 && counts.so_excel === 0 && counts.so_sistema === 0 ? (
            <div className="bg-navy-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2 text-navy-900">
              <CheckCircle2 className="w-5 h-5" /> Tudo confere! A planilha bate 100% com o sistema.
            </div>
          ) : (
            <div className="bg-navy-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-sm">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              Encontrei divergências. Use os cartões acima para filtrar. A comparação de "só no sistema" considera apenas as datas presentes na planilha.
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-50/60 border-b border-navy-100">
                  <tr>
                    <th className="table-header">Status</th>
                    <th className="table-header">Consultor</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Projeto</th>
                    <th className="table-header">OS</th>
                    <th className="table-header">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {shown.map((d, i) => {
                    const meta = STATUS_META[d.status];
                    return (
                      <tr key={i} className="hover:bg-navy-50/30">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${meta.cls}`}>
                            <meta.icon className="w-3 h-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy-800 font-medium whitespace-nowrap">{d.consultor}</td>
                        <td className="px-4 py-3 text-navy-600 whitespace-nowrap">{d.data}</td>
                        <td className="px-4 py-3 text-navy-600">{d.projetoExcel || '—'}</td>
                        <td className="px-4 py-3 text-navy-500">{d.osExcel || '—'}</td>
                        <td className="px-4 py-3 text-navy-500 text-xs">{d.detalhe || '—'}</td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-navy-400">Nenhuma linha nesse filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
