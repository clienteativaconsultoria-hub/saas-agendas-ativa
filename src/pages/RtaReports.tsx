import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileText, Plus, Save, Trash2, Download, Printer, RefreshCw,
  Loader2, ArrowLeft, ClipboardList
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

// Os 11 tipos do formulário FR.IC.SP.01, na ordem e com o texto do impresso.
const SERVICE_TYPES = [
  'Acompanhamento pós-produção',
  'Atualização de Versão',
  'Auditoria',
  'Customização',
  'Diagnóstico',
  'Serviço sob demanda',
  'Treinamento',
  'Acompanhamento e suporte na Simulação',
  'Apoio e acompanhamento no pós Go Live',
  'Infra-estrutura',
  'Análise e acompanhamento de Carga precursora'
];

type Consultant = { id: string; full_name: string };
type Project = { id: string; name: string; client: string | null };

type Activity = { date: string; description: string };
type Pendency = { task: string; owner: string; deadline: string };
type Recommendation = { description: string; consultant: string; client: string };

type Rta = {
  id: string | null;
  consultant_id: string;
  project_id: string;
  client_name: string;
  allocation_number: string;
  city: string;
  state: string;
  start_date: string;
  end_date: string;
  service_types: string[];
  expectation: string;
  workload: string;
  activities: Activity[];
  pendencies: Pendency[];
  recommendations: Recommendation[];
  manager_area: string;
  manager_it: string;
  manager_projects: string;
};

type RtaListItem = {
  id: string;
  client_name: string;
  start_date: string;
  end_date: string;
  consultant_id: string;
  updated_at: string;
};

/**
 * Erro do supabase-js é um objeto ({ code, message }), não um Error.
 * Enquanto a migration não roda, o PostgREST devolve "tabela não encontrada".
 */
function describeError(err: unknown, fallback: string): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as { code?: unknown; message?: unknown };
  const code = e.code ? String(e.code) : '';
  const message = e.message ? String(e.message) : '';
  const tabelaFaltando =
    code === 'PGRST205' ||
    code === '42P01' ||
    /could not find the table|relation .+ does not exist/i.test(message);
  if (tabelaFaltando) {
    return 'A tabela do RTA ainda não existe no banco. Rode migration_rta.sql no SQL Editor do Supabase e recarregue a página.';
  }
  return message || fallback;
}

const br = (iso: string) => {
  try { return format(parseISO(iso), 'dd/MM/yyyy'); } catch { return iso; }
};

const esc = (s?: string | null) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escBr = (s?: string | null) => esc(s).replace(/\n/g, '<br/>');

const emptyRta = (consultantId: string): Rta => ({
  id: null,
  consultant_id: consultantId,
  project_id: '',
  client_name: '',
  allocation_number: '',
  city: '',
  state: '',
  start_date: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  end_date: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  service_types: [],
  expectation: '',
  workload: '',
  activities: [],
  pendencies: [{ task: '', owner: 'Cliente', deadline: '' }],
  recommendations: [{ description: '', consultant: '', client: '' }],
  manager_area: '',
  manager_it: '',
  manager_projects: ''
});

