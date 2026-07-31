import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Search,
  CheckCheck,
  Trash2,
  RefreshCw,
  X,
  ChevronDown,
  CalendarDays,
  User,
  Briefcase,
  Clock,
  Undo2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

type Role = 'ADM' | 'GERENTE' | 'CONSULTOR' | null;

type ExpenseRow = {
  id: string;
  consultant_id: string;
  project_id: string | null;
  reference_date: string;
  amount: number;
  kind: 'MV' | 'Particular';
  notes: string | null;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
  consultant?: { full_name: string } | null;
  project?: { name: string } | null;
};

type Option = { id: string; name: string };

type FormState = {
  id: string | null;
  consultant_id: string;
  reference_date: string;
  amount: string;
  kind: 'MV' | 'Particular';
  project_id: string;
  notes: string;
};

const STATUS_TABS = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'paid', label: 'Pagas' },
  { value: 'all', label: 'Todas' },
];

const KIND_OPTS = [
  { value: 'all', label: 'MV e Particular' },
  { value: 'MV', label: 'MV' },
  { value: 'Particular', label: 'Particular' },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMoney = (n: number) => money.format(n);
const todayISO = () => format(new Date(), 'yyyy-MM-dd');

/** Aceita "745", "745,50", "R$ 1.234,56" e devolve o número (ou null se inválido). */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.]/g, '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Busca por valor: caiu R$745 na conta, o Lucas digita "745" e tem que achar.
 * Compara com as duas grafias (745.00 e 745,00) e aceita busca parcial.
 */
function amountMatches(amount: number, query: string): boolean {
  const q = query.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  if (!q) return false;
  const fixed = amount.toFixed(2);
  return [fixed, fixed.replace('.', ','), String(amount)].some(v => v.includes(q));
}

