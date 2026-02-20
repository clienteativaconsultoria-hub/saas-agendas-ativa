import { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  XCircle,
  Search,
  ChevronDown,
  CalendarDays,
  MessageSquarePlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

type Role = 'ADM' | 'GERENTE' | 'CONSULTOR' | null;

type RequestRow = {
  id: string;
  allocation_id: string | null;
  requester_id: string;
  request_type: string;
  reason: string;
  suggested_start_date: string | null;
  suggested_days: number | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_response: string | null;
  created_at: string;
  requester?: { full_name: string; role: string };
  allocation?: {
    date: string;
    project?: { name: string; manager: string | null };
  } | null;
};

const TYPE_LABELS: Record<string, string> = {
  new_agenda: '+ Nova Agenda',
  change: 'Alteração',
  cancel: 'Cancelamento',
  reschedule: 'Reagendamento',
};

const TYPE_BADGE: Record<string, string> = {
  new_agenda: 'bg-primary-100 text-primary-700',
  cancel: 'bg-red-100 text-red-700',
  reschedule: 'bg-blue-100 text-blue-700',
  change: 'bg-navy-100 text-navy-600',
};

const STATUS_TABS = [
  { value: 'all',      label: 'Todas'     },
  { value: 'pending',  label: 'Pendentes' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Recusadas' },
];

const TYPE_OPTS = [
  { value: 'all',        label: 'Todos os tipos'  },
  { value: 'new_agenda', label: '+ Nova Agenda'   },
  { value: 'change',     label: 'Alteração'        },
  { value: 'reschedule', label: 'Reagendamento'    },
  { value: 'cancel',     label: 'Cancelamento'     },
];

const ROLE_COLORS: Record<string, string> = {
  ADM:       'bg-primary-100 text-primary-700',
  CONSULTOR: 'bg-emerald-100 text-emerald-700',
  GERENTE:   'bg-amber-100 text-amber-700',
};

function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function parseNovaAgenda(r: RequestRow) {
  if (r.request_type !== 'new_agenda') return null;
  const lines = (r.reason || '').split('\n');
  const projectLine = lines[0]?.startsWith('Projeto:') ? lines[0].replace('Projeto:', '').trim() : '';
  const desc = lines.slice(1).join('\n').trim();
  return { projectName: projectLine, description: desc };
}

export function Requests() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      const role = (profile?.role as Role) || null;
      const name = profile?.full_name || '';
      setUserRole(role);

      // Fetch all requests with joins
      const { data, error } = await supabase
        .from('change_requests')
        .select(`
          *,
          requester:profiles!requester_id(full_name, role),
          allocation:allocations(
            date,
            project:projects!project_id(name, manager)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let rows = (data || []) as RequestRow[];

      // GERENTE: filter to only show requests related to their projects
      if (role === 'GERENTE') {
        rows = rows.filter(r => {
          const projManager = (r.allocation as any)?.project?.manager || '';
          return projManager?.toLowerCase() === name?.toLowerCase();
        });
      }

      setRequests(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleResolve = async (id: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('change_requests')
        .update({ status: newStatus, admin_response: responseText.trim() || null })
        .eq('id', id);
      if (error) throw error;
      setRespondingId(null);
      setResponseText('');
      await fetchRequests();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterType !== 'all' && r.request_type !== filterType) return false;
      if (filterDateFrom && r.created_at < filterDateFrom) return false;
      if (filterDateTo && r.created_at.slice(0, 10) > filterDateTo) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const requesterName = r.requester?.full_name?.toLowerCase() || '';
        const projectName = (r.allocation as any)?.project?.name?.toLowerCase() || '';
        const reason = r.reason?.toLowerCase() || '';
        if (!requesterName.includes(q) && !projectName.includes(q) && !reason.includes(q)) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterType, filterSearch, filterDateFrom, filterDateTo]);

  const counts = useMemo(() => ({
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64 text-navy-400'>
        <RefreshCw className='w-5 h-5 animate-spin mr-2' />
        <span className='text-sm'>Carregando histórico...</span>
      </div>
    );
  }

  return (
    <div className='space-y-6 p-8'>

      {/* ── Header ── */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-navy-900'>Histórico de Solicitações</h1>
          <p className='text-navy-500'>
            {userRole === 'ADM'
              ? 'Todas as solicitações da equipe, independente de projeto.'
              : 'Solicitações dos projetos sob sua responsabilidade.'}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className='flex items-center gap-2 px-4 py-2 border border-navy-200 text-navy-600 hover:bg-navy-50 rounded-lg font-medium text-sm transition-colors shadow-sm'
        >
          <RefreshCw className='w-4 h-4' /> Atualizar
        </button>
      </div>

      {/* ── Stats ── */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[
          { label: 'Total',     value: requests.length,  icon: Bell,         color: 'text-navy-600',    bg: 'bg-navy-50'    },
          { label: 'Pendentes', value: counts.pending,   icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Aprovados', value: counts.approved,  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Recusados', value: counts.rejected,  icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-50'     },
        ].map(s => (
          <div key={s.label} className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center justify-between'>
            <div>
              <p className='text-sm text-navy-500 font-medium'>{s.label}</p>
              <p className='text-2xl font-bold text-navy-900 mt-1'>{s.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${s.bg}`}>
              <s.icon className={`w-6 h-6 ${s.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className='bg-white rounded-xl border border-navy-100 shadow-sm overflow-hidden'>

        {/* Toolbar */}
        <div className='p-4 border-b border-navy-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap'>

          {/* Status tab pills */}
          <div className='flex items-center gap-1 bg-navy-50 rounded-lg p-1 border border-navy-100'>
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={clsx(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  filterStatus === tab.value
                    ? 'bg-white shadow-sm text-navy-900'
                    : 'text-navy-500 hover:text-navy-900'
                )}
              >
                {tab.label}
                {tab.value === 'pending' && counts.pending > 0 && (
                  <span className='ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold'>
                    {counts.pending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className='flex items-center gap-2 flex-wrap'>
            <div className='relative'>
              <Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400' />
              <input
                type='text'
                placeholder='Consultor, projeto...'
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className='pl-9 pr-3 py-2 text-sm border border-navy-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-400 w-48'
              />
            </div>

            <div className='relative'>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className='appearance-none pl-3 pr-8 py-2 text-sm border border-navy-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-400'
              >
                {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className='w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none' />
            </div>

            <div className='flex items-center gap-1.5'>
              <input
                type='date'
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className='py-2 px-2 text-sm border border-navy-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-400 w-36'
              />
              <span className='text-navy-400 text-xs'>–</span>
              <input
                type='date'
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className='py-2 px-2 text-sm border border-navy-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-400 w-36'
              />
            </div>

            {(filterSearch || filterType !== 'all' || filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setFilterSearch(''); setFilterType('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
                className='text-xs text-primary-600 hover:text-primary-800 font-medium'
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Request rows */}
        {filteredRequests.length === 0 ? (
          <div className='py-16 text-center'>
            <MessageSquarePlus className='w-10 h-10 mx-auto mb-3 text-navy-200' />
            <p className='text-navy-500 font-medium'>Nenhuma solicitação encontrada</p>
            <p className='text-sm text-navy-400 mt-1'>Tente ajustar os filtros acima.</p>
          </div>
        ) : (
          <div className='divide-y divide-navy-50'>
            {filteredRequests.map(req => {
              const novaAgenda = parseNovaAgenda(req);
              const alloc = req.allocation as any;
              const proj = alloc?.project;
              const isPending = req.status === 'pending';
              const isExpanded = respondingId === req.id;
              const initials = getInitials(req.requester?.full_name || '');

              return (
                <div
                  key={req.id}
                  className={clsx(
                    'px-5 py-4 hover:bg-navy-50/40 transition-colors',
                    !isPending && 'opacity-75 hover:opacity-100'
                  )}
                >
                  <div className='flex items-start gap-4'>

                    {/* Avatar initials */}
                    <div className='w-9 h-9 rounded-full bg-white border border-navy-200 flex items-center justify-center text-navy-700 font-bold text-xs shadow-sm shrink-0 mt-0.5'>
                      {initials}
                    </div>

                    {/* Content */}
                    <div className='flex-1 min-w-0'>

                      {/* Row 1: name + role + type + status + date */}
                      <div className='flex items-center gap-2 flex-wrap mb-1.5'>
                        <span className='text-sm font-bold text-navy-900'>
                          {req.requester?.full_name || 'Consultor'}
                        </span>
                        {req.requester?.role && (
                          <span className={clsx(
                            'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                            ROLE_COLORS[req.requester.role] || 'bg-navy-100 text-navy-600'
                          )}>
                            {req.requester.role}
                          </span>
                        )}
                        <span className={clsx(
                          'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                          TYPE_BADGE[req.request_type] || 'bg-navy-100 text-navy-600'
                        )}>
                          {TYPE_LABELS[req.request_type] || req.request_type}
                        </span>
                        <span className={clsx(
                          'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                          isPending
                            ? 'bg-amber-100 text-amber-700'
                            : req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {isPending ? '⏳ Pendente' : req.status === 'approved' ? '✅ Aprovado' : '❌ Recusado'}
                        </span>
                        <span className='text-xs text-navy-400 ml-auto shrink-0'>
                          {format(parseISO(req.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>

                      {/* Row 2: project / allocation details */}
                      {req.request_type === 'new_agenda' && novaAgenda ? (
                        <div className='flex flex-wrap gap-x-4 gap-y-0.5 mb-1.5'>
                          {novaAgenda.projectName && (
                            <span className='flex items-center gap-1 text-xs text-navy-600'>
                              <Briefcase className='w-3.5 h-3.5 text-navy-400' />
                              <span className='font-medium'>{novaAgenda.projectName}</span>
                            </span>
                          )}
                          {req.suggested_start_date && (
                            <span className='flex items-center gap-1 text-xs text-navy-500'>
                              <CalendarDays className='w-3.5 h-3.5 text-navy-400' />
                              {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}
                              {req.suggested_days ? ` · ${req.suggested_days} dias` : ''}
                            </span>
                          )}
                          {novaAgenda.description && (
                            <span className='text-xs text-navy-500 w-full truncate'>{novaAgenda.description}</span>
                          )}
                        </div>
                      ) : proj && alloc ? (
                        <div className='flex flex-wrap gap-x-4 gap-y-0.5 mb-1.5'>
                          <span className='flex items-center gap-1 text-xs text-navy-600'>
                            <Briefcase className='w-3.5 h-3.5 text-navy-400' />
                            <span className='font-medium'>{proj.name}</span>
                            {proj.manager && <span className='text-navy-400 ml-1'>— {proj.manager}</span>}
                          </span>
                          <span className='flex items-center gap-1 text-xs text-navy-500'>
                            <CalendarDays className='w-3.5 h-3.5 text-navy-400' />
                            {format(parseISO(alloc.date), 'dd/MM/yyyy')}
                          </span>
                          {req.suggested_start_date && (
                            <span className='text-xs text-navy-500'>
                              → {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}
                              {req.suggested_days ? ` (${req.suggested_days} dias)` : ''}
                            </span>
                          )}
                        </div>
                      ) : null}

                      {/* Reason text */}
                      {req.request_type !== 'new_agenda' && req.reason && (
                        <p className='text-xs text-navy-500 truncate mb-1'>{req.reason}</p>
                      )}

                      {/* Admin response */}
                      {req.admin_response && (
                        <div className={clsx(
                          'inline-flex items-start gap-1.5 rounded-lg px-3 py-1.5 text-xs mt-1',
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                        )}>
                          <span className='font-semibold shrink-0'>Resp:</span>
                          <span>{req.admin_response}</span>
                        </div>
                      )}

                      {/* ADM respond controls */}
                      {userRole === 'ADM' && isPending && (
                        <div className='mt-2'>
                          {!isExpanded ? (
                            <button
                              onClick={() => { setRespondingId(req.id); setResponseText(''); }}
                              className='flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors'
                            >
                              <CheckCheck className='w-3.5 h-3.5' /> Responder
                            </button>
                          ) : (
                            <div className='mt-1 space-y-2 max-w-lg'>
                              <textarea
                                rows={2}
                                placeholder='Mensagem de resposta (opcional)...'
                                value={responseText}
                                onChange={e => setResponseText(e.target.value)}
                                className='w-full text-sm p-2.5 border border-navy-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-400 resize-none text-navy-700'
                              />
                              <div className='flex gap-2'>
                                <button
                                  onClick={() => handleResolve(req.id, 'approved')}
                                  disabled={processingId === req.id}
                                  className='flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 transition-colors shadow-sm'
                                >
                                  <CheckCheck className='w-3.5 h-3.5' />
                                  {processingId === req.id ? 'Salvando...' : 'Aprovar'}
                                </button>
                                <button
                                  onClick={() => handleResolve(req.id, 'rejected')}
                                  disabled={processingId === req.id}
                                  className='flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-60 transition-colors shadow-sm'
                                >
                                  <XCircle className='w-3.5 h-3.5' />
                                  {processingId === req.id ? 'Salvando...' : 'Recusar'}
                                </button>
                                <button
                                  onClick={() => setRespondingId(null)}
                                  className='px-4 py-2 text-xs font-medium text-navy-600 border border-navy-200 hover:bg-navy-50 rounded-lg transition-colors'
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {filteredRequests.length > 0 && (
          <div className='p-3 border-t border-navy-50 text-center'>
            <span className='text-xs text-navy-400'>
              Exibindo {filteredRequests.length} de {requests.length} solicitaç{requests.length !== 1 ? 'ões' : 'ão'}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