// ============================================================
// O documento. É o mesmo HTML da pré-visualização, do .doc e da
// impressão — assim o que se vê na tela é o que o cliente assina.
// Estilo inline e tabelas simples porque o Word ignora flex/grid.
// ============================================================
function buildReportHtml(r: Rta, consultantName: string): string {
  const SEC = 'background:#BFBFBF;color:#1F3864;font-weight:bold;text-align:center;font-size:10pt;padding:4px;border:1px solid #7F7F7F;';
  const LBL = 'background:#D9D9D9;font-weight:bold;font-size:10pt;padding:4px 6px;border:1px solid #7F7F7F;white-space:nowrap;';
  const CELL = 'font-size:10pt;padding:4px 6px;border:1px solid #7F7F7F;vertical-align:top;';
  const TH = 'background:#B4C6E7;color:#000;font-weight:bold;text-align:center;font-size:10pt;padding:4px;border:1px solid #7F7F7F;';

  const tipos = SERVICE_TYPES.map(t => {
    const on = r.service_types.includes(t);
    return `<td style="${CELL}white-space:nowrap;">( ${on ? 'X' : '&nbsp;&nbsp;'} ) ${esc(t)}</td>`;
  });
  // 3 por linha, como no impresso; a última linha completa com célula vazia.
  const tipoRows: string[] = [];
  for (let i = 0; i < tipos.length; i += 3) {
    const linha = tipos.slice(i, i + 3);
    while (linha.length < 3) linha.push(`<td style="${CELL}"></td>`);
    tipoRows.push(`<tr>${linha.join('')}</tr>`);
  }

  const atividades = r.activities.length
    ? r.activities.map(a => `
        <tr>
          <td style="${CELL}font-weight:bold;white-space:nowrap;width:110px;">${esc(br(a.date))}</td>
          <td style="${CELL}">${escBr(a.description)}</td>
        </tr>`).join('')
    : `<tr><td style="${CELL}">&nbsp;</td><td style="${CELL}">&nbsp;</td></tr>`;

  const pendencias = (r.pendencies.length ? r.pendencies : [{ task: '', owner: '', deadline: '' }])
    .map(p => `
      <tr>
        <td style="${CELL}">${escBr(p.task)}</td>
        <td style="${CELL}text-align:center;">${esc(p.owner)}</td>
        <td style="${CELL}text-align:center;">${esc(p.deadline)}</td>
      </tr>`).join('');

  const recomendacoes = (r.recommendations.length ? r.recommendations : [{ description: '', consultant: '', client: '' }])
    .map(c => `
      <tr>
        <td style="${CELL}">${escBr(c.description)}</td>
        <td style="${CELL}text-align:center;">${esc(c.consultant)}</td>
        <td style="${CELL}text-align:center;">${esc(c.client)}</td>
      </tr>`).join('');

  return `
<div style="font-family:Arial, Helvetica, sans-serif;color:#000;background:#fff;">

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr><td style="border-bottom:3px solid #1F3864;padding:0 0 6px 0;">
      <span style="font-size:20pt;font-weight:bold;color:#808080;">Relatório Técnico de Atendimento</span>
    </td></tr>
  </table>

  <table style="border-collapse:collapse;width:62%;margin-bottom:16px;">
    <tr><td colspan="2" style="${SEC}">I -&nbsp; IDENTIFICAÇÃO DO CLIENTE</td></tr>
    <tr><td style="${LBL}width:38%;">Nome Fantasia:</td><td style="${CELL}font-weight:bold;">${esc(r.client_name)}</td></tr>
    <tr><td style="${LBL}">Número da Alocação:</td><td style="${CELL}">${esc(r.allocation_number)}</td></tr>
    <tr><td style="${LBL}">Cidade:</td><td style="${CELL}">${esc(r.city)}</td></tr>
    <tr><td style="${LBL}">Estado:</td><td style="${CELL}">${esc(r.state)}</td></tr>
  </table>

  <table style="border-collapse:collapse;margin-bottom:16px;">
    <tr><td colspan="4" style="${SEC}">II -&nbsp; PERÍODO PLANEJADO</td></tr>
    <tr>
      <td style="${LBL}">Início:</td><td style="${CELL}">${esc(br(r.start_date))}</td>
      <td style="${LBL}">Término:</td><td style="${CELL}">${esc(br(r.end_date))}</td>
    </tr>
  </table>

  <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
    <tr><td colspan="3" style="${SEC}">III -&nbsp; TIPO DE ATENDIMENTO</td></tr>
    ${tipoRows.join('')}
  </table>

  <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
    <tr><td style="${SEC}">IV -&nbsp; EXPECTATIVA DO CLIENTE COM RELAÇÃO À SOLUÇÃO</td></tr>
    <tr><td style="${CELL}font-size:11pt;min-height:40px;">${escBr(r.expectation) || '&nbsp;'}</td></tr>
  </table>

  <table style="border-collapse:collapse;width:34%;margin-bottom:16px;">
    <tr><td style="${SEC}">V -&nbsp; CARGA HORÁRIA PREVISTA</td></tr>
    <tr><td style="${CELL}height:38px;">${escBr(r.workload) || '&nbsp;'}</td></tr>
  </table>

  <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
    <tr><td colspan="2" style="${SEC}text-align:left;padding-left:8px;">VI -&nbsp; DESCRIÇÃO DAS ATIVIDADES DESENVOLVIDAS</td></tr>
    <tr><td style="${TH}width:110px;">Data</td><td style="${TH}">Descrição de Atividades</td></tr>
    ${atividades}
  </table>

  <table style="border-collapse:collapse;width:46%;margin-bottom:16px;">
    <tr><td colspan="3" style="${SEC}">VII -&nbsp; PENDÊNCIAS</td></tr>
    <tr>
      <td style="${TH}background:#D9D9D9;">TAREFA</td>
      <td style="${TH}background:#D9D9D9;">RESPONSÁVEL</td>
      <td style="${TH}background:#D9D9D9;">PRAZO</td>
    </tr>
    ${pendencias}
  </table>

  <table style="border-collapse:collapse;width:46%;margin-bottom:16px;">
    <tr><td colspan="3" style="${SEC}">VIII -&nbsp; RECOMENDAÇÕES</td></tr>
    <tr>
      <td style="${TH}background:#D9D9D9;">DESCRIÇÃO</td>
      <td style="${TH}background:#D9D9D9;">CONSULTOR</td>
      <td style="${TH}background:#D9D9D9;">CLIENTE</td>
    </tr>
    ${recomendacoes}
  </table>

  <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
    <tr><td colspan="4" style="${SEC}">IX -&nbsp; VALIDAÇÃO</td></tr>
    <tr><td colspan="4" style="${CELL}color:#1F3864;font-weight:bold;text-align:justify;font-size:10pt;">
      Por estar em conformidade, as partes assinam o presente Relatório dando por encerradas todas as
      responsabilidades da MV, no que tange ao escopo das atividades detalhadas no item &ldquo;IV- EXPECTATIVA DO
      CLIENTE COM RELAÇÃO À SOLUÇÃO&rdquo; com relação às soluções MV.
    </td></tr>
    <tr>
      <td style="${TH}background:#F2F2F2;font-weight:normal;">Consultor</td>
      <td style="${TH}background:#F2F2F2;font-weight:normal;">Gerente da Área</td>
      <td style="${TH}background:#F2F2F2;font-weight:normal;">Gerente de T.I.</td>
      <td style="${TH}background:#F2F2F2;font-weight:normal;">Gerente de Projetos</td>
    </tr>
    <tr>
      <td style="${CELL}height:70px;text-align:center;vertical-align:bottom;">${esc(consultantName)}</td>
      <td style="${CELL}height:70px;text-align:center;vertical-align:bottom;">${esc(r.manager_area)}</td>
      <td style="${CELL}height:70px;text-align:center;vertical-align:bottom;">${esc(r.manager_it)}</td>
      <td style="${CELL}height:70px;text-align:center;vertical-align:bottom;">${esc(r.manager_projects)}</td>
    </tr>
  </table>

  <div style="font-size:9pt;color:#000;">Revisão 00 Pág. 1/ 1 FR.IC.SP.01</div>
</div>`;
}

