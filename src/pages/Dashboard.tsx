import { useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  CalendarDays, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  LayoutDashboard,
  Bell,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';
import { StrategicDashboard } from '../components/StrategicDashboard';

type UserRole = 'ADM' | 'CONSULTOR' | 'GERENTE' | null;

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'STRATEGIC'>('OPERATIONAL');
  
  const [todayAllocations, setTodayAllocations] = useState<any[]>([]);
  const [projectAlerts, setProjectAlerts] = useState<any[]>([]);
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [pendingChangeRequests, setPendingChangeRequests] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let role: UserRole = 'CONSULTOR';
        let userId = user?.id;

        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (profile) {
            setUserName(profile.full_name);
            role = profile.role as UserRole;
            setUserRole(role);
          }
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        let allocQuery = supabase.from('allocations').select(`
          *,
          consultant:profiles!consultant_id(full_name),
          project:projects!project_id(name, color)
        `);
        if (role === 'CONSULTOR' && userId) allocQuery = allocQuery.eq('consultant_id', userId);
        const { data: allAllocations } = await allocQuery;

        const todayAllocs = (allAllocations || []).filter(a => a.date === todayStr);
        setTodayAllocations(todayAllocs);

        const yesterdayAllocs = (allAllocations || []).filter(a => a.date === yesterdayStr);
        if (yesterdayAllocs.length > 0) {
          const allocIds = yesterdayAllocs.map(a => a.id);
          const { data: logsData } = await supabase
            .from('project_daily_logs')
            .select('allocation_id')
            .eq('date', yesterdayStr)
            .in('allocation_id', allocIds);
          const loggedAllocIds = new Set((logsData || []).map(l => l.allocation_id));
          setPendingLogs(yesterdayAllocs.filter(a => !loggedAllocIds.has(a.id)));
        } else {
          setPendingLogs([]);
        }

        let projectQuery = supabase.from('projects').select('*').neq('status', 'Concluído');
        const { data: projectsData } = await projectQuery;
        if (projectsData) {
          let visibleProjects = projectsData;
          if (role === 'CONSULTOR') {
            const myProjectIds = new Set((allAllocations || []).map(a => a.project_id));
            visibleProjects = projectsData.filter(p => myProjectIds.has(p.id));
          }
          const alerts = visibleProjects.filter(p => {
            if (!p.deadline) return false;
            return differenceInDays(parseISO(p.deadline), new Date()) < 7;
          }).map(p => ({
            ...p,
            daysRemaining: differenceInDays(parseISO(p.deadline), new Date())
          })).sort((a, b) => a.daysRemaining - b.daysRemaining);
          setProjectAlerts(alerts);
        }

        if (role === 'ADM') {
          const { data: chgReqs } = await supabase
            .from('change_requests')
            .select(`*, requester:profiles!requester_id(full_name)`)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          setPendingChangeRequests(chgReqs || []);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = userName ? userName.split(' ')[0] : 'Visitante';

  return (
    <div className='min-h-full p-6 space-y-6'>

      {/* ── Hero Banner ── */}
      <div className='relative overflow-hidden rounded-2xl bg-navy-900'
        style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.15)' }}>
        {/* Background mesh */}
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          <div className='absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-15'
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
          <div className='absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10'
            style={{ background: 'radial-gradient(circle, #60a5fa 0%, transparent 70%)' }} />
          {/* Grid lines */}
          <svg className='absolute inset-0 w-full h-full opacity-[0.04]' xmlns='http://www.w3.org/2000/svg'>
            <defs>
              <pattern id='grid' width='40' height='40' patternUnits='userSpaceOnUse'>
                <path d='M 40 0 L 0 0 0 40' fill='none' stroke='white' strokeWidth='1'/>
              </pattern>
            </defs>
            <rect width='100%' height='100%' fill='url(#grid)' />
          </svg>
        </div>

        <div className='relative z-10 p-8 flex items-center justify-between gap-8'>
          <div>
            <p className='text-primary-300 text-sm font-medium mb-1 flex items-center gap-2'>
              <Zap className='w-3.5 h-3.5' />
              {format(new Date(), "EEEE, dd 'de' MMMM")}
            </p>
            <h1 className='text-3xl font-extrabold text-white tracking-tight mb-2'>
              {greeting}, {firstName} 👋
            </h1>
            <p className='text-white/50 text-sm max-w-lg'>
              {userRole === 'ADM' ? (
                <>
                  Visão geral da operação.<br />
                  Acompanhe a equipe, prazos e pendências em tempo real.
                </>
              ) : (
                'Seu painel pessoal. Veja sua agenda do dia e status dos seus projetos.'
              )}
            </p>
          </div>

          {/* Quick KPIs no hero */}
          <div className='hidden lg:flex items-center gap-3 flex-shrink-0'>
            {[
              { label: 'Hoje', value: todayAllocations.length, icon: CalendarDays, color: 'text-primary-300' },
              { label: 'Alertas', value: projectAlerts.length, icon: AlertTriangle, color: 'text-primary-300' },
              { label: 'Pendentes', value: pendingLogs.length, icon: Clock, color: 'text-primary-300' },
            ].map((k) => (
              <div key={k.label} className='flex flex-col items-center px-5 py-4 rounded-xl'
                style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <k.icon className={`w-4 h-4 mb-1 ${k.color}`} />
                <span className='text-2xl font-extrabold text-white leading-none'>{loading ? '—' : k.value}</span>
                <span className='text-[11px] text-white/40 mt-0.5'>{k.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      {(userRole === 'ADM' || userRole === 'GERENTE') && (
        <div className='flex items-center gap-1 p-1 bg-navy-100 rounded-xl w-fit'>
          {[
            { key: 'OPERATIONAL', icon: LayoutDashboard, label: 'Operacional' },
            { key: 'STRATEGIC',   icon: BarChart3,       label: 'Estratégico' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={[
                'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150',
                activeTab === tab.key
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-navy-500 hover:text-navy-700'
              ].join(' ')}
            >
              <tab.icon className='w-4 h-4' />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {activeTab === 'STRATEGIC' ? (
        <StrategicDashboard />
      ) : (
        <div className='space-y-6 animate-in fade-in duration-300'>

          {/* 3-col grid */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-5'>

            {/* Card 1 — Agendas de Hoje */}
            <div className='card flex flex-col' style={{ minHeight: '380px' }}>
              <div className='px-5 py-4 border-b border-navy-50 flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center'>
                    <CalendarDays className='w-4 h-4 text-primary-600' />
                  </div>
                  <h3 className='font-bold text-navy-900 text-sm'>Agenda de Hoje</h3>
                </div>
                <span className='min-w-[24px] h-6 flex items-center justify-center px-2 rounded-full text-xs font-bold bg-primary-100 text-primary-700'>
                  {todayAllocations.length}
                </span>
              </div>

              <div className='flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar'>
                {loading ? (
                  <p className='text-sm text-center text-navy-400 py-6'>Carregando...</p>
                ) : todayAllocations.length === 0 ? (
                  <div className='flex flex-col items-center justify-center h-full py-8 text-navy-400'>
                    <div className='w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center mb-3'>
                      <CheckCircle2 className='w-6 h-6 text-navy-400' />
                    </div>
                    <p className='text-sm font-medium'>Nenhuma alocação hoje</p>
                  </div>
                ) : (
                  todayAllocations.map(alloc => (
                    <div key={alloc.id}
                      className='group p-3 rounded-xl border border-navy-100 bg-navy-50/40 hover:bg-white hover:border-primary-100 hover:shadow-sm transition-all duration-200'>
                      <div className='flex justify-between items-start'>
                        <span className='font-semibold text-navy-800 text-sm leading-tight'>{alloc.project?.name}</span>
                        {userRole === 'ADM' && (
                          <span className='text-[10px] bg-primary-50 text-primary-600 font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ml-2'>
                            {alloc.consultant?.full_name?.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1.5 mt-1.5'>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alloc.project?.color?.split(' ')[0] || 'bg-navy-400'}`} />
                        <span className='text-xs text-navy-500'>
                          {alloc.os ? `OS: ${alloc.os}` : 'Sem OS'}
                          {alloc.manager ? ` · ${alloc.manager}` : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className='px-5 py-3 border-t border-navy-50'>
                <NavLink to='/schedule' className='flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors group'>
                  Ver calendário completo
                  <ArrowRight className='w-3 h-3 group-hover:translate-x-0.5 transition-transform' />
                </NavLink>
              </div>
            </div>

            {/* Card 2 — Alertas */}
            <div className='card flex flex-col' style={{ minHeight: '380px' }}>
              <div className='px-5 py-4 border-b border-navy-50 flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center'>
                    <AlertTriangle className='w-4 h-4 text-navy-400' />
                  </div>
                  <h3 className='font-bold text-navy-900 text-sm'>Alertas & Prazos</h3>
                </div>
                {(projectAlerts.length + pendingChangeRequests.length) > 0 && (
                  <span className='min-w-[24px] h-6 flex items-center justify-center px-2 rounded-full text-xs font-bold bg-amber-100 text-amber-700'>
                    {projectAlerts.length + pendingChangeRequests.length}
                  </span>
                )}
              </div>

              <div className='flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar'>
                {loading ? (
                  <p className='text-sm text-center text-navy-400 py-6'>Carregando...</p>
                ) : (
                  <>
                    {pendingChangeRequests.length > 0 && (
                      <>
                        <p className='text-[10px] font-bold uppercase tracking-widest text-navy-400 px-1 pb-1'>
                          Solicitações pendentes
                        </p>
                        {pendingChangeRequests.map(req => (
                          <div key={req.id}
                            className='p-3 rounded-xl border border-amber-200/60 bg-navy-50/50 flex items-start gap-3'>
                            <Bell className='w-4 h-4 shrink-0 mt-0.5 text-navy-400' />
                            <div className='flex-1 min-w-0'>
                              <span className='inline-flex text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mb-1'>
                                {req.request_type === 'new_agenda' ? '+ Nova Agenda'
                                  : req.request_type === 'change' ? 'Alteração'
                                  : req.request_type === 'cancel' ? 'Cancelamento'
                                  : 'Reagendamento'}
                              </span>
                              <p className='text-xs font-semibold text-navy-800 truncate'>{req.requester?.full_name || 'Consultor'}</p>
                              <p className='text-xs text-navy-500 truncate'>{req.reason?.split('\n')[0]}</p>
                            </div>
                          </div>
                        ))}
                        {projectAlerts.length > 0 && <hr className='border-navy-100 my-2' />}
                      </>
                    )}

                    {projectAlerts.length > 0 && (
                      <>
                        {pendingChangeRequests.length > 0 && (
                          <p className='text-[10px] font-bold uppercase tracking-widest text-navy-400 px-1 pb-1'>
                            Prazos críticos
                          </p>
                        )}
                        {projectAlerts.map(proj => (
                          <div key={proj.id}
                            className='p-3 rounded-xl border border-red-100 bg-red-50/40 flex items-start gap-3'>
                            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${proj.daysRemaining < 0 ? 'text-primary-500' : 'text-navy-400'}`} />
                            <div>
                              <p className='text-sm font-semibold text-navy-800'>{proj.name}</p>
                              <p className={`text-xs font-medium mt-0.5 ${proj.daysRemaining < 0 ? 'text-navy-900' : 'text-navy-900'}`}>
                                {proj.daysRemaining < 0
                                  ? `Atrasado há ${Math.abs(proj.daysRemaining)} dias`
                                  : `Vence em ${proj.daysRemaining} dias (${format(parseISO(proj.deadline), 'dd/MM')})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {projectAlerts.length === 0 && pendingChangeRequests.length === 0 && (
                      <div className='flex flex-col items-center justify-center h-full py-8 text-navy-400'>
                        <div className='w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center mb-3'>
                          <CheckCircle2 className='w-6 h-6 text-navy-400' />
                        </div>
                        <p className='text-sm font-medium'>Tudo em dia!</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className='px-5 py-3 border-t border-navy-50'>
                <NavLink to='/projects' className='flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors group'>
                  Gerenciar projetos
                  <ArrowRight className='w-3 h-3 group-hover:translate-x-0.5 transition-transform' />
                </NavLink>
              </div>
            </div>

            {/* Card 3 — Pendências Diário */}
            <div className='card flex flex-col' style={{ minHeight: '380px' }}>
              <div className='px-5 py-4 border-b border-navy-50 flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center'>
                    <Clock className='w-4 h-4 text-primary-500' />
                  </div>
                  <h3 className='font-bold text-navy-900 text-sm'>Diários Pendentes</h3>
                </div>
                {pendingLogs.length > 0 && (
                  <span className='min-w-[24px] h-6 flex items-center justify-center px-2 rounded-full text-xs font-bold bg-navy-100 text-navy-700'>
                    {pendingLogs.length}
                  </span>
                )}
              </div>

              <div className='flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar'>
                {loading ? (
                  <p className='text-sm text-center text-navy-400 py-6'>Carregando...</p>
                ) : pendingLogs.length === 0 ? (
                  <div className='flex flex-col items-center justify-center h-full py-8 text-navy-400'>
                    <div className='w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center mb-3'>
                      <CheckCircle2 className='w-6 h-6 text-navy-400' />
                    </div>
                    <p className='text-sm font-medium'>Nenhum diário pendente</p>
                    <p className='text-xs text-navy-400 mt-1'>de ontem</p>
                  </div>
                ) : (
                  pendingLogs.map(alloc => (
                    <div key={alloc.id} className='p-3 rounded-xl border border-purple-100 bg-primary-50/40'>
                      <div className='flex justify-between items-start'>
                        <span className='font-semibold text-navy-800 text-sm'>{alloc.project?.name}</span>
                        <span className='text-[10px] text-navy-400 bg-white px-1.5 py-0.5 rounded-full border border-navy-100 flex-shrink-0 ml-2'>
                          {format(subDays(new Date(), 1), 'dd/MM')}
                        </span>
                      </div>
                      <div className='flex items-center justify-between mt-2'>
                        <div className='flex items-center gap-2 text-xs text-navy-500'>
                          <Users className='w-3 h-3' />
                          {alloc.consultant?.full_name}
                        </div>
                        <NavLink to='/schedule'
                          className='text-[10px] font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded-full transition-colors'>
                          PREENCHER
                        </NavLink>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className='px-5 py-3 border-t border-navy-50'>
                <span className='text-xs text-navy-400 italic'>Pendências do dia anterior</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <p className='text-xs font-bold uppercase tracking-widest text-navy-400 mb-3'>Ações rápidas</p>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {[
                { to: '/schedule', icon: CalendarDays, label: 'Nova Alocação', sub: 'Acessar grade de agendas', iconBg: 'bg-navy-50', iconColor: 'text-primary-600' },
                { to: '/projects', icon: Building2, label: 'Novo Projeto', sub: 'Cadastrar cliente ou projeto', iconBg: 'bg-navy-50', iconColor: 'text-primary-600' },
                { to: '/consultants', icon: Users, label: 'Gerenciar Equipe', sub: 'Ver e editar consultores', iconBg: 'bg-navy-50', iconColor: 'text-primary-600' },
              ].map(item => (
                <NavLink key={item.to} to={item.to} className='group'>
                  <div className='card card-hover p-4 flex items-center gap-4'>
                    <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center ${item.iconColor} group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                      <item.icon className='w-5 h-5' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='font-bold text-navy-900 text-sm'>{item.label}</p>
                      <p className='text-xs text-navy-500 truncate'>{item.sub}</p>
                    </div>
                    <ArrowRight className='w-4 h-4 text-navy-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all' />
                  </div>
                </NavLink>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
