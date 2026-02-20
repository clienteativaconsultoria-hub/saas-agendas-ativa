import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { supabase } from '../lib/supabase';
import {
  startOfMonth, endOfMonth, addMonths, format, subMonths,
  eachMonthOfInterval, isWeekend, eachDayOfInterval, parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2, Users, Briefcase, CalendarCheck, ClipboardCheck,
  TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight
} from 'lucide-react';

const CHART_COLORS = ['#0369a1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface Allocation {
  id: string;
  consultant_id: string;
  project_id: string;
  date: string;
  os: string | null;
  manager: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

const HIDDEN_EMAILS = ['andreimagagna@gmail.com', 'andrei@futuree.org'];

interface Project {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
}

interface DailyLog {
  id: string;
  allocation_id: string;
  date: string;
  description: string | null;
  status: string;
}

export function StrategicDashboard() {
  const [loading, setLoading] = useState(true);
  const [referenceDate, setReferenceDate] = useState(new Date());

  const [consultants, setConsultants] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [
        { data: profilesData },
        { data: projectsData },
        { data: allocsData },
        { data: logsData }
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, status'),
        supabase.from('projects').select('id, name, status, deadline'),
        supabase.from('allocations').select('*'),
        supabase.from('project_daily_logs').select('*')
      ]);

      setConsultants(profilesData || []);
      setProjects(projectsData || []);
      setAllocations(allocsData || []);
      setDailyLogs(logsData || []);
    } catch (error) {
      console.error('Erro ao buscar dados estratégicos:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const getBusinessDays = (start: Date, end: Date) => {
    return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
  };

  const getBusinessDaysInMonth = (date: Date) => {
    return getBusinessDays(startOfMonth(date), endOfMonth(date));
  };

  /** Cada alocação já é 1 dia individual no banco */
  const expandAllocationDates = (alloc: Allocation): Date[] => {
    return [parseISO(alloc.date)];
  };

  const isDateInMonth = (date: Date, monthRef: Date) =>
    date.getMonth() === monthRef.getMonth() && date.getFullYear() === monthRef.getFullYear();

  // --- Computed data ---
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const activeConsultants = useMemo(() => consultants.filter(c =>
    c.status === 'Ativo' && !HIDDEN_EMAILS.includes(c.email?.toLowerCase() || '')
  ), [consultants]);

  // Current month allocations (expanded to dates)
  const currentMonthDays = useMemo(() => {
    const results: { consultantId: string; projectId: string; date: Date }[] = [];
    allocations.forEach(alloc => {
      expandAllocationDates(alloc).forEach(date => {
        if (isDateInMonth(date, referenceDate)) {
          results.push({ consultantId: alloc.consultant_id, projectId: alloc.project_id, date });
        }
      });
    });
    return results;
  }, [allocations, referenceDate]);

  // KPI: Occupation rate
  const businessDaysInMonth = useMemo(() => getBusinessDaysInMonth(referenceDate), [referenceDate]);

  const kpis = useMemo(() => {
    const activeCount = activeConsultants.length;
    const totalCapacity = businessDaysInMonth * activeCount;
    const totalAllocatedDays = currentMonthDays.length;
    const occupationPct = totalCapacity > 0 ? Math.round((totalAllocatedDays / totalCapacity) * 100) : 0;

    // Projects actively allocated this month
    const activeProjectIds = new Set(currentMonthDays.map(d => d.projectId));
    const activeProjectCount = activeProjectIds.size;

    // Log completion: filter logs for current month
    const monthStart = startOfMonth(referenceDate);
    const monthEnd = endOfMonth(referenceDate);
    const monthLogs = dailyLogs.filter(l => {
      const d = parseISO(l.date);
      return d >= monthStart && d <= monthEnd;
    });
    const completedLogs = monthLogs.filter(l => l.status === 'completed' || (l.description && l.description.trim() !== ''));
    const logCompletionPct = monthLogs.length > 0 ? Math.round((completedLogs.length / monthLogs.length) * 100) : 0;

    // Previous month occupation for trend
    const prevMonth = subMonths(referenceDate, 1);
    const prevBusinessDays = getBusinessDaysInMonth(prevMonth);
    let prevAllocDays = 0;
    allocations.forEach(alloc => {
      expandAllocationDates(alloc).forEach(date => {
        if (isDateInMonth(date, prevMonth)) prevAllocDays++;
      });
    });
    const prevOccPct = (prevBusinessDays * activeCount) > 0
      ? Math.round((prevAllocDays / (prevBusinessDays * activeCount)) * 100) : 0;
    const occupationTrend = occupationPct - prevOccPct;

    return {
      activeConsultants: activeCount,
      activeProjects: activeProjectCount,
      totalAllocatedDays,
      totalCapacity,
      occupationPct,
      occupationTrend,
      logTotal: monthLogs.length,
      logCompleted: completedLogs.length,
      logCompletionPct
    };
  }, [currentMonthDays, activeConsultants, businessDaysInMonth, referenceDate, dailyLogs, allocations]);


  // Chart 1: Occupation per consultant (current month)
  const occupationByConsultant = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthDays.forEach(d => {
      map.set(d.consultantId, (map.get(d.consultantId) || 0) + 1);
    });
    return activeConsultants.map(c => ({
      name: c.full_name.split(' ')[0],
      fullName: c.full_name,
      allocation: Math.round(((map.get(c.id) || 0) / businessDaysInMonth) * 100),
      days: map.get(c.id) || 0,
      available: businessDaysInMonth - (map.get(c.id) || 0)
    })).sort((a, b) => b.allocation - a.allocation);
  }, [currentMonthDays, activeConsultants, businessDaysInMonth]);


  // Chart 2: Distribution by project (current month)
  const projectDistribution = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthDays.forEach(d => {
      const proj = projectMap.get(d.projectId);
      const name = proj?.name || 'Desconhecido';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [currentMonthDays, projectMap]);


  // Chart 3: Monthly evolution (last 5 months including current)
  const monthlyEvolution = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(referenceDate), 4),
      end: startOfMonth(referenceDate)
    });

    return months.map(month => {
      let allocDays = 0;
      let logCount = 0;
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);
      const bDays = getBusinessDays(mStart, mEnd);
      const capacity = bDays * activeConsultants.length;

      allocations.forEach(alloc => {
        expandAllocationDates(alloc).forEach(date => {
          if (isDateInMonth(date, month)) allocDays++;
        });
      });

      dailyLogs.forEach(l => {
        const d = parseISO(l.date);
        if (d >= mStart && d <= mEnd) logCount++;
      });

      return {
        name: format(month, 'MMM/yy', { locale: ptBR }),
        'Dias Alocados': allocDays,
        'Diários Preenchidos': logCount,
        'Capacidade': capacity
      };
    });
  }, [allocations, dailyLogs, referenceDate, activeConsultants]);


  // Chart 4: Future availability (next 3 months)
  const futureAvailability = useMemo(() => {
    const months = eachMonthOfInterval({
      start: addMonths(startOfMonth(referenceDate), 1),
      end: addMonths(startOfMonth(referenceDate), 3)
    });

    return months.map(month => {
      const bDays = getBusinessDaysInMonth(month);
      const capacity = bDays * activeConsultants.length;
      let allocated = 0;

      allocations.forEach(alloc => {
        expandAllocationDates(alloc).forEach(date => {
          if (isDateInMonth(date, month)) allocated++;
        });
      });

      return {
        name: format(month, 'MMM/yy', { locale: ptBR }),
        Ocupado: allocated,
        Livre: Math.max(0, capacity - allocated),
        pct: capacity > 0 ? Math.round((allocated / capacity) * 100) : 0
      };
    });
  }, [allocations, referenceDate, activeConsultants]);


  // Navigation
  const goMonth = (dir: number) => {
    setReferenceDate(prev => addMonths(prev, dir));
  };

  const TrendIcon = kpis.occupationTrend > 0 ? TrendingUp : kpis.occupationTrend < 0 ? TrendingDown : Minus;
  const trendColor = kpis.occupationTrend > 0 ? 'text-emerald-600' : kpis.occupationTrend < 0 ? 'text-red-500' : 'text-navy-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-navy-500">Carregando indicadores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Month Navigator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-800">Painel Estratégico</h2>
        <div className="flex items-center gap-2 bg-white border border-navy-200 rounded-lg px-1 py-1 shadow-sm">
          <button onClick={() => goMonth(-1)} className="p-1.5 rounded-md hover:bg-navy-100 text-navy-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-navy-800 min-w-[120px] text-center capitalize">
            {format(referenceDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={() => goMonth(1)} className="p-1.5 rounded-md hover:bg-navy-100 text-navy-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-navy-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary-50">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-xs font-medium text-navy-400">Ativos</span>
          </div>
          <p className="text-2xl font-bold text-navy-900">{kpis.activeConsultants}</p>
          <p className="text-xs text-navy-500 mt-1">Consultores ativos</p>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Briefcase className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-navy-400">Mês</span>
          </div>
          <p className="text-2xl font-bold text-navy-900">{kpis.activeProjects}</p>
          <p className="text-xs text-navy-500 mt-1">Projetos com alocação</p>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {Math.abs(kpis.occupationTrend)}%
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-900">{kpis.occupationPct}%</p>
          <p className="text-xs text-navy-500 mt-1">Taxa de ocupação</p>
        </div>

        <div className="bg-white rounded-xl border border-navy-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-navy-400">{kpis.logCompleted}/{kpis.logTotal}</span>
          </div>
          <p className="text-2xl font-bold text-navy-900">{kpis.logCompletionPct}%</p>
          <p className="text-xs text-navy-500 mt-1">Diários preenchidos</p>
        </div>
      </div>

      {/* Row 1: Occupation + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Occupation per Consultant */}
        <div className="bg-white p-6 rounded-xl border border-navy-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy-800">Ocupação por Consultor</h3>
            <span className="text-xs text-navy-400">{kpis.totalAllocatedDays}/{kpis.totalCapacity} dias</span>
          </div>
          {occupationByConsultant.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-navy-400 text-sm">Sem dados de alocação neste mês.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={occupationByConsultant} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value: any, name: string | undefined, props: any) => {
                      if (name === 'allocation') return [`${value}% (${props.payload.days} dias)`, 'Ocupação'];
                      return [value, name];
                    }}
                    labelFormatter={(label: any, payload: readonly any[]) => payload?.[0]?.payload?.fullName || label}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="allocation" radius={[0, 6, 6, 0]} barSize={18}>
                    {occupationByConsultant.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.allocation >= 100 ? '#ef4444' : entry.allocation >= 80 ? '#f59e0b' : '#0ea5e9'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Project Distribution */}
        <div className="bg-white p-6 rounded-xl border border-navy-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy-800">Distribuição por Projeto</h3>
            <span className="text-xs text-navy-400">Top {projectDistribution.length} projetos</span>
          </div>
          {projectDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-navy-400 text-sm">Sem dados de alocação neste mês.</div>
          ) : (
            <div className="h-[280px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${(name ?? '').length > 12 ? (name ?? '').slice(0, 12) + '…' : (name ?? '')} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {projectDistribution.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any) => [`${value} dias`, 'Alocação']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Evolution + Future */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 3: Monthly Evolution */}
        <div className="bg-white p-6 rounded-xl border border-navy-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy-800">Evolução Mensal</h3>
            <span className="text-xs text-navy-400">Últimos 5 meses</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAloc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Dias Alocados" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#colorAloc)" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="Diários Preenchidos" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorLogs)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Future Availability */}
        <div className="bg-white p-6 rounded-xl border border-navy-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-navy-800">Previsão de Disponibilidade</h3>
            <span className="text-xs text-navy-400">Próximos 3 meses</span>
          </div>
          {futureAvailability.every(d => d.Ocupado === 0 && d.Livre === 0) ? (
            <div className="flex items-center justify-center h-[280px] text-navy-400 text-sm">Sem consultores ativos para previsão.</div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={futureAvailability} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(value: any, name: string | undefined) => [`${value} dias`, name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Ocupado" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} barSize={40} />
                  <Bar dataKey="Livre" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Percentage labels below */}
          <div className="flex justify-around mt-3">
            {futureAvailability.map((m, i) => (
              <div key={i} className="text-center">
                <span className={`text-sm font-bold ${m.pct > 80 ? 'text-red-500' : m.pct > 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {m.pct}%
                </span>
                <p className="text-[10px] text-navy-400">ocupado</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