export function RtaReports() {
  const [role, setRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [list, setList] = useState<RtaListItem[]>([]);
  const [rta, setRta] = useState<Rta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadList = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('rta_reports')
      .select('id, client_name, start_date, end_date, consultant_id, updated_at')
      .order('updated_at', { ascending: false });
    if (err) {
      setError(describeError(err, 'Não foi possível carregar os RTAs.'));
      setList([]);
      return;
    }
    setError('');
    setList((data || []) as RtaListItem[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || '';
      setUserId(uid);

      const [{ data: profile }, { data: profs }, { data: projs }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', uid).single(),
        supabase.from('profiles').select('id, full_name').neq('role', 'GERENTE').order('full_name'),
        supabase.from('projects').select('id, name, client').order('name')
      ]);

      setRole((profile as { role?: string } | null)?.role || '');
      setConsultants((profs || []) as Consultant[]);
      setProjects((projs || []) as Project[]);
      await loadList();
      setLoading(false);
    })();
  }, [loadList]);

  const consultantName = useMemo(() => {
    const id = rta?.consultant_id || userId;
    return consultants.find(c => c.id === id)?.full_name || '';
  }, [rta, userId, consultants]);

  const openNew = () => {
    setNotice('');
    setRta(emptyRta(userId));
  };

  const openExisting = async (id: string) => {
    setNotice('');
    const { data, error: err } = await supabase.from('rta_reports').select('*').eq('id', id).single();
    if (err || !data) {
      setError(describeError(err, 'Não foi possível abrir o RTA.'));
      return;
    }
    const d = data as Record<string, unknown>;
    setRta({
      id: String(d.id),
      consultant_id: String(d.consultant_id),
      project_id: d.project_id ? String(d.project_id) : '',
      client_name: String(d.client_name || ''),
      allocation_number: String(d.allocation_number || ''),
      city: String(d.city || ''),
      state: String(d.state || ''),
      start_date: String(d.start_date),
      end_date: String(d.end_date),
      service_types: (d.service_types as string[]) || [],
      expectation: String(d.expectation || ''),
      workload: String(d.workload || ''),
      activities: (d.activities as Activity[]) || [],
      pendencies: (d.pendencies as Pendency[]) || [],
      recommendations: (d.recommendations as Recommendation[]) || [],
      manager_area: String(d.manager_area || ''),
      manager_it: String(d.manager_it || ''),
      manager_projects: String(d.manager_projects || '')
    });
  };

  // Puxa o diário de bordo do consultor no período e agrupa por dia,
  // que é exatamente o formato da seção VI do formulário.
  const pullFromLogs = async () => {
    if (!rta) return;
    setPulling(true);
    setNotice('');
    try {
      let allocQuery = supabase
        .from('allocations')
        .select('id, date, project_id')
        .eq('consultant_id', rta.consultant_id)
        .gte('date', rta.start_date)
        .lte('date', rta.end_date);
      if (rta.project_id) allocQuery = allocQuery.eq('project_id', rta.project_id);

      const { data: allocs, error: allocErr } = await allocQuery;
      if (allocErr) throw allocErr;

      const ids = (allocs || []).map(a => String(a.id));
      if (ids.length === 0) {
        setRta({ ...rta, activities: [] });
        setNotice('Nenhuma agenda do consultor nesse período — não há diário de bordo para trazer.');
        return;
      }

      const { data: logs, error: logErr } = await supabase
        .from('project_daily_logs')
        .select('date, description')
        .in('allocation_id', ids)
        .order('date', { ascending: true });
      if (logErr) throw logErr;

      // Mais de um registro no mesmo dia vira um bloco só, na ordem do diário.
      const byDate = new Map<string, string[]>();
      (logs || []).forEach(l => {
        const text = String((l as { description: string | null }).description || '').trim();
        if (!text) return;
        const key = String((l as { date: string }).date);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key)!.push(text);
      });

      const activities: Activity[] = [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, parts]) => ({ date, description: parts.join('\n\n') }));

      setRta({ ...rta, activities });
      setNotice(
        activities.length
          ? `${activities.length} dia(s) trazidos do diário de bordo. Pode editar antes de gerar o documento.`
          : 'As agendas existem, mas o diário de bordo desse período está em branco.'
      );
    } catch (err) {
      setError(describeError(err, 'Não foi possível ler o diário de bordo.'));
    } finally {
      setPulling(false);
    }
  };

  const save = async () => {
    if (!rta) return;
    if (!rta.client_name.trim()) { alert('Informe o nome fantasia do cliente.'); return; }
    if (rta.start_date > rta.end_date) { alert('A data de início não pode ser maior que a de término.'); return; }

    setSaving(true);
    try {
      const payload = {
        consultant_id: rta.consultant_id,
        project_id: rta.project_id || null,
        client_name: rta.client_name.trim(),
        allocation_number: rta.allocation_number || null,
        city: rta.city || null,
        state: rta.state || null,
        start_date: rta.start_date,
        end_date: rta.end_date,
        service_types: rta.service_types,
        expectation: rta.expectation || null,
        workload: rta.workload || null,
        activities: rta.activities,
        pendencies: rta.pendencies,
        recommendations: rta.recommendations,
        manager_area: rta.manager_area || null,
        manager_it: rta.manager_it || null,
        manager_projects: rta.manager_projects || null,
        updated_at: new Date().toISOString()
      };

      if (rta.id) {
        const { error: err } = await supabase.from('rta_reports').update(payload).eq('id', rta.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from('rta_reports')
          .insert({ ...payload, created_by: userId })
          .select('id')
          .single();
        if (err) throw err;
        setRta({ ...rta, id: String((data as { id: string }).id) });
      }
      setNotice('RTA salvo.');
      await loadList();
    } catch (err) {
      setError(describeError(err, 'Não foi possível salvar o RTA.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este RTA?')) return;
    const { error: err } = await supabase.from('rta_reports').delete().eq('id', id);
    if (err) { setError(describeError(err, 'Não foi possível excluir.')); return; }
    await loadList();
  };

  const fileBase = () => {
    if (!rta) return 'rta';
    const cli = (rta.client_name || 'cliente').replace(/[^\w]+/g, '_').toLowerCase();
    return `rta_${cli}_${rta.start_date}_a_${rta.end_date}`;
  };

  const exportDoc = () => {
    if (!rta) return;
    const inner = buildReportHtml(rta, consultantName);
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"><title>Relatório Técnico de Atendimento</title>` +
      `<style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif}</style></head>` +
      `<body>${inner}</body></html>`;

    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileBase()}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!rta) return;
    const win = window.open('', '_blank');
    if (!win) { alert('O navegador bloqueou a janela de impressão.'); return; }
    win.document.write(
      `<html><head><meta charset="utf-8"><title>${esc(fileBase())}</title>` +
      `<style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;margin:0}</style></head>` +
      `<body>${buildReportHtml(rta, consultantName)}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const patch = (p: Partial<Rta>) => rta && setRta({ ...rta, ...p });

  const toggleType = (t: string) => {
    if (!rta) return;
    const on = rta.service_types.includes(t);
    patch({ service_types: on ? rta.service_types.filter(x => x !== t) : [...rta.service_types, t] });
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-navy-400" />
      </div>
    );
  }

  // ---------- Lista ----------
  if (!rta) {
    return (
      <div className="min-h-full p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[1.375rem] font-extrabold text-navy-950 tracking-tight">
              RTA — Relatório Técnico de Atendimento
            </h1>
            <p className="text-sm text-navy-500 mt-0.5">
              Gera o relatório do período a partir do diário de bordo, no formato FR.IC.SP.01.
            </p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo RTA
          </button>
        </div>

        {error && <div className="card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</div>}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-navy-600">
                <tr>
                  {['Cliente', 'Período', 'Consultor', 'Atualizado', ''].map(h => (
                    <th key={h} className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id} className="border-t border-navy-100 hover:bg-navy-50/50">
                    <td className="px-4 py-2.5">
                      <button onClick={() => openExisting(item.id)} className="text-primary-700 font-medium hover:underline">
                        {item.client_name}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{br(item.start_date)} — {br(item.end_date)}</td>
                    <td className="px-4 py-2.5 text-navy-500">
                      {consultants.find(c => c.id === item.consultant_id)?.full_name || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-navy-500 whitespace-nowrap">
                      {format(parseISO(item.updated_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => remove(item.id)} className="text-navy-400 hover:text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && !error && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-navy-400">
                    Nenhum RTA ainda. Clique em <span className="font-semibold">Novo RTA</span>.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Editor ----------
  const isAdm = role === 'ADM';

  return (
    <div className="min-h-full p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setRta(null); setNotice(''); }} className="p-2 rounded-lg hover:bg-navy-100 text-navy-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[1.375rem] font-extrabold text-navy-950 tracking-tight">
              {rta.id ? 'Editar RTA' : 'Novo RTA'}
            </h1>
            <p className="text-sm text-navy-500 mt-0.5">FR.IC.SP.01 — Relatório Técnico de Atendimento</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </button>
          <button onClick={exportDoc} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> Word (.doc)
          </button>
          <button onClick={printReport} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {error && <div className="card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</div>}
      {notice && <div className="card p-4 border-primary-200 bg-primary-50 text-sm text-primary-800">{notice}</div>}

      {/* I / II */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-navy-400" /> Identificação e período
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Nome fantasia *</label>
            <input value={rta.client_name} onChange={e => patch({ client_name: e.target.value })} className="input" placeholder="Santa Casa de Fernandópolis" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Número da alocação</label>
            <input value={rta.allocation_number} onChange={e => patch({ allocation_number: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Projeto (agenda)</label>
            <select
              value={rta.project_id}
              onChange={e => {
                const p = projects.find(x => x.id === e.target.value);
                patch({ project_id: e.target.value, client_name: rta.client_name || p?.client || p?.name || '' });
              }}
              className="input"
            >
              <option value="">Todos do período</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Cidade</label>
            <input value={rta.city} onChange={e => patch({ city: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Estado</label>
            <input value={rta.state} onChange={e => patch({ state: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Início</label>
            <input type="date" value={rta.start_date} onChange={e => patch({ start_date: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Término</label>
            <input type="date" value={rta.end_date} onChange={e => patch({ end_date: e.target.value })} className="input" />
          </div>
          {isAdm && (
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Consultor</label>
              <select value={rta.consultant_id} onChange={e => patch({ consultant_id: e.target.value })} className="input">
                <option value="">Selecione</option>
                {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Carga horária prevista</label>
            <input value={rta.workload} onChange={e => patch({ workload: e.target.value })} className="input" placeholder="40h" />
          </div>
        </div>
      </div>

      {/* III */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-bold text-navy-900">Tipo de atendimento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {SERVICE_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
              <input type="checkbox" checked={rta.service_types.includes(t)} onChange={() => toggleType(t)} className="rounded border-navy-300" />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* IV */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-bold text-navy-900">Expectativa do cliente com relação à solução</h2>
        <textarea value={rta.expectation} onChange={e => patch({ expectation: e.target.value })} rows={3} className="input" />
      </div>

      {/* VI */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-navy-900">Descrição das atividades desenvolvidas</h2>
          <div className="flex gap-2">
            <button onClick={pullFromLogs} disabled={pulling} className="btn-secondary flex items-center gap-2">
              {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Puxar do diário de bordo
            </button>
            <button
              onClick={() => patch({ activities: [...rta.activities, { date: rta.start_date, description: '' }] })}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Linha
            </button>
          </div>
        </div>

        {rta.activities.length === 0 && (
          <p className="text-sm text-navy-400">
            Sem atividades. Use <span className="font-semibold">Puxar do diário de bordo</span> para trazer o que o consultor registrou no período.
          </p>
        )}

        <div className="space-y-3">
          {rta.activities.map((a, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[150px_1fr_40px] gap-3 items-start">
              <input
                type="date"
                value={a.date}
                onChange={e => {
                  const next = [...rta.activities];
                  next[i] = { ...a, date: e.target.value };
                  patch({ activities: next });
                }}
                className="input"
              />
              <textarea
                value={a.description}
                rows={4}
                onChange={e => {
                  const next = [...rta.activities];
                  next[i] = { ...a, description: e.target.value };
                  patch({ activities: next });
                }}
                className="input font-mono text-xs"
              />
              <button
                onClick={() => patch({ activities: rta.activities.filter((_, j) => j !== i) })}
                className="p-2 text-navy-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* VII */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900">Pendências</h2>
          <button
            onClick={() => patch({ pendencies: [...rta.pendencies, { task: '', owner: 'Cliente', deadline: '' }] })}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Linha
          </button>
        </div>
        {rta.pendencies.map((p, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_200px_140px_40px] gap-3">
            <input value={p.task} placeholder="Tarefa" onChange={e => {
              const next = [...rta.pendencies]; next[i] = { ...p, task: e.target.value }; patch({ pendencies: next });
            }} className="input" />
            <input value={p.owner} placeholder="Responsável" onChange={e => {
              const next = [...rta.pendencies]; next[i] = { ...p, owner: e.target.value }; patch({ pendencies: next });
            }} className="input" />
            <input value={p.deadline} placeholder="Prazo" onChange={e => {
              const next = [...rta.pendencies]; next[i] = { ...p, deadline: e.target.value }; patch({ pendencies: next });
            }} className="input" />
            <button onClick={() => patch({ pendencies: rta.pendencies.filter((_, j) => j !== i) })} className="p-2 text-navy-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* VIII */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900">Recomendações</h2>
          <button
            onClick={() => patch({ recommendations: [...rta.recommendations, { description: '', consultant: '', client: '' }] })}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Linha
          </button>
        </div>
        {rta.recommendations.map((c, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_40px] gap-3">
            <input value={c.description} placeholder="Descrição" onChange={e => {
              const next = [...rta.recommendations]; next[i] = { ...c, description: e.target.value }; patch({ recommendations: next });
            }} className="input" />
            <input value={c.consultant} placeholder="Consultor" onChange={e => {
              const next = [...rta.recommendations]; next[i] = { ...c, consultant: e.target.value }; patch({ recommendations: next });
            }} className="input" />
            <input value={c.client} placeholder="Cliente" onChange={e => {
              const next = [...rta.recommendations]; next[i] = { ...c, client: e.target.value }; patch({ recommendations: next });
            }} className="input" />
            <button onClick={() => patch({ recommendations: rta.recommendations.filter((_, j) => j !== i) })} className="p-2 text-navy-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* IX */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900">Validação — quem assina</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Consultor</label>
            <input value={consultantName} disabled className="input bg-navy-50 text-navy-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Gerente da área</label>
            <input value={rta.manager_area} onChange={e => patch({ manager_area: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Gerente de T.I.</label>
            <input value={rta.manager_it} onChange={e => patch({ manager_it: e.target.value })} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy-600 uppercase tracking-wider">Gerente de projetos</label>
            <input value={rta.manager_projects} onChange={e => patch({ manager_projects: e.target.value })} className="input" />
          </div>
        </div>
      </div>

      {/* Pré-visualização: o mesmo HTML que vai pro Word e pra impressão */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-navy-400" />
          <h2 className="text-sm font-bold text-navy-900">Pré-visualização do documento</h2>
        </div>
        <div className="p-6 bg-navy-50 overflow-x-auto">
          <div
            className="bg-white p-8 shadow-sm mx-auto"
            style={{ width: '820px', maxWidth: '100%' }}
            dangerouslySetInnerHTML={{ __html: buildReportHtml(rta, consultantName) }}
          />
        </div>
      </div>
    </div>
  );
}