/**
 * Erro do supabase-js é um objeto ({ code, message }), não um Error.
 * Enquanto a migration não roda, o PostgREST devolve "tabela não encontrada":
 * essa é a causa provável, então vale dizer o que fazer em vez do erro cru.
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
    return 'A tabela de prestação de contas ainda não existe no banco. Rode migration_expense_reports.sql no SQL Editor do Supabase e clique em Atualizar.';
  }
  return message || fallback;
}

const emptyForm = (consultantId: string): FormState => ({
  id: null,
  consultant_id: consultantId,
  reference_date: todayISO(),
  amount: '',
  kind: 'MV',
  project_id: '',
  notes: '',
});

export function ExpenseReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<Role>(null);

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [consultants, setConsultants] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterConsultant, setFilterConsultant] = useState('all');
  const [filterKind, setFilterKind] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Seleção para baixa em lote
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Formulário
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [projectTouched, setProjectTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdm = userRole === 'ADM';

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Entre de novo.');
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = (profile?.role as Role) || 'CONSULTOR';
      setUserRole(role);

      const [expensesRes, consultantsRes, projectsRes] = await Promise.all([
        supabase
          .from('expense_reports')
          .select('*, consultant:profiles!consultant_id(full_name), project:projects!project_id(name)')
          .order('reference_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('projects').select('id, name').order('name'),
      ]);

      if (expensesRes.error) throw expensesRes.error;

      setRows(((expensesRes.data || []) as ExpenseRow[]).map(r => ({ ...r, amount: Number(r.amount) })));
      setConsultants(
        (consultantsRes.data || [])
          .filter((c: { role: string }) => c.role === 'CONSULTOR' || c.role === 'ADM')
          .map((c: { id: string; full_name: string }) => ({ id: c.id, name: c.full_name })),
      );
      setProjects(
        (projectsRes.data || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })),
      );
    } catch (err) {
      setError(describeError(err, 'Não foi possível carregar as prestações de contas.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /** Puxa o projeto da agenda do consultor naquele dia — o vínculo com a agenda que o Andrei queria. */
  const formConsultant = form.consultant_id;
  const formDate = form.reference_date;
  useEffect(() => {
    if (!formOpen || projectTouched || !formConsultant || !formDate) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('allocations')
        .select('project_id')
        .eq('consultant_id', formConsultant)
        .eq('date', formDate)
        .maybeSingle();
      if (!cancelled && data?.project_id) {
        setForm(f => ({ ...f, project_id: data.project_id as string }));
      }
    })();
    return () => { cancelled = true; };
  }, [formOpen, projectTouched, formConsultant, formDate]);

  const openNew = () => {
    setForm(emptyForm(isAdm ? '' : userId));
    setProjectTouched(false);
    setError('');
    setFormOpen(true);
  };

  const openEdit = (row: ExpenseRow) => {
    setForm({
      id: row.id,
      consultant_id: row.consultant_id,
      reference_date: row.reference_date,
      amount: row.amount.toFixed(2).replace('.', ','),
      kind: row.kind,
      project_id: row.project_id || '',
      notes: row.notes || '',
    });
    setProjectTouched(true);
    setError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    const amount = parseAmount(form.amount);
    if (!form.consultant_id) { setError('Escolha o consultor.'); return; }
    if (!form.reference_date) { setError('Informe a data da prestação de contas.'); return; }
    if (amount === null) { setError('Valor inválido. Use algo como 745 ou 745,50.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        consultant_id: form.consultant_id,
        project_id: form.project_id || null,
        reference_date: form.reference_date,
        amount,
        kind: form.kind,
        notes: form.notes.trim() || null,
      };

      const { error: saveError } = form.id
        ? await supabase.from('expense_reports').update(payload).eq('id', form.id)
        : await supabase.from('expense_reports').insert(payload);

      if (saveError) throw saveError;

      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      setError(describeError(err, 'Não foi possível salvar o lançamento.'));
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (ids: string[], paid: boolean) => {
    if (ids.length === 0) return;
    setProcessingId(ids.length === 1 ? ids[0] : 'bulk');
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('expense_reports')
        .update(
          paid
            ? { status: 'paid', paid_at: new Date().toISOString(), paid_by: userId }
            : { status: 'pending', paid_at: null, paid_by: null },
        )
        .in('id', ids);
      if (updateError) throw updateError;
      setSelected(new Set());
      await fetchAll();
    } catch (err) {
      setError(describeError(err, 'Não foi possível atualizar a baixa.'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (row: ExpenseRow) => {
    if (!confirm(`Excluir a prestação de ${fmtMoney(row.amount)} de ${format(parseISO(row.reference_date), 'dd/MM/yyyy')}?`)) return;
    setProcessingId(row.id);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('expense_reports').delete().eq('id', row.id);
      if (deleteError) throw deleteError;
      await fetchAll();
    } catch (err) {
      setError(describeError(err, 'Não foi possível excluir o lançamento.'));
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterKind !== 'all' && r.kind !== filterKind) return false;
      if (filterConsultant !== 'all' && r.consultant_id !== filterConsultant) return false;
      if (filterFrom && r.reference_date < filterFrom) return false;
      if (filterTo && r.reference_date > filterTo) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const textHit =
          (r.consultant?.full_name || '').toLowerCase().includes(q) ||
          (r.project?.name || '').toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q);
        if (!textHit && !amountMatches(r.amount, filterSearch)) return false;
      }
      return true;
    });
  }, [rows, filterStatus, filterKind, filterConsultant, filterFrom, filterTo, filterSearch]);

  const stats = useMemo(() => {
    const pending = rows.filter(r => r.status === 'pending');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const paidThisMonth = rows.filter(r => r.status === 'paid' && r.reference_date >= monthStart);
    const sum = (list: ExpenseRow[]) => list.reduce((acc, r) => acc + r.amount, 0);
    return {
      pendingTotal: sum(pending),
      pendingCount: pending.length,
      paidMonthTotal: sum(paidThisMonth),
      shownTotal: sum(filtered),
    };
  }, [rows, filtered]);

  const selectedRows = filtered.filter(r => selected.has(r.id));
  const selectedTotal = selectedRows.reduce((acc, r) => acc + r.amount, 0);
  const selectablePending = filtered.filter(r => r.status === 'pending');
  const allPendingSelected =
    selectablePending.length > 0 && selectablePending.every(r => selected.has(r.id));

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allPendingSelected ? new Set() : new Set(selectablePending.map(r => r.id)));
  };

  const canEdit = (row: ExpenseRow) => isAdm || (row.consultant_id === userId && row.status === 'pending');

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64 text-navy-400'>
        <RefreshCw className='w-5 h-5 animate-spin mr-2' />
        <span className='text-sm'>Carregando prestações de contas...</span>
      </div>
    );
  }

  return (
    <div className='min-h-full p-4 md:p-6 space-y-6'>

      {/* ── Header ── */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-[1.375rem] font-extrabold text-navy-950 tracking-tight'>Prestação de Contas</h1>
          <p className='text-sm text-navy-500 mt-0.5'>
            {isAdm
              ? 'Data e valor lançados pelo consultor. Busque pelo valor que caiu na conta e dê baixa.'
              : 'Lance a data e o valor da sua prestação de contas. O pagamento aparece aqui quando sai.'}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button onClick={fetchAll} className='btn-secondary'>
            <RefreshCw className='w-4 h-4' /> Atualizar
          </button>
          <button onClick={openNew} className='btn-primary'>
            <Plus className='w-4 h-4' /> Lançar
          </button>
        </div>
      </div>

      {error && !formOpen && (
        <div className='flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700'>
          <AlertCircle className='w-4 h-4 mt-0.5 shrink-0' />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stats ── */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
        {[
          { label: 'A pagar', value: fmtMoney(stats.pendingTotal), icon: Clock, hint: `${stats.pendingCount} pendente${stats.pendingCount === 1 ? '' : 's'}` },
          { label: 'Pago no mês', value: fmtMoney(stats.paidMonthTotal), icon: CheckCheck, hint: format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }) },
          { label: 'Na tela', value: fmtMoney(stats.shownTotal), icon: Wallet, hint: `${filtered.length} lançamento${filtered.length === 1 ? '' : 's'}` },
          { label: 'Total lançado', value: String(rows.length), icon: CalendarDays, hint: 'histórico completo' },
        ].map(s => (
          <div key={s.label} className='card p-4 flex items-center justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-xs sm:text-sm text-navy-500 font-medium truncate'>{s.label}</p>
              {/* Valor não pode truncar: é o número que o Lucas confere no celular. */}
              <p className='text-base sm:text-lg md:text-xl font-bold text-navy-900 mt-1 whitespace-nowrap'>{s.value}</p>
              <p className='text-[11px] text-navy-400 mt-0.5 truncate'>{s.hint}</p>
            </div>
            {/* Ícone é decoração: some no celular para o valor caber inteiro. */}
            <div className='hidden sm:block p-3 rounded-lg bg-navy-50 shrink-0'>
              <s.icon className='w-5 h-5 text-primary-600' />
            </div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className='card overflow-hidden'>

        {/* Toolbar */}
        <div className='p-4 border-b border-navy-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap'>
          <div className='flex items-center gap-1 p-1 bg-white rounded-xl border border-navy-100'>
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setFilterStatus(tab.value); setSelected(new Set()); }}
                className={clsx(
                  'px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  filterStatus === tab.value ? 'bg-white shadow-sm text-navy-900' : 'text-navy-500 hover:text-navy-900',
                )}
              >
                {tab.label}
                {tab.value === 'pending' && stats.pendingCount > 0 && (
                  <span className='ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold'>
                    {stats.pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className='flex items-center gap-2 flex-wrap'>
            <div className='relative'>
              <Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400' />
              <input
                type='text'
                inputMode='search'
                placeholder='Valor (ex: 745) ou consultor...'
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className='pl-9 pr-3 py-2 text-sm border border-navy-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-400 w-56'
              />
            </div>

            {isAdm && (
              <div className='relative'>
                <select
                  value={filterConsultant}
                  onChange={e => setFilterConsultant(e.target.value)}
                  className='input pl-3 pr-8'
                >
                  <option value='all'>Todos os consultores</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className='w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none' />
              </div>
            )}

            <div className='relative'>
              <select value={filterKind} onChange={e => setFilterKind(e.target.value)} className='input pl-3 pr-8'>
                {KIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className='w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none' />
            </div>

            <div className='flex items-center gap-1.5'>
              <input type='date' value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className='input px-2 w-36' />
              <span className='text-navy-400 text-xs'>–</span>
              <input type='date' value={filterTo} onChange={e => setFilterTo(e.target.value)} className='input px-2 w-36' />
            </div>

            {(filterSearch || filterKind !== 'all' || filterConsultant !== 'all' || filterFrom || filterTo) && (
              <button
                onClick={() => {
                  setFilterSearch(''); setFilterKind('all'); setFilterConsultant('all');
                  setFilterFrom(''); setFilterTo('');
                }}
                className='text-xs text-primary-600 hover:text-primary-800 font-medium'
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Barra de baixa em lote */}
        {isAdm && selected.size > 0 && (
          <div className='px-4 py-3 bg-primary-50 border-b border-primary-100 flex flex-wrap items-center justify-between gap-3'>
            <span className='text-sm font-semibold text-primary-900'>
              {selected.size} selecionada{selected.size === 1 ? '' : 's'} · {fmtMoney(selectedTotal)}
            </span>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => markPaid([...selected], true)}
                disabled={processingId !== null}
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 transition-colors'
              >
                <CheckCheck className='w-3.5 h-3.5' />
                {processingId === 'bulk' ? 'Dando baixa...' : 'Dar baixa'}
              </button>
              <button onClick={() => setSelected(new Set())} className='btn-secondary text-xs py-1.5 px-3'>
                Limpar seleção
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className='py-16 text-center'>
            <Wallet className='w-10 h-10 mx-auto mb-3 text-navy-200' />
            <p className='text-navy-500 font-medium'>Nenhuma prestação de contas encontrada</p>
            <p className='text-sm text-navy-400 mt-1'>
              {filterSearch ? 'Nenhum lançamento com esse valor ou nome.' : 'Use o botão Lançar para registrar data e valor.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Tabela (desktop) ── */}
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr>
                    {isAdm && (
                      <th className='table-header w-10 text-left'>
                        <input
                          type='checkbox'
                          checked={allPendingSelected}
                          onChange={toggleAll}
                          disabled={selectablePending.length === 0}
                          className='w-4 h-4 rounded border-navy-300 accent-primary-600'
                          title='Selecionar pendentes'
                        />
                      </th>
                    )}
                    <th className='table-header text-left'>Data</th>
                    <th className='table-header text-left'>Consultor</th>
                    <th className='table-header text-left'>Projeto</th>
                    <th className='table-header text-left'>Tipo</th>
                    <th className='table-header text-right'>Valor</th>
                    <th className='table-header text-left'>Status</th>
                    <th className='table-header text-right'>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.id} className='table-row'>
                      {isAdm && (
                        <td className='table-cell'>
                          {row.status === 'pending' && (
                            <input
                              type='checkbox'
                              checked={selected.has(row.id)}
                              onChange={() => toggleRow(row.id)}
                              className='w-4 h-4 rounded border-navy-300 accent-primary-600'
                            />
                          )}
                        </td>
                      )}
                      <td className='table-cell font-medium text-navy-900 whitespace-nowrap'>
                        {format(parseISO(row.reference_date), 'dd/MM/yyyy')}
                      </td>
                      <td className='table-cell text-navy-700'>{row.consultant?.full_name || '—'}</td>
                      <td className='table-cell text-navy-500'>{row.project?.name || '—'}</td>
                      <td className='table-cell'>
                        <span className={clsx('badge', row.kind === 'MV' ? 'pill-info' : 'pill-purple')}>
                          {row.kind}
                        </span>
                      </td>
                      <td className='table-cell text-right font-bold text-navy-900 whitespace-nowrap'>
                        {fmtMoney(row.amount)}
                      </td>
                      <td className='table-cell'>
                        <span className={clsx('badge', row.status === 'paid' ? 'pill-success' : 'pill-warning')}>
                          {row.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                        {row.status === 'paid' && row.paid_at && (
                          <span className='block text-[11px] text-navy-400 mt-0.5'>
                            {format(parseISO(row.paid_at), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </td>
                      <td className='table-cell'>
                        <div className='flex items-center justify-end gap-1'>
                          {isAdm && row.status === 'pending' && (
                            <button
                              onClick={() => markPaid([row.id], true)}
                              disabled={processingId !== null}
                              className='flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 transition-colors'
                              title='Marcar como pago'
                            >
                              <CheckCheck className='w-3.5 h-3.5' /> Pagar
                            </button>
                          )}
                          {isAdm && row.status === 'paid' && (
                            <button
                              onClick={() => markPaid([row.id], false)}
                              disabled={processingId !== null}
                              className='btn-ghost p-1.5'
                              title='Desfazer baixa'
                            >
                              <Undo2 className='w-4 h-4' />
                            </button>
                          )}
                          {canEdit(row) && (
                            <button onClick={() => openEdit(row)} className='btn-ghost p-1.5' title='Editar'>
                              <Pencil className='w-4 h-4' />
                            </button>
                          )}
                          {canEdit(row) && (
                            <button
                              onClick={() => handleDelete(row)}
                              disabled={processingId === row.id}
                              className='btn-ghost p-1.5 hover:text-rose-600'
                              title='Excluir'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Cards (mobile) ── */}
            <div className='md:hidden divide-y divide-navy-50'>
              {filtered.map(row => (
                <div key={row.id} className='p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='text-lg font-bold text-navy-900 leading-none'>{fmtMoney(row.amount)}</p>
                      <p className='text-sm text-navy-600 mt-1.5 flex items-center gap-1.5'>
                        <CalendarDays className='w-3.5 h-3.5 text-navy-400 shrink-0' />
                        {format(parseISO(row.reference_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      <p className='text-sm text-navy-600 mt-1 flex items-center gap-1.5 truncate'>
                        <User className='w-3.5 h-3.5 text-navy-400 shrink-0' />
                        {row.consultant?.full_name || '—'}
                      </p>
                      {row.project?.name && (
                        <p className='text-xs text-navy-500 mt-1 flex items-center gap-1.5 truncate'>
                          <Briefcase className='w-3.5 h-3.5 text-navy-400 shrink-0' />
                          {row.project.name}
                        </p>
                      )}
                    </div>
                    <div className='flex flex-col items-end gap-1.5 shrink-0'>
                      <span className={clsx('badge', row.status === 'paid' ? 'pill-success' : 'pill-warning')}>
                        {row.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                      <span className={clsx('badge', row.kind === 'MV' ? 'pill-info' : 'pill-purple')}>
                        {row.kind}
                      </span>
                    </div>
                  </div>

                  {row.notes && <p className='text-xs text-navy-500 mt-2'>{row.notes}</p>}

                  <div className='flex items-center gap-2 mt-3'>
                    {isAdm && row.status === 'pending' && (
                      <button
                        onClick={() => markPaid([row.id], true)}
                        disabled={processingId !== null}
                        className='flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg disabled:opacity-60'
                      >
                        <CheckCheck className='w-3.5 h-3.5' /> Dar baixa
                      </button>
                    )}
                    {isAdm && row.status === 'paid' && (
                      <button
                        onClick={() => markPaid([row.id], false)}
                        disabled={processingId !== null}
                        className='btn-secondary flex-1 text-xs py-2'
                      >
                        <Undo2 className='w-3.5 h-3.5' /> Desfazer
                      </button>
                    )}
                    {canEdit(row) && (
                      <button onClick={() => openEdit(row)} className='btn-secondary text-xs py-2 px-3'>
                        <Pencil className='w-3.5 h-3.5' /> Editar
                      </button>
                    )}
                    {canEdit(row) && (
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={processingId === row.id}
                        className='btn-secondary text-xs py-2 px-3 hover:text-rose-600'
                      >
                        <Trash2 className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className='p-3 border-t border-navy-50 flex items-center justify-between px-4'>
              <span className='text-xs text-navy-400'>
                Exibindo {filtered.length} de {rows.length} lançamento{rows.length !== 1 ? 's' : ''}
              </span>
              <span className='text-xs font-semibold text-navy-600'>
                Soma: {fmtMoney(stats.shownTotal)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Modal de lançamento ── */}
      {formOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm'>
          <div className='card w-full max-w-md max-h-[90vh] overflow-y-auto'>
            <div className='px-5 py-4 border-b border-navy-100 flex items-center justify-between'>
              <h2 className='text-base font-bold text-navy-900 flex items-center gap-2'>
                <Wallet className='w-4 h-4 text-primary-600' />
                {form.id ? 'Editar prestação de contas' : 'Nova prestação de contas'}
              </h2>
              <button onClick={() => setFormOpen(false)} className='p-1 hover:bg-navy-100 rounded text-navy-400'>
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='p-5 space-y-4'>
              {error && (
                <div className='flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700'>
                  <AlertCircle className='w-4 h-4 mt-0.5 shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              {isAdm && (
                <div>
                  <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>Consultor</label>
                  <select
                    value={form.consultant_id}
                    onChange={e => setForm(f => ({ ...f, consultant_id: e.target.value }))}
                    className='input'
                  >
                    <option value=''>Selecione...</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>Data</label>
                  <input
                    type='date'
                    value={form.reference_date}
                    onChange={e => setForm(f => ({ ...f, reference_date: e.target.value }))}
                    className='input'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>Valor</label>
                  <input
                    type='text'
                    inputMode='decimal'
                    placeholder='745,00'
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className='input'
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>Tipo</label>
                <div className='grid grid-cols-2 gap-2'>
                  {(['MV', 'Particular'] as const).map(k => (
                    <button
                      key={k}
                      type='button'
                      onClick={() => setForm(f => ({ ...f, kind: k }))}
                      className={clsx(
                        'py-2 rounded-lg text-sm font-semibold border transition-colors',
                        form.kind === k
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-navy-600 border-navy-200 hover:border-navy-300',
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>
                  Projeto <span className='font-medium normal-case text-navy-400'>(vem da agenda do dia)</span>
                </label>
                <select
                  value={form.project_id}
                  onChange={e => { setProjectTouched(true); setForm(f => ({ ...f, project_id: e.target.value })); }}
                  className='input'
                >
                  <option value=''>Sem projeto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className='block text-xs font-bold uppercase tracking-wide text-navy-500 mb-1.5'>
                  Observação <span className='font-medium normal-case text-navy-400'>(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder='Ex.: refeição + pedágio'
                  className='input resize-none'
                />
              </div>
            </div>

            <div className='px-5 py-4 border-t border-navy-100 flex items-center justify-end gap-2'>
              <button onClick={() => setFormOpen(false)} className='btn-secondary'>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className='btn-primary'>
                {saving ? 'Salvando...' : form.id ? 'Salvar' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
