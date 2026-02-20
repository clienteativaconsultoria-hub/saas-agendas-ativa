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
  Bell
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
        // 1. Identify User
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
        } else {
             // Handle no user case if necessary or let existing logic flow
             console.log("No authenticated user found for dashboard");
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        // 2. Agendas de Hoje
        let allocQuery = supabase.from('allocations').select(`
            *,
            consultant:profiles!consultant_id(full_name),
            project:projects!project_id(name, color)
        `);
        
        if (role === 'CONSULTOR' && userId) {
            allocQuery = allocQuery.eq('consultant_id', userId);
        }

        const { data: allAllocations } = await allocQuery;
        
        const todayAllocs = (allAllocations || []).filter(a => a.date === todayStr);
        setTodayAllocations(todayAllocs);


        // 3. Diários Pendentes (Ontem)
        // Logic: Find allocations active Yesterday. Check if log exists for Yesterday.
        const yesterdayAllocs = (allAllocations || []).filter(a => a.date === yesterdayStr);

        if (yesterdayAllocs.length > 0) {
            const allocIds = yesterdayAllocs.map(a => a.id);
            const { data: logsData } = await supabase
                .from('project_daily_logs')
                .select('allocation_id')
                .eq('date', yesterdayStr)
                .in('allocation_id', allocIds);
            
            const loggedAllocIds = new Set((logsData || []).map(l => l.allocation_id));
            
            // Pending = Yesterday Active - Logged
            const pending = yesterdayAllocs.filter(a => !loggedAllocIds.has(a.id));
            setPendingLogs(pending);
        } else {
            setPendingLogs([]);
        }


        // 4. Alertas de Projetos (Prazos)
        // ADM sees all. Consultor sees projects they are allocated to (or all, depending on policy).
        // Let's show ALL to ADM, and only RELEVANT to Consultor if possible, but user asked for "Alertas de Projetos"
        // Usually Alerts are global or strict context. Let's show Global for ADM, Personal for Consultor.
        
        let projectQuery = supabase.from('projects').select('*').neq('status', 'Concluído');
        const { data: projectsData } = await projectQuery;
        
        if (projectsData) {
            let visibleProjects = projectsData;
            if (role === 'CONSULTOR') {
                 // Filter only projects where consultant has EVER been allocated or currently allocated
                 const myProjectIds = new Set((allAllocations || []).map(a => a.project_id));
                 visibleProjects = projectsData.filter(p => myProjectIds.has(p.id));
            }

            // Check deadlines
            const alerts = visibleProjects.filter(p => {
                if (!p.deadline) return false;
                const dead = parseISO(p.deadline);
                const today = new Date();
                const diff = differenceInDays(dead, today);
                // Alert if overdue (negative) or within 7 days
                return diff < 7; 
            }).map(p => {
                const dead = parseISO(p.deadline);
                const diff = differenceInDays(dead, new Date());
                return {
                    ...p,
                    daysRemaining: diff
                };
            }).sort((a,b) => a.daysRemaining - b.daysRemaining);
            
            setProjectAlerts(alerts);
        }

        // 5. Pending Change Requests (ADM only)
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

  return (
    <div className='space-y-8 p-8'>
       {/* Welcome Section */}
       <div className='bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden'>
          <div className='relative z-10'>
            <h1 className='text-3xl font-bold mb-2'>Olá, {userName || 'Visitante'}</h1>
            <p className='text-navy-200 max-w-2xl'>
               {userRole === 'ADM' 
                 ? 'Visão geral da operação. Acompanhe a equipe, prazos e pendências.' 
                 : 'Seu painel pessoal. Veja sua agenda do dia e status de seus projetos.'}
            </p>
          </div>
          {/* Decorative Pattern */}
          <div className='absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-10'></div>
          <div className='absolute right-20 top-0 h-full w-2 bg-primary-500/20 skew-x-12'></div>
       </div>

       {/* Tab Switcher */}
       {(userRole === 'ADM' || userRole === 'GERENTE') && (
          <div className="flex border-b border-navy-100 mb-6">
             <button
                onClick={() => setActiveTab('OPERATIONAL')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                   activeTab === 'OPERATIONAL' 
                   ? 'border-primary-600 text-primary-700' 
                   : 'border-transparent text-navy-500 hover:text-navy-700 hover:border-navy-300'
                }`}
             >
                <LayoutDashboard className="w-4 h-4" />
                Operacional
             </button>
             <button
                onClick={() => setActiveTab('STRATEGIC')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                   activeTab === 'STRATEGIC'
                   ? 'border-primary-600 text-primary-700'
                   : 'border-transparent text-navy-500 hover:text-navy-700 hover:border-navy-300'
                }`}
             >
                <BarChart3 className="w-4 h-4" />
                Estratégico
             </button>
          </div>
       )}

       {activeTab === 'STRATEGIC' ? (
          <StrategicDashboard />
       ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
             {/* Resumo Operacional (3 Colunas) */}
             <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          
          {/* Card 1: Agendas de Hoje */}
          <div className='bg-white rounded-xl border border-navy-100 shadow-sm flex flex-col h-[400px]'>
             <div className='p-4 border-b border-navy-50 flex items-center justify-between'>
                <h3 className='font-bold text-navy-900 flex items-center gap-2'>
                   <CalendarDays className='w-5 h-5 text-primary-600' />
                   Agenda de Hoje
                </h3>
                <span className='bg-primary-50 text-primary-700 text-xs font-bold px-2 py-1 rounded-full'>
                   {todayAllocations.length}
                </span>
             </div>
             <div className='flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar'>
                {loading ? <p className='text-sm text-center text-navy-400 py-4'>Carregando...</p> : 
                 todayAllocations.length === 0 ? (
                    <div className='text-center py-8 text-navy-400 text-sm'>
                       <CheckCircle2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                       Nenhuma alocação para hoje.
                    </div>
                 ) : (
                    todayAllocations.map(alloc => (
                       <div key={alloc.id} className='p-3 rounded-lg border border-navy-100 bg-navy-50/50 hover:bg-white hover:shadow-sm transition-all'>
                          <div className='flex justify-between items-start mb-1'>
                             <span className='font-semibold text-navy-800 text-sm'>{alloc.project?.name}</span>
                             {/* Only show consultant name if ADM or viewing others */}
                             {userRole === 'ADM' && (
                                <span className='text-[10px] bg-white border border-navy-100 rounded px-1.5 py-0.5 text-navy-500'>
                                   {alloc.consultant?.full_name?.split(' ')[0]}
                                </span>
                             )}
                          </div>
                          <div className='text-xs text-navy-500 flex items-center gap-1.5'>
                             <span className={`w-2 h-2 rounded-full ${alloc.project?.color?.split(' ')[0] || 'bg-navy-400'}`}></span>
                             {alloc.os ? `OS: ${alloc.os}` : 'Sem OS'} • {alloc.manager ? alloc.manager : 'Sem Gerente'}
                          </div>
                       </div>
                    ))
                 )
                }
             </div>
             <div className='p-3 border-t border-navy-50 text-center'>
                <NavLink to="/schedule" className='text-xs font-medium text-primary-600 hover:text-primary-800'>
                   Ver calendário completo →
                </NavLink>
             </div>
          </div>

          {/* Card 2: Alertas e Prazos + Solicitações */}
          <div className='bg-white rounded-xl border border-navy-100 shadow-sm flex flex-col h-[400px]'>
             <div className='p-4 border-b border-navy-50 flex items-center justify-between'>
                <h3 className='font-bold text-navy-900 flex items-center gap-2'>
                   <AlertTriangle className='w-5 h-5 text-amber-600' />
                   Alertas e Prazos
                </h3>
                {(projectAlerts.length + pendingChangeRequests.length) > 0 && (
                   <span className='bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-full'>
                      {projectAlerts.length + pendingChangeRequests.length}
                   </span>
                )}
             </div>
             <div className='flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar'>
                {loading ? <p className='text-sm text-center text-navy-400 py-4'>Carregando...</p> : (
                  <>
                    {/* Pending change requests (ADM only) */}
                    {pendingChangeRequests.length > 0 && (
                      <>
                        <p className='text-[10px] font-bold uppercase text-navy-400 tracking-wider px-1'>Solicitações Pendentes</p>
                        {pendingChangeRequests.map(req => (
                          <div key={req.id} className='p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-3'>
                            <Bell className='w-4 h-4 shrink-0 mt-0.5 text-amber-500' />
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center gap-1.5 flex-wrap'>
                                <span className='text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700'>
                                  {req.request_type === 'new_agenda' ? '+ Nova Agenda' : req.request_type === 'change' ? 'Alteração' : req.request_type === 'cancel' ? 'Cancelamento' : 'Reagendamento'}
                                </span>
                              </div>
                              <p className='text-xs font-semibold text-navy-800 mt-1 truncate'>{req.requester?.full_name || 'Consultor'}</p>
                              <p className='text-xs text-navy-500 truncate'>{req.reason?.split('\n')[0]}</p>
                            </div>
                          </div>
                        ))}
                        {projectAlerts.length > 0 && <div className='border-t border-navy-100 my-1' />}
                      </>
                    )}

                    {/* Project deadline alerts */}
                    {projectAlerts.length > 0 && (
                      <>
                        {pendingChangeRequests.length > 0 && (
                          <p className='text-[10px] font-bold uppercase text-navy-400 tracking-wider px-1'>Prazos Críticos</p>
                        )}
                        {projectAlerts.map(proj => (
                          <div key={proj.id} className='p-3 rounded-lg border border-red-100 bg-red-50/30 flex items-start gap-3'>
                            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${proj.daysRemaining < 0 ? 'text-red-500' : 'text-amber-500'}`} />
                            <div>
                              <h4 className='text-sm font-semibold text-navy-800'>{proj.name}</h4>
                              <p className={`text-xs font-medium mt-0.5 ${proj.daysRemaining < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                {proj.daysRemaining < 0 
                                  ? `Atrasado há ${Math.abs(proj.daysRemaining)} dias`
                                  : `Vence em ${proj.daysRemaining} dias (${format(parseISO(proj.deadline), 'dd/MM')})`
                                }
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Empty state */}
                    {projectAlerts.length === 0 && pendingChangeRequests.length === 0 && (
                      <div className='text-center py-8 text-navy-400 text-sm'>
                        <CheckCircle2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                        Tudo em dia! Nenhum alerta.
                      </div>
                    )}
                  </>
                )}
             </div>
             <div className='p-3 border-t border-navy-50 text-center'>
                <NavLink to="/projects" className='text-xs font-medium text-primary-600 hover:text-primary-800'>
                   Gerenciar projetos →
                </NavLink>
             </div>
          </div>

          {/* Card 3: Diários Pendentes */}
          <div className='bg-white rounded-xl border border-navy-100 shadow-sm flex flex-col h-[400px]'>
             <div className='p-4 border-b border-navy-50 flex items-center justify-between'>
                <h3 className='font-bold text-navy-900 flex items-center gap-2'>
                   <Clock className='w-5 h-5 text-purple-600' />
                   Pendências (Diário)
                </h3>
                {pendingLogs.length > 0 && (
                   <span className='bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded-full'>
                      {pendingLogs.length}
                   </span>
                )}
             </div>
             <div className='flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar'>
                 {loading ? <p className='text-sm text-center text-navy-400 py-4'>Carregando...</p> : 
                 pendingLogs.length === 0 ? (
                    <div className='text-center py-8 text-navy-400 text-sm'>
                       <CheckCircle2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                       Nenhum diário pendente de ontem.
                    </div>
                 ) : (
                    pendingLogs.map(alloc => (
                       <div key={alloc.id} className='p-3 rounded-lg border border-purple-100 bg-purple-50/30'>
                          <div className='flex justify-between items-start mb-1'>
                             <span className='font-semibold text-navy-800 text-sm'>{alloc.project?.name}</span>
                             <span className='text-[10px] text-navy-400 bg-white px-1 rounded border border-navy-100'>
                                {format(subDays(new Date(), 1), 'dd/MM')}
                             </span>
                          </div>
                          <div className='flex items-center justify-between mt-2'>
                             <div className='flex items-center gap-2 text-xs text-navy-600'>
                                <Users className='w-3 h-3' />
                                {alloc.consultant?.full_name}
                             </div>
                             <NavLink to="/schedule" className='text-[10px] font-bold text-purple-600 hover:underline'>
                                PREENCHER
                             </NavLink>
                          </div>
                       </div>
                    ))
                 )
                }
             </div>
             <div className='p-3 border-t border-navy-50 text-center'>
                <span className='text-xs text-navy-400 italic'>
                   Exibindo pendências do dia anterior
                </span>
             </div>
          </div>
       </div>

       {/* Quick Actions Grid (Collapsed) */}
       <div className='grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity'>
          <NavLink to="/schedule" className='group'>
            <div className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all'>
               <div className='w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform'>
                  <CalendarDays className='w-5 h-5' />
               </div>
               <div>
                   <h3 className='font-bold text-navy-900'>Nova Alocação</h3>
                   <span className='text-xs text-primary-600'>Acessar Grade →</span>
               </div>
            </div>
          </NavLink>

          <NavLink to="/projects" className='group'>
             <div className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all'>
               <div className='w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform'>
                  <Building2 className='w-5 h-5' />
               </div>
               <div>
                   <h3 className='font-bold text-navy-900'>Novo Projeto</h3>
                   <span className='text-xs text-primary-600'>Cadastro →</span>
               </div>
            </div>
          </NavLink>

          <NavLink to="/consultants" className='group'>
             <div className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all'>
               <div className='w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform'>
                  <Users className='w-5 h-5' />
               </div>
               <div>
                   <h3 className='font-bold text-navy-900'>Gerenciar Equipe</h3>
                   <span className='text-xs text-primary-600'>Ver todos →</span>
               </div>
            </div>
          </NavLink>
       </div>
          </div>
       )}
    </div>
  );
}
