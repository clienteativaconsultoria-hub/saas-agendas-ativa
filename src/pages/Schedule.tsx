import { useState, useEffect } from 'react';
import { 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X,
  Save,
  CalendarDays,
  User,
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  LayoutGrid,
  BarChart3,
  PieChart,
  ClipboardList,
  Copy,
  Eye,
  MessageSquarePlus,
  Send,
  CheckCheck,
  XCircle,
  Bell
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  parseISO, 
  addDays, 
  eachDayOfInterval, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth,
  addMonths,
  differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';

// --- Types ---
type Consultant = { id: string; name: string; role: string; email?: string; };
type Project = { 
  id: string; 
  name: string; 
  color: string;
  client?: string;
  manager?: string;
  os?: string;
  status?: string;
  deadline?: string;
  progress?: number;
  is_private?: boolean;
};
type Allocation = {
  id: string;
  consultantId: string;
  projectId: string;
  date: string;      // 1 registro = 1 dia no calendário
  os?: string;
  manager?: string;
  proj?: Project;
};
type DailyLog = { id: string; allocation_id: string; date: string; description: string; status: 'pending' | 'completed' };

type ChangeRequest = {
  id: string;
  allocation_id: string;
  requester_id: string;
  request_type: 'change' | 'cancel' | 'reschedule' | 'new_agenda';
  reason: string;
  suggested_start_date: string | null;
  suggested_days: number | null;
  suggested_project_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_response: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  // joined
  requester?: { full_name: string };
  allocation?: {
    date: string;
    consultant: { full_name: string };
    project: { name: string };
  };
};

type TimeView = 'day' | 'week' | 'month';
type ViewMode = 'grid' | 'analytics' | 'overview';
type UserRole = 'ADM' | 'CONSULTOR' | 'GERENTE' | null;

export function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [timeView, setTimeView] = useState<TimeView>('week');
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([
     { id: 'free', name: 'VAGO', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dashed border' }
  ]);
  
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilter, setShowFilter] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string>('all');

  // Allocation Detail State
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logDrafts, setLogDrafts] = useState<Record<string, string>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const [loadingReport, setLoadingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportConsultant, setReportConsultant] = useState('all');
  const [reportData, setReportData] = useState<any[] | null>(null);

  // Change Request State
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [changeRequestType, setChangeRequestType] = useState<'change' | 'cancel' | 'reschedule'>('change');
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [changeRequestNewDate, setChangeRequestNewDate] = useState('');
  const [changeRequestNewDays, setChangeRequestNewDays] = useState<number | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [allocationRequests, setAllocationRequests] = useState<ChangeRequest[]>([]);

  // Admin: Pending requests
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');

  // Consultant: Standalone change request modal
  const [showSolicitacaoModal, setShowSolicitacaoModal] = useState(false);
  const [solicitacaoModalTab, setSolicitacaoModalTab] = useState<'alterar' | 'nova'>('alterar');
  // Alterar agenda
  const [solicitacaoAllocId, setSolicitacaoAllocId] = useState<string>('');
  const [solicitacaoType, setSolicitacaoType] = useState<'change' | 'cancel' | 'reschedule'>('change');
  const [solicitacaoReason, setSolicitacaoReason] = useState('');
  const [solicitacaoNewDate, setSolicitacaoNewDate] = useState('');
  const [solicitacaoNewDays, setSolicitacaoNewDays] = useState<number | null>(null);
  const [submittingSolicitacao, setSubmittingSolicitacao] = useState(false);
  // Nova agenda
  const [novaAgendaProject, setNovaAgendaProject] = useState('');
  const [novaAgendaStartDate, setNovaAgendaStartDate] = useState('');
  const [novaAgendaDays, setNovaAgendaDays] = useState<number | null>(null);
  const [novaAgendaObs, setNovaAgendaObs] = useState('');
  const [myRequests, setMyRequests] = useState<ChangeRequest[]>([]);
  const [showMyRequestsPanel, setShowMyRequestsPanel] = useState(false);

  const handleGenerateReport = async () => {
     setLoadingReport(true);
     setReportData(null);
     
     try {
       const [year, month] = reportMonth.split('-');
       const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
       const endDate = endOfMonth(startDate);

       const startStr = format(startDate, 'yyyy-MM-dd');
       const endStr = format(endDate, 'yyyy-MM-dd');

       // Fetch logs within range
       let query = supabase
         .from('project_daily_logs')
         .select(`
            id,
            date,
            description,
            allocation:allocations (
               id,
               consultant:profiles (full_name),
               project:projects (name)
            )
         `)
         .gte('date', startStr)
         .lte('date', endStr)
         .order('date', { ascending: true });
        
       const { error } = await query;
       if (error) throw error;
       
       // Filter by consultant manually if needed (or could do in query with inner join logic which is harder in basic supabase syntax sometimes)
       // The 'allocation' relation is to single allocation, so it returns an object
       
       // Improved Select
       const { data: robustData, error: robustError } = await supabase
         .from('project_daily_logs')
         .select(`
            id,
            date,
            description,
            allocation:allocations!inner (
               consultant_id,
               consultant:profiles (full_name),
               project:projects (name)
            )
         `)
         .gte('date', startStr)
         .lte('date', endStr)
         .order('date', { ascending: true });
         
       if (robustError) throw robustError;

       let finalData = (robustData || []).map((log: any) => ({
          id: log.id,
          date: log.date,
          description: log.description,
          consultantName: log.allocation?.consultant?.full_name,
          consultantId: log.allocation?.consultant_id,
          projectName: log.allocation?.project?.name
       }));

       if (reportConsultant !== 'all') {
         finalData = finalData.filter((d: any) => d.consultantId === reportConsultant);
       }

       setReportData(finalData);

     } catch (err: any) {
        console.error(err);
        alert('Erro ao gerar relatório: ' + err.message);
     } finally {
        setLoadingReport(false);
     }
  };

  const copyReportToClipboard = () => {
     if (!reportData) return;
     
     const textHeader = `RELATÓRIO DE DIÁRIO DE BORDO - ${reportMonth}\n\n`;
     const textBody = reportData.map((d: any) => 
       `[${format(parseISO(d.date), 'dd/MM/yyyy')}] ${d.consultantName} - ${d.projectName}\nObs: ${d.description || 'Sem descrição'}\n`
     ).join('-----------------------------------\n');

     navigator.clipboard.writeText(textHeader + textBody).then(() => {
        alert('Relatório copiado para a área de transferência!');
     });
  };

  // --- Fetch Data ---
  useEffect(() => {
     const fetchData = async () => {
        setLoading(true);

        // 1. Get User
        const { data: { user } } = await supabase.auth.getUser();
        let role: UserRole = 'CONSULTOR'; // Default fallback safe
        
        if (user) {
          setCurrentUser(user);
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
          if (profile) role = profile.role as UserRole;
        }
        setUserRole(role);

        // 2. Fetch Consultants
        let consQuery = supabase.from('profiles').select('*').order('full_name');
        
        // Security/Restriction: If not ADM, only show self
        // (Unless manager logic is added later, for now strict restriction)
        /* 
           NOTE: Ideally this should be RLS on backend too, but frontend filtering 
           provides the UI experience requested. 
        */
        const { data: consultantsData } = await consQuery;
        let loadedConsultants = (consultantsData || []).map(c => ({
           id: c.id,
           name: c.full_name,
           role: c.role,
           email: c.email
        }));

        if (role === 'CONSULTOR' && user) {
           loadedConsultants = loadedConsultants.filter(c => c.id === user.id);
        }

        // Ocultar contas Andrei de todas as views (overview, dropdown, grade)
        const HIDDEN_EMAILS_LOAD = ['andreimagagna@gmail.com', 'andrei@futuree.org'];
        loadedConsultants = loadedConsultants.filter(c =>
          !HIDDEN_EMAILS_LOAD.includes((c.email || '').toLowerCase())
        );

        setConsultants(loadedConsultants);
        if (loadedConsultants.length > 0) {
           setSelectedConsultantId(loadedConsultants[0].id);
        }

        // 3. Fetch Projects (Everyone sees projects usually, but maybe restrict sensitive info?)
        const { data: projectsData } = await supabase.from('projects').select('*');
        let visibleProjectIds = new Set<string>();

        if (projectsData && projectsData.length > 0) {
           let loadedProjects = projectsData.map(p => ({
              id: p.id,
              name: p.name,
              color: p.color,
              client: p.client, // client field from DB
              manager: p.manager,
              os: p.os,
              status: p.status,
              deadline: p.deadline,
              progress: p.progress,
              is_private: p.is_private
           }));

           // Filter projects logic
           if (role === 'GERENTE') {
               loadedProjects = loadedProjects.filter(p => !p.is_private);
           }
           
           loadedProjects.forEach(p => visibleProjectIds.add(p.id));
           visibleProjectIds.add('free');

           setProjects(prev => [...prev.filter(p => p.id === 'free'), ...loadedProjects]);
        }
        
        // 4. Fetch Allocations
        let allocQuery = supabase.from('allocations').select('*');
        
        if (role === 'CONSULTOR' && user) {
           allocQuery = allocQuery.eq('consultant_id', user.id);
        }

        const { data: allocData } = await allocQuery;
        const loadedAllocations = (allocData || [])
            .map(a => ({
               id: a.id,
               consultantId: a.consultant_id,
               projectId: a.project_id,
               date: a.date,
               os: a.os,
               manager: a.manager,
            }))
            .filter(a => {
                // If Manager, only show allocations for visible projects
                if (role === 'GERENTE') {
                    return visibleProjectIds.has(a.projectId);
                }
                return true;
            });
        setAllocations(loadedAllocations);
        
        setLoading(false);
     };

     fetchData();
  }, []);


  // --- Time Logic ---
  const getTimeColumns = () => {
    switch (timeView) {
      case 'day':
        return eachDayOfInterval({
          start: currentDate,
          end: addDays(currentDate, 6) // 7 days total
        });
      case 'week':
        return eachDayOfInterval({
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        });
      case 'month':
        return eachDayOfInterval({
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        });
    }
  };

  const timeColumns = getTimeColumns();

  const handlePrevDate = () => {
    if (timeView === 'day') setCurrentDate(d => addWeeks(d, -1));
    if (timeView === 'week') setCurrentDate(d => addWeeks(d, -1));
    if (timeView === 'month') setCurrentDate(d => addMonths(d, -1));
  };
  
  const handleNextDate = () => {
    if (timeView === 'day') setCurrentDate(d => addWeeks(d, 1));
    if (timeView === 'week') setCurrentDate(d => addWeeks(d, 1));
    if (timeView === 'month') setCurrentDate(d => addMonths(d, 1));
  };
  
  const handleJumpToToday = () => {
    setCurrentDate(new Date());
    setTimeView('day');
  };

  const handleJumpToWeek = () => {
    setCurrentDate(new Date());
    setTimeView('week');
  };

  const handleJumpToMonth = () => {
    setCurrentDate(new Date());
    setTimeView('month');
  };

  // --- Multi-Allocation Logic ---
  const getCellData = (consultantId: string, dateInfo: Date) => {
    // Returns array of allocations intersecting this cell
    let allocs: Allocation[] = [];

    // Exact date match (1 record = 1 day)
    const dateStr = format(dateInfo, 'yyyy-MM-dd');
    allocs = allocations.filter(a =>
      a.consultantId === consultantId && a.date === dateStr
    );

    if (allocs.length > 0) {
      return allocs.map(a => ({ ...a, proj: projects.find(p => p.id === a.projectId) }));
    }
    
    // Free slot
    return [{ id: `free-${consultantId}-${dateStr}`, consultantId, projectId: 'free', date: dateStr, proj: projects.find(p => p.id === 'free') }];
  };

  // --- Drag & Drop Generic Logic ---
  const handleDragStart = (e: React.DragEvent, allocation: Allocation) => {
    if (allocation.projectId === 'free') {
       e.preventDefault();
       return;
    }
    e.dataTransfer.setData('allocationId', allocation.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDay = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const allocId = e.dataTransfer.getData('allocationId');
    if (!allocId) return;

    const targetDateStr = format(targetDate, 'yyyy-MM-dd');

    // Optimistic Update
    setAllocations(prev => prev.map(a =>
      a.id === allocId ? { ...a, date: targetDateStr } : a
    ));

    // DB Update
    const { error } = await supabase
      .from('allocations')
      .update({ date: targetDateStr })
      .eq('id', allocId);

    if (error) {
       console.error('Erro ao mover alocação:', error);
       alert('Erro ao mover agenda. Tente novamente.');
       const { data } = await supabase.from('allocations').select('*').eq('id', allocId).single();
       if (data) {
          setAllocations(prev => prev.map(a => a.id === allocId ? { ...a, date: data.date } : a));
       }
    }
  };

  const handleDayClick = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    setNewAlloc(prev => ({ 
        ...prev, 
        startDate: formattedDate,
        endDate: formattedDate,
        consultantId: selectedConsultantId || prev.consultantId
    }));
    setShowModal(true);
  };


  // --- Drawer / Detail Logic ---
  const handleCellClick = async (data: any) => {
    if (data.projectId === 'free') return; // Ignore free cells for now

    setSelectedAllocation(data);
    setIsDrawerOpen(true);
    setLoadingLogs(true);
    setLogs([]); // clear prev logs
    setLogDrafts({});
    setShowChangeRequestForm(false);
    setAllocationRequests([]);

    // Fetch Logs + Change Requests in parallel
    try {
      const [logsResult] = await Promise.all([
        supabase.from('project_daily_logs').select('*').eq('allocation_id', data.id),
        fetchAllocationRequests(data.id)
      ]);

      const { data: logsData, error } = logsResult;
      if (!error && logsData) {
        setLogs(logsData as DailyLog[]);
        const draftMap = (logsData as DailyLog[]).reduce((acc, log) => {
          acc[log.date] = log.description || '';
          return acc;
        }, {} as Record<string, string>);
        setLogDrafts(draftMap);
      }
    } catch (e) {
      console.log('Logs table not ready or empty', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveLog = async (date: Date, text: string) => {
    if (!selectedAllocation) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingLog = logs.find(l => l.date === dateStr);

    if (existingLog) {
      // Update
      const { error } = await supabase.from('project_daily_logs').update({ description: text }).eq('id', existingLog.id);
      if (error) {
        console.error('Erro ao atualizar diário:', error);
        alert('Erro ao salvar diário. Verifique permissões do Supabase.');
        return;
      }
      setLogs(prev => prev.map(l => l.id === existingLog.id ? { ...l, description: text } : l));
    } else {
      if (!text.trim()) return;
      // Insert
      const { data, error } = await supabase.from('project_daily_logs').insert({
         allocation_id: selectedAllocation.id,
         date: dateStr,
         description: text,
         status: 'completed'
      }).select().single();

      if (error) {
        console.error('Erro ao inserir diário:', error);
        alert('Erro ao salvar diário. Verifique permissões do Supabase.');
        return;
      }

      if (data) {
        setLogs(prev => [...prev, data as DailyLog]);
      }
    }
  };


  // --- Modal Logic (New Allocation) ---
  const [showModal, setShowModal] = useState(false);
  const [newAlloc, setNewAlloc] = useState({
    consultantId: '',
    newConsultantName: '',
    projectId: '',
    newProjectName: '',
    os: '',
    manager: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
    isPrivate: false
  });

  const handleAddAllocation = async () => {
     try {
       let finalConsultantId = newAlloc.consultantId;
       let finalProjectId = newAlloc.projectId;

       // 1. Create Consultant if needed
       if (finalConsultantId === 'new') {
           // Backend connection:
           const { data: newCons, error: consError } = await supabase.from('profiles').insert({
               full_name: newAlloc.newConsultantName,
               role: 'CONSULTOR',
               email: `temp_${Date.now()}@agendas.com` // Mock email since email is required unique, handle properly in real app
           }).select().single();
           
           if (consError) throw consError;
           
           if (newCons) {
              setConsultants(prev => [...prev, { id: newCons.id, name: newCons.full_name, role: newCons.role }]);
              finalConsultantId = newCons.id;
           }
       }

       // 2. Create Project if needed
       if (finalProjectId === 'new') {
           // Backend connection:
           const { data: newProj, error: projError } = await supabase.from('projects').insert({
               name: newAlloc.newProjectName,
               color: 'bg-primary-100 text-primary-700 border-primary-200',
               status: 'Em Andamento',
               is_private: newAlloc.isPrivate
           }).select().single();

           if (projError) throw projError;

           if (newProj) {
              setProjects(prev => [...prev, { 
                  id: newProj.id, 
                  name: newProj.name, 
                  color: newProj.color,
                  is_private: newProj.is_private 
              }]);
              finalProjectId = newProj.id;
           }
       }

       if (!finalConsultantId || !finalProjectId) {
         alert('Selecione Consultor e Projeto');
         return;
       }

       // 3. Criar 1 alocação por dia no intervalo (novo schema)
       const start = parseISO(newAlloc.startDate);
       const end = parseISO(newAlloc.endDate);
       const totalDays = differenceInDays(end, start) + 1;
       
       if (totalDays <= 0) {
         alert('Data fim deve ser após data início');
         return;
       }

       const insertRows = Array.from({ length: totalDays }, (_, i) => ({
           consultant_id: finalConsultantId,
           project_id: finalProjectId,
           date: format(addDays(start, i), 'yyyy-MM-dd'),
           os: newAlloc.os || null,
           manager: newAlloc.manager || null,
       }));

       const { data: insertedAllocs, error: allocError } = await supabase
           .from('allocations')
           .insert(insertRows)
           .select();
       
       if (allocError) throw allocError;
       
       if (insertedAllocs) {
           setAllocations(prev => [...prev, ...insertedAllocs.map(a => ({
             id: a.id,
             consultantId: a.consultant_id,
             projectId: a.project_id,
             date: a.date,
             os: a.os,
             manager: a.manager,
           }))]);
       }

       setShowModal(false);
       // Reset form
       setNewAlloc({
         consultantId: '',
         newConsultantName: '',
         projectId: '',
         newProjectName: '',
         os: '',
         manager: '',
         startDate: format(new Date(), 'yyyy-MM-dd'),
         endDate: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
         isPrivate: false
       });

     } catch (err: any) {
       console.error(err);
       alert('Erro ao criar agenda: ' + (err.message || 'Erro desconhecido'));
     }
  };

  const handleUpdateAllocation = async (id: string, updates: Partial<Allocation>) => {
      try {
        const { error } = await supabase.from('allocations').update({
           project_id: updates.projectId,
           os: updates.os,
           manager: updates.manager,
        }).eq('id', id);

        if (error) throw error;

        setAllocations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        // Update selectedAllocation if it's the one being edited
        if (selectedAllocation?.id === id) {
           setSelectedAllocation(prev => prev ? { ...prev, ...updates, proj: updates.projectId ? projects.find(p => p.id === updates.projectId) : prev.proj } : null);
        }
        alert('Agenda atualizada com sucesso!');
      } catch (err: any) {
        console.error(err);
        alert('Erro ao atualizar agenda: ' + err.message);
      }
  };

  const handleDeleteAllocation = async (id: string) => {
      if (!confirm('Tem certeza que deseja remover esta alocação?')) return;
      try {
        const { error } = await supabase.from('allocations').delete().eq('id', id);
        if (error) throw error;
        
        setAllocations(prev => prev.filter(a => a.id !== id));
        setIsDrawerOpen(false);
        setSelectedAllocation(null);
      } catch (err: any) {
        console.error(err);
        alert('Erro ao excluir agenda: ' + err.message);
      }
  };


  // --- Change Requests ---
  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from('change_requests')
      .select(`
        *,
        requester:profiles!requester_id(full_name),
        allocation:allocations!allocation_id(
          date,
          consultant:profiles!consultant_id(full_name),
          project:projects!project_id(name)
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingRequests((data || []) as unknown as ChangeRequest[]);
  };

  const fetchAllocationRequests = async (allocId: string) => {
    const { data } = await supabase
      .from('change_requests')
      .select('*')
      .eq('allocation_id', allocId)
      .order('created_at', { ascending: false });
    setAllocationRequests((data || []) as unknown as ChangeRequest[]);
  };

  const fetchMyRequests = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('change_requests')
      .select(`
        *,
        allocation:allocations!allocation_id(
          date,
          project:projects!project_id(name)
        )
      `)
      .eq('requester_id', currentUser.id)
      .order('created_at', { ascending: false });
    setMyRequests((data || []) as unknown as ChangeRequest[]);
  };

  const handleSubmitSolicitacao = async () => {
    if (!solicitacaoAllocId || !currentUser || !solicitacaoReason.trim()) {
      alert('Selecione uma agenda e preencha o motivo.');
      return;
    }
    setSubmittingSolicitacao(true);
    try {
      const { error } = await supabase.from('change_requests').insert({
        allocation_id: solicitacaoAllocId,
        requester_id: currentUser.id,
        request_type: solicitacaoType,
        reason: solicitacaoReason.trim(),
        suggested_start_date: solicitacaoNewDate || null,
        suggested_days: solicitacaoNewDays || null
      });
      if (error) throw error;
      alert('Solicitação enviada! O administrador será notificado.');
      setShowSolicitacaoModal(false);
      setSolicitacaoReason('');
      setSolicitacaoNewDate('');
      setSolicitacaoNewDays(null);
      setSolicitacaoType('change');
      setSolicitacaoAllocId('');
      await fetchMyRequests();
      // Refresh admin pending requests count
      if (userRole === 'ADM') await fetchPendingRequests();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar solicitação: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSubmittingSolicitacao(false);
    }
  };

  const handleSubmitNovaAgenda = async () => {
    if (!currentUser || !novaAgendaProject.trim() || !novaAgendaStartDate || !novaAgendaObs.trim()) {
      alert('Preencha o projeto, a data de início e a descrição.');
      return;
    }
    setSubmittingSolicitacao(true);
    try {
      const { error } = await supabase.from('change_requests').insert({
        allocation_id: null,
        requester_id: currentUser.id,
        request_type: 'new_agenda',
        reason: `Projeto: ${novaAgendaProject.trim()}\n${novaAgendaObs.trim()}`,
        suggested_start_date: novaAgendaStartDate,
        suggested_days: novaAgendaDays || null
      });
      if (error) throw error;
      alert('Solicitação de nova agenda enviada! O administrador será notificado.');
      setShowSolicitacaoModal(false);
      setNovaAgendaProject('');
      setNovaAgendaStartDate('');
      setNovaAgendaDays(null);
      setNovaAgendaObs('');
      await fetchMyRequests();
      if (userRole === 'ADM') await fetchPendingRequests();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar solicitação: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSubmittingSolicitacao(false);
    }
  };

  const handleSubmitChangeRequest = async () => {
    if (!selectedAllocation || !currentUser || !changeRequestReason.trim()) {
      alert('Preencha o motivo da solicitação.');
      return;
    }
    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('change_requests').insert({
        allocation_id: selectedAllocation.id,
        requester_id: currentUser.id,
        request_type: changeRequestType,
        reason: changeRequestReason.trim(),
        suggested_start_date: changeRequestNewDate || null,
        suggested_days: changeRequestNewDays || null
      });
      if (error) throw error;

      alert('Solicitação enviada com sucesso! O administrador será notificado.');
      setShowChangeRequestForm(false);
      setChangeRequestReason('');
      setChangeRequestNewDate('');
      setChangeRequestNewDays(null);
      setChangeRequestType('change');
      await fetchAllocationRequests(selectedAllocation.id);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar solicitação: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleResolveRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('change_requests').update({
        status: newStatus,
        admin_response: adminResponse.trim() || null,
        resolved_by: currentUser.id,
        resolved_at: new Date().toISOString()
      }).eq('id', requestId);
      if (error) throw error;

      // If approved and is a cancel request, delete the allocation
      if (newStatus === 'approved') {
        const req = pendingRequests.find(r => r.id === requestId);
        if (req?.request_type === 'cancel') {
          await supabase.from('allocations').delete().eq('id', req.allocation_id);
          setAllocations(prev => prev.filter(a => a.id !== req.allocation_id));
        }
        if (req?.request_type === 'reschedule' && req.suggested_start_date) {
          await supabase.from('allocations').update({ date: req.suggested_start_date }).eq('id', req.allocation_id);
          setAllocations(prev => prev.map(a =>
            a.id === req.allocation_id
              ? { ...a, date: req.suggested_start_date! }
              : a
          ));
        }
      }

      setAdminResponse('');
      await fetchPendingRequests();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao resolver solicitação: ' + err.message);
    }
  };

  // Load pending requests for admins on mount; load my requests for consultants
  useEffect(() => {
    if (userRole === 'ADM') {
      fetchPendingRequests();
    } else if (userRole === 'CONSULTOR' && currentUser) {
      fetchMyRequests();
    }
  }, [userRole, currentUser]);


  // --- Filtering ---
  const HIDDEN_EMAILS = ['andreimagagna@gmail.com', 'andrei@futuree.org'];

  const filteredConsultants = consultants.filter(c => {
    // 0. Ocultar usuários Andrei da agenda
    if (HIDDEN_EMAILS.includes(c.email?.toLowerCase() || '')) return false;

    // 1. Text Search
    const matchText = 
      c.name.toLowerCase().includes(filterText.toLowerCase()) || 
      c.role.toLowerCase().includes(filterText.toLowerCase());
    
    // 3. Project Filter
    let matchProject = true;
    if (selectedProjectFilter !== 'all') {
      const hasAlloc = allocations.some(a => a.consultantId === c.id && a.projectId === selectedProjectFilter);
      matchProject = hasAlloc;
    }

    // 4. Manager Filter
    let matchManager = true;
    if (selectedManagerFilter !== 'all') {
      const hasManagerAlloc = allocations.some(a => a.consultantId === c.id && a.manager === selectedManagerFilter);
      matchManager = hasManagerAlloc;
    }

    return matchText && matchProject && matchManager;
  });

  // Extract unique managers for filter dropdown
  const uniqueManagers = Array.from(new Set(allocations.map(a => a.manager).filter(Boolean)));

  if (loading) return <div className="h-full flex items-center justify-center text-navy-500">Carregando dados...</div>;

  return (
    <div className='flex h-full overflow-hidden bg-navy-50 relative'>
      {/* Main Content Area */}
      <div className='flex-1 flex flex-col h-full overflow-hidden p-6'>
          
        {/* Top Controls */}
        <div className='bg-white rounded-xl shadow-sm border border-navy-100 p-4 shrink-0 mb-6'>
           <div className='flex flex-col xl:flex-row justify-between gap-4'>
              
              {/* Left: Resolution & Navigation */}
              <div className='flex flex-wrap items-center gap-4 xl:gap-6'>
                 {/* View Mode Switcher */}
                 <div className='inline-flex bg-navy-50 rounded-lg p-1 border border-navy-100 shadow-sm'>
                    <button
                        onClick={() => setViewMode('overview')}
                        className={clsx(
                          'p-1.5 rounded-md transition-all',
                          viewMode === 'overview' 
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' 
                            : 'text-navy-400 hover:text-navy-700 hover:bg-navy-100/50'
                        )}
                        title="Visão Geral"
                    >
                        <Eye className='w-5 h-5' />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                          'p-1.5 rounded-md transition-all',
                          viewMode === 'grid' 
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' 
                            : 'text-navy-400 hover:text-navy-700 hover:bg-navy-100/50'
                        )}
                        title="Grade"
                    >
                        <LayoutGrid className='w-5 h-5' />
                    </button>
                    <button
                        onClick={() => setViewMode('analytics')}
                        className={clsx(
                          'p-1.5 rounded-md transition-all',
                          viewMode === 'analytics' 
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' 
                            : 'text-navy-400 hover:text-navy-700 hover:bg-navy-100/50'
                        )}
                        title="Análises"
                    >
                        <BarChart3 className='w-5 h-5' />
                    </button>
                 </div>

                 <div className='w-px h-8 bg-navy-100 mx-2 hidden md:block'></div>

                 {/* Resolution Switcher */}
                 <div className='inline-flex bg-navy-50 rounded-lg p-1 border border-navy-100 shadow-sm'>
                    {(['day', 'week', 'month'] as TimeView[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setTimeView(mode)}
                        className={clsx(
                          'px-4 py-1.5 rounded-md text-sm font-semibold transition-all capitalize',
                          timeView === mode 
                            ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' 
                            : 'text-navy-500 hover:text-navy-700 hover:bg-navy-100/50'
                        )}
                      >
                        {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                 </div>

                 {/* Date Navigation */}
                 <div className='flex items-center bg-white border border-navy-100 rounded-lg shadow-sm px-2 py-1 gap-2'>
                    <div className='flex items-center gap-1 border-r border-navy-100 pr-2 mr-2'>
                       <button onClick={handleJumpToToday} className='text-xs font-semibold px-2 py-1 rounded hover:bg-navy-50 text-navy-600 transition-colors' title='Ir para Hoje'>Hoje</button>
                       <button onClick={handleJumpToWeek} className='text-xs font-semibold px-2 py-1 rounded hover:bg-navy-50 text-navy-600 transition-colors' title='Ver semana atual'>Sem</button>
                       <button onClick={handleJumpToMonth} className='text-xs font-semibold px-2 py-1 rounded hover:bg-navy-50 text-navy-600 transition-colors' title='Ver mês atual'>Mês</button>
                    </div>
                    
                    <button onClick={handlePrevDate} className='p-1 hover:bg-navy-50 rounded-md text-navy-400 hover:text-navy-900 transition-colors'>
                      <ChevronLeft className='w-5 h-5' />
                    </button>
                    <span className='font-bold text-navy-800 min-w-[200px] text-center text-sm px-2'>
                       {timeView === 'day' && 'Próximos 7 dias'}
                       {timeView === 'week' && `${format(timeColumns[0], 'dd MMM', { locale: ptBR })} - ${format(timeColumns[timeColumns.length-1], 'dd MMM yyyy', { locale: ptBR })}`}
                       {timeView === 'month' && format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                    </span>
                    <button onClick={handleNextDate} className='p-1 hover:bg-navy-50 rounded-md text-navy-400 hover:text-navy-900 transition-colors'>
                      <ChevronRight className='w-5 h-5' />
                    </button>
                 </div>
              </div>

              {/* Right: Actions & Filters */}
              <div className='flex flex-wrap items-center justify-end gap-3'>
                 <div className='flex items-center gap-2 border-r border-navy-100 pr-3 mr-1'>
                   <button 
                    onClick={() => setShowFilter(!showFilter)} 
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all group', 
                      showFilter ? 'bg-navy-100 text-primary-700 ring-1 ring-navy-200' : 'hover:bg-navy-50 text-navy-600'
                    )}
                   >
                     <Filter className={clsx('w-4 h-4', showFilter ? 'text-primary-600' : 'text-navy-400 group-hover:text-navy-600')} /> 
                     <span>Filtros</span>
                     {(filterText || selectedProjectFilter !== 'all' || selectedManagerFilter !== 'all') && (
                        <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                     )}
                   </button>
                 </div>

                 {userRole === 'ADM' && (
                   <button 
                    onClick={() => setShowRequestsPanel(!showRequestsPanel)}
                    className={clsx(
                      'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm',
                      showRequestsPanel 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                    )}
                    title="Solicitações de Alteração"
                  >
                     <Bell className='w-4 h-4' />
                     <span className='hidden sm:inline'>Solicitações</span>
                     {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
                       <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                         {pendingRequests.filter(r => r.status === 'pending').length}
                       </span>
                     )}
                  </button>
                 )}

                 {/* Consultant: My Requests Bell + Solicitar Alteração button */}
                 {userRole !== 'ADM' && (
                   <>
                     <button
                       onClick={() => { setShowMyRequestsPanel(!showMyRequestsPanel); fetchMyRequests(); }}
                       className={clsx(
                         'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm',
                         showMyRequestsPanel
                           ? 'bg-amber-50 text-amber-700 border-amber-200'
                           : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                       )}
                       title="Minhas Solicitações de Alteração"
                     >
                       <Bell className='w-4 h-4' />
                       <span className='hidden sm:inline'>Minhas Solicitações</span>
                       {myRequests.filter(r => r.status === 'pending').length > 0 && (
                         <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                           {myRequests.filter(r => r.status === 'pending').length}
                         </span>
                       )}
                     </button>
                     <button
                       onClick={() => { setSolicitacaoModalTab('alterar'); setShowSolicitacaoModal(true); }}
                       className='flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm'
                       title="Solicitar Alteração de Agenda"
                     >
                       <MessageSquarePlus className='w-4 h-4' />
                       <span className='hidden sm:inline'>Solicitar Alteração</span>
                     </button>
                   </>
                 )}

                 {userRole === 'ADM' && (
                   <>
                     <button 
                      onClick={() => setShowReportModal(true)}
                      className='flex items-center gap-2 px-3 py-2 bg-white hover:bg-navy-50 text-navy-700 border border-navy-200 rounded-lg text-sm font-medium transition-colors shadow-sm'
                      title="Relatório de Bordo"
                    >
                       <ClipboardList className='w-4 h-4' /> <span className='hidden sm:inline'>Relatório</span>
                    </button>

                     <button 
                      onClick={() => setShowModal(true)}
                      className='flex items-center gap-2 px-3 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm'
                    >
                      <Plus className='w-4 h-4' /> Novo
                    </button>
                   </>
                 )}
              </div>
           </div> {/* End of Top Flex Actions */}

           {/* Expanded Filters Row */}
           {showFilter && (
              <div className="mt-4 pt-4 border-t border-navy-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                 <div className='relative'>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Search className='w-4 h-4 text-navy-400' />
                    </div>
                    <input 
                       type='text' 
                       placeholder='Buscar por nome ou cargo...'
                       className='pl-10 block w-full rounded-lg border-navy-200 bg-navy-50 border text-sm text-navy-900 focus:ring-primary-500 focus:border-primary-500 p-2.5 outline-none focus:bg-white transition-all'
                       value={filterText}
                       onChange={(e) => setFilterText(e.target.value)}
                    />
                 </div>
                 
                 <div>
                    <select 
                       className='block w-full rounded-lg border-navy-200 bg-navy-50 border text-sm text-navy-900 focus:ring-primary-500 focus:border-primary-500 p-2.5 outline-none focus:bg-white transition-all'
                       value={selectedProjectFilter}
                       onChange={(e) => setSelectedProjectFilter(e.target.value)}
                    >
                       <option value="all">Todos Projetos</option>
                       {projects.filter(p => p.id !== 'free').map(p => (
                         <option key={p.id} value={p.id}>{p.name}</option>
                       ))}
                    </select>
                 </div>

                 <div className="flex gap-2">
                    <select 
                       className='block w-full rounded-lg border-navy-200 bg-navy-50 border text-sm text-navy-900 focus:ring-primary-500 focus:border-primary-500 p-2.5 outline-none focus:bg-white transition-all'
                       value={selectedManagerFilter}
                       onChange={(e) => setSelectedManagerFilter(e.target.value)}
                    >
                       <option value="all">Todos Gerentes</option>
                       {uniqueManagers.map(mgr => (
                         <option key={mgr} value={mgr}>{mgr}</option>
                       ))}
                    </select>
                    
                    {/* Clear Button */}
                     {(filterText || selectedProjectFilter !== 'all' || selectedManagerFilter !== 'all') && (
                       <button 
                         onClick={() => { setFilterText(''); setSelectedProjectFilter('all'); setSelectedManagerFilter('all'); }}
                         className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-red-100"
                         title="Limpar filtros"
                       >
                         <X className="w-5 h-5" />
                       </button>
                     )}
                 </div>
              </div>
           )}
        </div>

        {/* Admin: Pending Requests Panel */}
        {showRequestsPanel && userRole === 'ADM' && (
          <div className='bg-white rounded-xl shadow-sm border border-amber-200 p-5 shrink-0 mb-6 animate-in fade-in slide-in-from-top-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-amber-50 rounded-lg text-amber-600'>
                  <Bell className='w-5 h-5' />
                </div>
                <div>
                  <h3 className='font-bold text-navy-900'>Solicitações de Alteração</h3>
                  <p className='text-xs text-navy-500'>{pendingRequests.filter(r => r.status === 'pending').length} pendente{pendingRequests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={() => setShowRequestsPanel(false)} className='p-1 hover:bg-navy-50 rounded-lg text-navy-400'>
                <X className='w-5 h-5' />
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <p className='text-navy-400 text-sm text-center py-6'>Nenhuma solicitação encontrada.</p>
            ) : (
              <div className='space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1'>
                {pendingRequests.map(req => {
                  const consultant = consultants.find(c => c.id === req.requester_id);
                  const allocation = allocations.find(a => a.id === req.allocation_id);
                  const project = allocation ? projects.find(p => p.id === allocation.projectId) : null;
                  const isNovaAgenda = req.request_type === 'new_agenda';
                  const novaAgendaProject = isNovaAgenda && req.reason?.startsWith('Projeto:')
                    ? req.reason.split('\n')[0].replace('Projeto:', '').trim() : '';
                  const novaAgendaDetails = isNovaAgenda
                    ? req.reason?.split('\n').slice(1).join('\n').trim() : req.reason;
                  return (
                    <div key={req.id} className={clsx(
                      'rounded-lg p-4 border transition-all',
                      req.status === 'pending' && 'bg-amber-50/50 border-amber-200 hover:border-amber-300',
                      req.status === 'approved' && 'bg-emerald-50/50 border-emerald-200',
                      req.status === 'rejected' && 'bg-red-50/50 border-red-200'
                    )}>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-1 flex-wrap'>
                            <span className='font-bold text-sm text-navy-800'>{consultant?.name || 'Consultor'}</span>
                            <span className={clsx(
                              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                              isNovaAgenda ? 'bg-primary-100 text-primary-700' : 'bg-navy-100 text-navy-600'
                            )}>
                              {isNovaAgenda ? '+ Nova Agenda' : req.request_type === 'change' ? 'Alteração' : req.request_type === 'cancel' ? 'Cancelamento' : 'Reagendamento'}
                            </span>
                            <span className={clsx(
                              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                              req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            )}>
                              {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovada' : 'Recusada'}
                            </span>
                          </div>
                          {isNovaAgenda ? (
                            <>
                              {novaAgendaProject && <p className='text-xs text-navy-500 mb-1'>Projeto solicitado: <span className='font-semibold'>{novaAgendaProject}</span></p>}
                              {req.suggested_start_date && (
                                <p className='text-xs text-navy-500 mb-1'>
                                  Data solicitada: {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}
                                  {req.suggested_days ? ` — ${req.suggested_days} dias` : ''}
                                </p>
                              )}
                              {novaAgendaDetails && <p className='text-sm text-navy-700'>{novaAgendaDetails}</p>}
                            </>
                          ) : (
                            <>
                              {project && allocation && (
                                <p className='text-xs text-navy-500 mb-1'>
                                  Projeto: <span className='font-semibold'>{project.name}</span> — {format(parseISO(allocation.date), 'dd/MM/yyyy')}
                                </p>
                              )}
                              <p className='text-sm text-navy-700'>{req.reason}</p>
                              {req.suggested_start_date && (
                                <p className='text-xs text-navy-400 mt-1'>Nova data sugerida: {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}{req.suggested_days ? ` (${req.suggested_days} dias)` : ''}</p>
                              )}
                            </>
                          )}
                          <p className='text-[10px] text-navy-300 mt-1'>{format(parseISO(req.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        </div>

                        {req.status === 'pending' && (
                          <div className='flex flex-col gap-1.5 shrink-0'>
                            <button
                              onClick={() => handleResolveRequest(req.id, 'approved')}
                              className='px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 transition-colors'
                            >
                              <CheckCheck className='w-3 h-3' /> Aprovar
                            </button>
                            <button
                              onClick={() => handleResolveRequest(req.id, 'rejected')}
                              className='px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg flex items-center gap-1 transition-colors'
                            >
                              <XCircle className='w-3 h-3' /> Recusar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Consultant: My Requests Panel */}
        {showMyRequestsPanel && userRole !== 'ADM' && (
          <div className='bg-white rounded-xl shadow-sm border border-amber-200 p-5 shrink-0 mb-6 animate-in fade-in slide-in-from-top-2'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-amber-50 rounded-lg text-amber-600'>
                  <Bell className='w-5 h-5' />
                </div>
                <div>
                  <h3 className='font-bold text-navy-900'>Minhas Solicitações de Alteração</h3>
                  <p className='text-xs text-navy-500'>{myRequests.filter(r => r.status === 'pending').length} pendente{myRequests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => { setSolicitacaoModalTab('alterar'); setShowSolicitacaoModal(true); }}
                  className='flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors'
                >
                  <MessageSquarePlus className='w-3.5 h-3.5' /> Nova Solicitação
                </button>
                <button onClick={() => setShowMyRequestsPanel(false)} className='p-1 hover:bg-navy-50 rounded-lg text-navy-400'>
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            {myRequests.length === 0 ? (
              <div className='text-center py-8 text-navy-400'>
                <MessageSquarePlus className='w-10 h-10 mx-auto mb-2 opacity-20' />
                <p className='text-sm'>Nenhuma solicitação enviada ainda.</p>
                <button
                  onClick={() => { setSolicitacaoModalTab('alterar'); setShowSolicitacaoModal(true); }}
                  className='mt-3 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors inline-flex items-center gap-2'
                >
                  <MessageSquarePlus className='w-4 h-4' /> Criar primeira solicitação
                </button>
              </div>
            ) : (
              <div className='space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1'>
                {myRequests.map(req => {
                  const reqAlloc = (req as any).allocation;
                  const reqProject = reqAlloc?.project;
                  const isNovaAgenda = req.request_type === 'new_agenda';
                  // For nova agenda, extract project name from reason prefix "Projeto: X\n..."
                  const novaAgendaProjectName = isNovaAgenda
                    ? (req.reason?.startsWith('Projeto:') ? req.reason.split('\n')[0].replace('Projeto:', '').trim() : '')
                    : '';
                  const novaAgendaDescription = isNovaAgenda
                    ? req.reason?.split('\n').slice(1).join('\n').trim()
                    : req.reason;
                  return (
                    <div key={req.id} className={clsx(
                      'rounded-lg p-4 border',
                      req.status === 'pending' && 'bg-amber-50/50 border-amber-200',
                      req.status === 'approved' && 'bg-emerald-50/50 border-emerald-200',
                      req.status === 'rejected' && 'bg-red-50/50 border-red-200'
                    )}>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 flex-wrap mb-1'>
                            <span className={clsx(
                              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                              isNovaAgenda ? 'bg-primary-100 text-primary-700' : 'bg-navy-100 text-navy-600'
                            )}>
                              {isNovaAgenda ? '+ Nova Agenda' : req.request_type === 'change' ? 'Alteração' : req.request_type === 'cancel' ? 'Cancelamento' : 'Reagendamento'}
                            </span>
                            <span className={clsx(
                              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                              req.status === 'pending' ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            )}>
                              {req.status === 'pending' ? '⏳ Pendente' : req.status === 'approved' ? '✅ Aprovada' : '❌ Recusada'}
                            </span>
                          </div>
                          {isNovaAgenda ? (
                            <div className='mb-1'>
                              {novaAgendaProjectName && (
                                <p className='text-xs text-navy-500 mb-0.5'>Projeto: <span className='font-semibold'>{novaAgendaProjectName}</span></p>
                              )}
                              {req.suggested_start_date && (
                                <p className='text-xs text-navy-500 mb-0.5'>
                                  Início: {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}
                                  {req.suggested_days ? ` — ${req.suggested_days} dias` : ''}
                                </p>
                              )}
                              {novaAgendaDescription && <p className='text-sm text-navy-700'>{novaAgendaDescription}</p>}
                            </div>
                          ) : (
                            <>
                              {reqProject && reqAlloc && (
                                <p className='text-xs text-navy-500 mb-1'>
                                  Projeto: <span className='font-semibold'>{reqProject.name}</span> — {format(parseISO(reqAlloc.date), 'dd/MM/yyyy')}
                                </p>
                              )}
                              <p className='text-sm text-navy-700'>{req.reason}</p>
                            </>
                          )}
                          {req.admin_response && (
                            <p className='text-xs text-navy-500 mt-1 italic'>Resposta do admin: {req.admin_response}</p>
                          )}
                          <p className='text-[10px] text-navy-300 mt-1'>{format(parseISO(req.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content Body */}
        {viewMode === 'overview' ? (
            <div className='flex-1 bg-white rounded-xl shadow-sm border border-navy-100 overflow-y-auto p-6 custom-scrollbar'>
               {(() => {
                  const mStart = startOfMonth(currentDate);
                  const mEnd = endOfMonth(currentDate);
                  const workDaysAll = eachDayOfInterval({ start: mStart, end: mEnd }).filter(d => d.getDay() !== 0 && d.getDay() !== 6);
                  const totalWorkDays = workDaysAll.length;

                  const consultantStats = filteredConsultants.map(c => {
                     let busy = 0;
                     const projectDays: Record<string, number> = {};
                     workDaysAll.forEach(d => {
                        const cellData = getCellData(c.id, d);
                        const occupied = cellData.filter(a => a.projectId !== 'free');
                        if (occupied.length > 0) {
                           busy++;
                           occupied.forEach(a => {
                              const pName = a.proj?.name || 'Sem projeto';
                              projectDays[pName] = (projectDays[pName] || 0) + 1;
                           });
                        }
                     });
                     return {
                        id: c.id,
                        name: c.name,
                        role: c.role,
                        busy,
                        available: totalWorkDays - busy,
                        occupancy: totalWorkDays > 0 ? Math.round((busy / totalWorkDays) * 100) : 0,
                        projectDays
                     };
                  });

                  const totalBusy = consultantStats.reduce((sum, c) => sum + c.busy, 0);
                  const totalAvailable = consultantStats.reduce((sum, c) => sum + c.available, 0);
                  const avgOccupancy = consultantStats.length > 0 ? Math.round(consultantStats.reduce((sum, c) => sum + c.occupancy, 0) / consultantStats.length) : 0;

                  return (
                     <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
                        {/* Month Navigation */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                           <div>
                              <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-3">
                                 <div className="p-2 bg-primary-50 rounded-lg">
                                    <Eye className="w-6 h-6 text-primary-600" />
                                 </div>
                                 Visão Geral de Disponibilidade
                              </h2>
                              <p className="text-navy-500 mt-1 text-sm">Dados atualizados automaticamente do banco de dados.</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <button
                                 onClick={() => setCurrentDate(d => addMonths(d, -1))}
                                 className="p-2 hover:bg-navy-100 rounded-lg text-navy-500 hover:text-navy-800 transition-colors border border-navy-200"
                                 title="Mês anterior"
                              >
                                 <ChevronLeft className="w-5 h-5" />
                              </button>
                              <span className="font-bold text-navy-800 min-w-[200px] text-center text-lg capitalize">
                                 {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                              </span>
                              <button
                                 onClick={() => setCurrentDate(d => addMonths(d, 1))}
                                 className="p-2 hover:bg-navy-100 rounded-lg text-navy-500 hover:text-navy-800 transition-colors border border-navy-200"
                                 title="Próximo mês"
                              >
                                 <ChevronRight className="w-5 h-5" />
                              </button>
                              <button
                                 onClick={() => setCurrentDate(new Date())}
                                 className="px-3 py-2 text-sm font-semibold bg-navy-100 hover:bg-navy-200 text-navy-700 rounded-lg transition-colors"
                              >
                                 Hoje
                              </button>
                           </div>
                        </div>

                        {/* Legend + Work Days Badge */}
                        <div className="flex flex-wrap items-center gap-4 text-sm mb-5">
                           <span className="flex items-center gap-1.5 text-navy-500">
                              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
                              Disponível
                           </span>
                           <span className="flex items-center gap-1.5 text-navy-500">
                              <span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>
                              Ocupado
                           </span>
                           <span className="px-2.5 py-1 bg-navy-100 rounded-full text-xs font-bold text-navy-600">
                              {totalWorkDays} dias úteis no mês
                           </span>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                           <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center">
                              <div className="text-4xl font-bold text-emerald-600">{totalAvailable}</div>
                              <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mt-1">Dias Disponíveis (soma)</div>
                           </div>
                           <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-center">
                              <div className="text-4xl font-bold text-red-600">{totalBusy}</div>
                              <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mt-1">Dias Ocupados (soma)</div>
                           </div>
                           <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 text-center">
                              <div className="text-4xl font-bold text-primary-600">{avgOccupancy}%</div>
                              <div className="text-xs font-semibold text-primary-500 uppercase tracking-wide mt-1">Taxa Média de Ocupação</div>
                           </div>
                        </div>

                        {/* Per-Consultant Table */}
                        <div className="bg-white border border-navy-200 rounded-xl overflow-hidden shadow-sm">
                           <div className="grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-3.5 border-b border-navy-200 bg-navy-50 text-[11px] font-bold text-navy-500 uppercase tracking-wider">
                              <span>Consultor</span>
                              <span className="text-center">Ocupados</span>
                              <span className="text-center">Livres</span>
                              <span className="text-center">Ocupação</span>
                              <span>Distribuição</span>
                           </div>
                           {consultantStats.map((stat) => (
                              <div
                                 key={stat.id}
                                 onClick={() => { setSelectedConsultantId(stat.id); setViewMode('grid'); setTimeView('month'); }}
                                 className={clsx(
                                    "grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-4 border-b border-navy-100 last:border-0 cursor-pointer transition-all hover:bg-navy-50/70 group"
                                 )}
                              >
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-navy-700 text-xs font-bold border border-navy-200 shrink-0">
                                       {stat.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                       <div className="text-sm font-semibold text-navy-900 truncate group-hover:text-primary-700 transition-colors">{stat.name}</div>
                                       <div className="text-[10px] text-navy-400">{stat.role}</div>
                                    </div>
                                 </div>
                                 <div className="flex items-center justify-center">
                                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 text-base font-bold text-red-600 border border-red-100">{stat.busy}</span>
                                 </div>
                                 <div className="flex items-center justify-center">
                                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-base font-bold text-emerald-600 border border-emerald-100">{stat.available}</span>
                                 </div>
                                 <div className="flex items-center justify-center">
                                    <span className={clsx(
                                       "text-base font-bold",
                                       stat.occupancy >= 80 ? "text-red-600" : stat.occupancy >= 50 ? "text-amber-600" : "text-emerald-600"
                                    )}>
                                       {stat.occupancy}%
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <div className="flex-1 flex flex-col gap-1.5">
                                       <div className="w-full bg-navy-100 rounded-full h-3 overflow-hidden">
                                          <div
                                             className={clsx(
                                                "h-full rounded-full transition-all duration-700",
                                                stat.occupancy >= 80 ? "bg-red-500" : stat.occupancy >= 50 ? "bg-amber-400" : "bg-emerald-500"
                                             )}
                                             style={{ width: `${stat.occupancy}%` }}
                                          />
                                       </div>
                                       {Object.keys(stat.projectDays).length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                             {Object.entries(stat.projectDays).sort((a,b) => b[1] - a[1]).map(([proj, days]) => (
                                                <span key={proj} className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 truncate max-w-[160px]" title={`${proj}: ${days} dias`}>
                                                   {proj} ({days}d)
                                                </span>
                                             ))}
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* Tip */}
                        <div className="mt-4 text-center text-xs text-navy-400">
                           Clique em um consultor para ver o calendário detalhado dele.
                        </div>
                     </div>
                  );
               })()}
            </div>
        ) : viewMode === 'grid' && timeView === 'month' ? (
            <div className='flex-1 bg-white rounded-xl shadow-sm border border-navy-100 overflow-y-auto p-6 custom-scrollbar'>
               {(() => {
                  const targetId = selectedConsultantId || (consultants.length > 0 ? consultants[0].id : '');
                  const targetConsultant = consultants.find(c => c.id === targetId);
                  
                  if (!targetConsultant) return <div className="flex h-full items-center justify-center text-navy-400">Nenhum consultor selecionado</div>;

                  const monthStart = startOfMonth(currentDate);
                  const monthEnd = endOfMonth(currentDate);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                  
                  const workDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(d => d.getDay() !== 0 && d.getDay() !== 6);
                  let busyCount = 0;
                  workDays.forEach(d => {
                      if (getCellData(targetId, d).some(a => a.projectId !== 'free')) busyCount++;
                  });
                  const availableCount = workDays.length - busyCount;

                  return (
                    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
                       {/* Controls & Stats */}
                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-navy-100 flex flex-col lg:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-4 w-full lg:w-auto">
                              <div className="w-14 h-14 rounded-full bg-linear-to-br from-primary-50 to-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold border border-primary-200 shadow-inner">
                                 {targetConsultant.name?.substring(0,2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-[200px]">
                                 <label className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-1 block">Consultor</label>
                                 {userRole === 'CONSULTOR' ? (
                                    <div className="text-lg font-semibold text-navy-900">{targetConsultant.name}</div>
                                 ) : (
                                    <div className="relative">
                                      <select 
                                         value={targetId}
                                         onChange={(e) => setSelectedConsultantId(e.target.value)}
                                         className="appearance-none block w-full pl-0 pr-10 py-1 text-xl font-bold bg-transparent border-0 border-b-2 border-navy-100 focus:border-primary-500 focus:ring-0 cursor-pointer text-navy-800 transition-colors"
                                      >
                                         {consultants.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                         ))}
                                      </select>
                                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-navy-400">
                                         <span className="text-xs">▼</span>
                                      </div>
                                    </div>
                                 )}
                              </div>
                          </div>

                          <div className="flex items-center gap-6 bg-navy-50/50 px-8 py-4 rounded-xl border border-navy-100">
                              <div className="text-center group cursor-default">
                                 <div className="text-3xl font-bold text-emerald-600 transition-transform group-hover:scale-110">{availableCount}</div>
                                 <div className="text-xs font-bold text-navy-400 uppercase tracking-wide mt-1">Disponíveis</div>
                              </div>
                              <div className="w-px h-10 bg-navy-200"></div>
                              <div className="text-center group cursor-default">
                                 <div className="text-3xl font-bold text-red-600 transition-transform group-hover:scale-110">{busyCount}</div>
                                 <div className="text-xs font-bold text-navy-400 uppercase tracking-wide mt-1">Ocupados</div>
                              </div>
                          </div>
                       </div>

                       {/* Calendar */}
                       <div className="bg-white rounded-2xl shadow-sm border border-navy-200 overflow-hidden">
                          <div className="grid grid-cols-7 border-b border-navy-200 bg-navy-50">
                             {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].map(day => (
                                <div key={day} className="py-4 text-center text-xs font-bold text-navy-500 uppercase tracking-wider">
                                   {day}
                                </div>
                             ))}
                          </div>
                          <div className="grid grid-cols-7 bg-navy-100 gap-px border-b border-navy-200">
                             {calendarDays.map((date, i) => {
                                const isCurrentMonth = isSameMonth(date, currentDate);
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const isToday = isSameDay(date, new Date());
                                const cellAlloc = getCellData(targetId, date);
                                const isOccupied = cellAlloc.some(a => a.projectId !== 'free');
                                
                                return (
                                   <div 
                                      key={i} 
                                      className={clsx(
                                          'min-h-[120px] bg-white p-3 flex flex-col gap-2 transition-colors hover:bg-slate-50 relative group',
                                          !isCurrentMonth && 'bg-slate-50/50',
                                          isWeekend && 'bg-slate-50/30'
                                      )}
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDropOnDay(e, date)}
                                      onClick={() => !isOccupied && handleDayClick(date)}
                                   >
                                      <div className="flex justify-between items-start pointer-events-none">
                                         <span className={clsx(
                                            'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-all',
                                            isToday ? 'bg-primary-600 text-white shadow-md scale-110' : isCurrentMonth ? 'text-navy-700' : 'text-navy-300'
                                         )}>
                                            {format(date, 'd')}
                                         </span>
                                         {isCurrentMonth && !isWeekend && (
                                            <div className={clsx(
                                               'w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm',
                                               isOccupied ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'
                                            )}></div>
                                         )}
                                      </div>
                                      
                                      <div className="flex-1 flex flex-col gap-1 mt-1">
                                          {cellAlloc.filter(a => a.projectId !== 'free').map((alloc, idx) => (
                                             <div 
                                                key={idx} 
                                                className="text-[10px] font-medium px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 truncate shadow-sm cursor-pointer hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, alloc)}
                                                onClick={(e) => { e.stopPropagation(); handleCellClick(alloc); }}
                                                title={`Projeto: ${alloc.proj?.name}\nCliente: ${alloc.proj?.client || 'N/A'}\nData: ${alloc.date}\nOS: ${alloc.os || 'N/A'}`}
                                             >
                                                {alloc.proj?.name}
                                             </div>
                                          ))}
                                          
                                          {!isOccupied && !isWeekend && isCurrentMonth && (
                                              <div className="mt-auto flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                 <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                                    + LIVRE
                                                 </span>
                                              </div>
                                          )}
                                      </div>
                                   </div>
                                );
                             })}
                          </div>
                       </div>
                    </div>
                  );
               })()}
            </div>
        ) : viewMode === 'grid' ? (
        <div className='flex-1 bg-white rounded-xl shadow-sm border border-navy-100 overflow-hidden flex flex-col'>
           
           {/* Table Header */}
           <div className='flex overflow-hidden border-b border-navy-200 bg-navy-50/90 z-20'>
               <div className='w-64 shrink-0 p-3 font-semibold text-xs text-navy-500 uppercase tracking-wider border-r border-navy-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-20 bg-navy-50'>
                 Consultor
               </div>
               
               <div className='flex-1 overflow-x-auto custom-scrollbar flex'>
                  {timeView === 'month' ? (
                     <div className='p-3 w-full text-center font-semibold text-xs text-navy-500 uppercase tracking-wider'>
                       Resumo de Disponibilidade ({format(currentDate, 'MMMM', { locale: ptBR })})
                     </div>
                  ) : (
                    timeColumns.map((date, idx) => {
                      const isToday = isSameDay(date, new Date());
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      
                      return (
                      <div key={idx} className={clsx(
                        'border-r border-navy-200 p-2 text-center box-border shrink-0 transition-colors',
                        isToday ? 'bg-primary-50/50 relative' : isWeekend ? 'bg-slate-50' : 'bg-navy-50',
                        timeView === 'week' ? 'w-32' : 'w-24'
                      )}>
                         {isToday && (
                           <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary-500 rounded-r-full h-full"></div>
                         )}
                         <div className={clsx('text-xs font-semibold', isToday ? 'text-primary-700' : 'text-navy-700')}>
                           {format(date, 'dd MMM', { locale: ptBR })}
                         </div>
                         <div className='text-[10px] text-navy-400 font-medium capitalize'>
                           {format(date, 'EEEE', { locale: ptBR }).split('-')[0]}
                         </div>
                      </div>
                    )})
                  )}
               </div>
           </div>

           {/* Table Body */}
           <div className='overflow-y-auto overflow-x-auto flex-1 custom-scrollbar'>
              <div className='min-w-max w-full'>
                 {filteredConsultants.map(consultant => {
                   return (
                   <div key={consultant.id} className='flex group hover:bg-navy-50/30 transition-colors border-b border-navy-100 last:border-0'>
                      {/* Name Column */}
                      <div 
                         onClick={() => { setSelectedConsultantId(consultant.id); setTimeView('month'); }}
                         className='w-64 shrink-0 sticky left-0 z-10 bg-white group-hover:bg-navy-50/30 border-r border-navy-200 p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-navy-50 transition-colors'
                      >
                         <div className='flex items-center gap-3'>
                           <div className='w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 text-xs font-bold border border-navy-200'>
                             {consultant.name.substring(0,2).toUpperCase()}
                           </div>
                           <div className='overflow-hidden'>
                             <div className='text-sm font-medium text-navy-900 truncate'>{consultant.name}</div>
                             <div className='text-[10px] text-navy-400 truncate'>{consultant.role}</div>
                           </div>
                         </div>
                      </div>

                      {/* Scrolled Content */}
                      <div className='flex-1 flex'>
                            {timeColumns.map((date, idx) => {
                            const allocs = getCellData(consultant.id, date);
                            const isToday = isSameDay(date, new Date());
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                            return (
                              <div key={idx} className={clsx(
                                'border-r border-navy-100 p-1 box-border shrink-0 flex flex-col gap-1 overflow-y-auto transition-colors',
                                isToday ? 'bg-primary-50/20' : isWeekend ? 'bg-slate-50/40' : '',
                                timeView === 'week' ? 'w-32' : 'w-24'
                              )}>
                                 {isToday && (
                                   <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-primary-200 h-full pointer-events-none"></div>
                                 )}
                                 {/* Render each allocation in this cell */}
                                 {allocs.map((cell, cIdx) => (
                                     <div 
                                      key={`${cell.id}-${cIdx}`}
                                      onClick={() => cell.projectId !== 'free' && handleCellClick(cell)}
                                      className={clsx(
                                        'w-full min-h-[28px] rounded-md flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-[1.02] border',
                                        cell.proj?.color || 'bg-navy-50 border-navy-100 text-navy-300 hover:bg-navy-100',
                                        cell.projectId === 'free' && 'hidden'
                                      )}
                                      title={cell.proj?.name !== 'VAGO' ? [
                                        cell.proj?.name,
                                        cell.proj?.client ? `Cliente: ${cell.proj.client}` : null,
                                        cell.os ? `OS: ${cell.os}` : cell.proj?.os ? `OS: ${cell.proj.os}` : null,
                                        cell.manager ? `Gerente: ${cell.manager}` : cell.proj?.manager ? `Gerente: ${cell.proj.manager}` : null
                                      ].filter(Boolean).join('\n') : undefined}
                                    >
                                     {cell.proj?.name !== 'VAGO' && (
                                       <span className='truncate px-1 text-[10px] font-semibold w-full text-center'>
                                          {cell.proj?.name}
                                       </span>
                                     )}
                                   </div>
                                 ))}
                                 
                                 {/* If no real allocs, show an empty placeholder to maintain grid cleanliness */}
                                 {allocs.length === 1 && allocs[0].projectId === 'free' && (
                                    <div className='w-full h-full min-h-[28px] bg-navy-50/50 rounded-md border border-navy-100/50'></div>
                                 )}
                              </div>
                            );
                         })}
                      </div>
                   </div>
                   );
                 })}
              </div>
           </div>
        </div>
        ) : (
          <div className='flex-1 bg-white rounded-xl shadow-sm border border-navy-100 overflow-y-auto p-8'>
             <div className='max-w-6xl mx-auto space-y-8'>
                <div className='mb-6'>
                   <h2 className='text-xl font-bold text-navy-900'>Dashboard de Alocações</h2>
                   <p className='text-navy-500'>Visão geral de desempenho e distribuição.</p>
                </div>

                {/* KPI Cards */}
                <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                   {[
                      { label: 'Total Alocações', value: allocations.length, icon: CalendarDays, color: 'text-primary-600', bg: 'bg-primary-50' },
                      { label: 'Projetos Ativos', value: new Set(allocations.map(a => a.projectId)).size, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Consultores Alocados', value: new Set(allocations.map(a => a.consultantId)).size, icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Diários Preenchidos', value: logs.length, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
                   ].map((stat, i) => (
                      <div key={i} className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center justify-between'>
                         <div>
                            <p className='text-sm text-navy-500 font-medium'>{stat.label}</p>
                            <p className='text-2xl font-bold text-navy-900 mt-1'>{stat.value}</p>
                         </div>
                         <div className={`p-3 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                         </div>
                      </div>
                   ))}
                </div>

                {/* Charts Area */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                   {/* Project Distribution Chart (ADM View) */}
                   {userRole === 'ADM' && (
                     <>
                        <div className='bg-white p-6 rounded-xl border border-navy-100 shadow-sm min-w-0'>
                           <h3 className='text-lg font-bold text-navy-900 mb-4 flex items-center gap-2'>
                              <PieChart className='w-5 h-5 text-navy-500' />
                              Distribuição de Status de Projetos
                           </h3>
                           <div className='h-64 relative min-w-0'>
                              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                  <RePieChart>
                                     <Pie
                                        data={[
                                           { name: 'Em Andamento', value: projects.filter(p => p.status === 'Em Andamento').length, color: '#3b82f6' },
                                           { name: 'Em Planejamento', value: projects.filter(p => p.status === 'Em Planejamento').length, color: '#f59e0b' },
                                           { name: 'Concluído', value: projects.filter(p => p.status === 'Concluído').length, color: '#10b981' },
                                           { name: 'Crítico', value: projects.filter(p => p.status === 'Crítico').length, color: '#ef4444' }
                                        ].filter(d => d.value > 0)}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({name, percent}) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                     >
                                       {
                                          projects.map((_, index) => (
                                             <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#10b981', '#ef4444'][index % 4]} />
                                          )) // Note: Colors handled in data map above effectively
                                       }
                                     </Pie>
                                     <Tooltip />
                                     <Legend />
                                  </RePieChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        <div className='bg-white p-6 rounded-xl border border-navy-100 shadow-sm min-w-0'>
                           <h3 className='text-lg font-bold text-navy-900 mb-4 flex items-center gap-2'>
                              <BarChart3 className='w-5 h-5 text-navy-500' />
                              Top 5 Consultores (Dias Alocados)
                           </h3>
                           <div className='h-64 relative min-w-0'>
                              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                  <BarChart 
                                       data={Object.values(allocations.reduce((acc, curr) => {
                                          const cName = consultants.find(c => c.id === curr.consultantId)?.name || 'Desconhecido';
                                          if (!acc[curr.consultantId]) acc[curr.consultantId] = { name: cName, days: 0 };
                                          acc[curr.consultantId].days += 1; // cada registro = 1 dia
                                          return acc;
                                       }, {} as Record<string, {name: string, days: number}>))
                                       .sort((a,b) => b.days - a.days)
                                       .slice(0, 5)}
                                       layout="vertical"
                                    >
                                     <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                     <XAxis type="number" />
                                     <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '12px' }} />
                                     <Tooltip />
                                     <Bar dataKey="days" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Dias" />
                                  </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                     </>
                   )}

                   {/* Consultant View (Self Stats) */}
                   {(userRole === 'CONSULTOR' || !userRole) && (
                      <div className='bg-white p-6 rounded-xl border border-navy-100 shadow-sm col-span-1 lg:col-span-2 min-w-0'>
                           <h3 className='text-lg font-bold text-navy-900 mb-4 flex items-center gap-2'>
                              <PieChart className='w-5 h-5 text-navy-500' />
                              Meus Projetos (Distribuição de Tempo)
                           </h3>
                           <div className='h-64 relative min-w-0'>
                              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                 <RePieChart>
                                    <Pie
                                       data={(() => {
                                          const dataMap = allocations.reduce((acc, curr) => {
                                             if (userRole === 'CONSULTOR' && curr.consultantId !== currentUser?.id) return acc;
                                             
                                             const pName = projects.find(p => p.id === curr.projectId)?.name || 'Desconhecido';
                                             if (!acc[curr.projectId]) {
                                                 acc[curr.projectId] = { name: pName, value: 0 };
                                             }
                                             acc[curr.projectId].value += 1; // cada registro = 1 dia
                                             return acc;
                                          }, {} as Record<string, {name: string, value: number}>);
                                          
                                          return Object.values(dataMap);
                                       })()}
                                       dataKey="value"
                                       nameKey="name"
                                       cx="50%"
                                       cy="50%"
                                       outerRadius={80}
                                       label={({name, percent}) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    >
                                       {
                                          Object.values(allocations.reduce((acc, curr) => {
                                              if (userRole === 'CONSULTOR' && curr.consultantId !== currentUser?.id) return acc;
                                              const pName = projects.find(p => p.id === curr.projectId)?.name || 'Desconhecido';
                                              if (!acc[curr.projectId]) acc[curr.projectId] = { name: pName, value: 0 };
                                              acc[curr.projectId].value += 1; // cada registro = 1 dia
                                              return acc;
                                           }, {} as Record<string, {name: string, value: number}>)).map((_, index) => (
                                              <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'][index % 5]} />
                                          ))
                                       }
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                 </RePieChart>
                              </ResponsiveContainer>
                           </div>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* --- Drawer (Right Side Panel) --- */}
      {isDrawerOpen && selectedAllocation && (
        <div className='absolute inset-0 z-50 overflow-hidden'>
           <div className='absolute inset-0 bg-navy-900/20 backdrop-blur-[1px]' onClick={() => setIsDrawerOpen(false)} />
           <div className='absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col border-l border-navy-100 animate-in slide-in-from-right duration-300'>
              {/* Drawer Header */}
              <div className='px-6 py-4 border-b border-navy-100 flex items-start justify-between bg-navy-50/50'>
                 <div>
                    <h2 className='text-lg font-bold text-navy-900 flex items-center gap-2'>
                       <Briefcase className='w-4 h-4 text-primary-600' />
                       {selectedAllocation.proj?.name}
                    </h2>
                    <p className='text-sm text-navy-500 mt-1 flex items-center gap-2'>
                       <User className='w-3.5 h-3.5' />
                       {consultants.find(c => c.id === selectedAllocation.consultantId)?.name}
                    </p>
                 </div>
                 <button onClick={() => setIsDrawerOpen(false)} className='p-1 hover:bg-navy-100 rounded text-navy-400'>
                    <X className='w-5 h-5' />
                 </button>
              </div>

              {/* Drawer Content */}
              <div className='flex-1 overflow-y-auto p-6 space-y-6'>
                 
                 {/* Action Bar (Delete/Edit) */}
                 {userRole === 'ADM' && (
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => handleDeleteAllocation(selectedAllocation.id)}
                         className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                       >
                         Excluir Alocação
                       </button>
                    </div>
                 )}

                 {/* Edit Form (Simple inline for now) */}
                 {userRole === 'ADM' ? (
                    <div className='bg-white rounded-lg p-4 border border-navy-200 space-y-4 shadow-sm'>
                        <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wide mb-2">Editar Detalhes</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-semibold text-navy-500 block mb-1">Data</label>
                              <div className="w-full text-sm border border-navy-200 rounded-md py-1.5 px-2 bg-navy-50 text-navy-700 font-medium">
                                 {format(parseISO(selectedAllocation.date), 'dd/MM/yyyy')}
                              </div>
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-navy-500 block mb-1">OS</label>
                              <input 
                                 type="text" 
                                 className="w-full text-sm border-navy-300 rounded-md py-1.5 px-2"
                                 value={selectedAllocation.os || ''}
                                 onChange={(e) => handleUpdateAllocation(selectedAllocation.id, { os: e.target.value })}
                              />
                           </div>
                           <div className="col-span-2">
                              <label className="text-xs font-semibold text-navy-500 block mb-1">Gerente</label>
                              <select 
                                 className="w-full text-sm border-navy-300 rounded-md py-1.5 px-2"
                                 value={selectedAllocation.manager || ''}
                                 onChange={(e) => handleUpdateAllocation(selectedAllocation.id, { manager: e.target.value })}
                              >
                                 <option value="">Nenhum</option>
                                 {uniqueManagers.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                           </div>
                        </div>
                    </div>
                 ) : (
                 /* Info Block (Read Only for others) */
                 <div className='bg-primary-50 rounded-lg p-4 border border-primary-100 space-y-2'>
                    <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                       <CalendarDays className='w-4 h-4' />
                       Data: {format(parseISO(selectedAllocation.date), 'dd MMM yyyy', { locale: ptBR })}
                    </div>
                    {selectedAllocation.proj?.client && (
                        <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                            <Briefcase className='w-4 h-4' />
                            Cliente: {selectedAllocation.proj.client}
                        </div>
                    )}
                    {(selectedAllocation.os || selectedAllocation.proj?.os) && (
                        <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                            <FileText className='w-4 h-4' />
                            OS: {selectedAllocation.os || selectedAllocation.proj?.os}
                        </div>
                    )}
                    {(selectedAllocation.manager || selectedAllocation.proj?.manager) && (
                        <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                            <User className='w-4 h-4' />
                            Gerente: {(selectedAllocation.manager || selectedAllocation.proj?.manager) === 'gerente1' ? 'Gerente A' : (selectedAllocation.manager || selectedAllocation.proj?.manager) === 'gerente2' ? 'Gerente B' : (selectedAllocation.manager || selectedAllocation.proj?.manager)}
                        </div>
                    )}
                 </div>
                 )}

                 {/* Change Request Section (Consultant view) */}
                 {userRole !== 'ADM' && (
                   <div className='space-y-3'>
                     <h3 className='font-semibold text-navy-900 border-b border-navy-100 pb-2 flex items-center gap-2'>
                       <MessageSquarePlus className='w-4 h-4 text-navy-500' />
                       Solicitar Alteração
                     </h3>

                     {/* Previous requests for this allocation */}
                     {allocationRequests.length > 0 && (
                       <div className='space-y-2 mb-3'>
                         {allocationRequests.map(req => (
                           <div key={req.id} className={clsx(
                             'rounded-lg p-3 text-xs border',
                             req.status === 'pending' && 'bg-amber-50 border-amber-200 text-amber-800',
                             req.status === 'approved' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
                             req.status === 'rejected' && 'bg-red-50 border-red-200 text-red-800'
                           )}>
                             <div className='flex items-center justify-between mb-1'>
                               <span className='font-semibold capitalize'>
                                 {req.request_type === 'change' ? 'Alteração' : req.request_type === 'cancel' ? 'Cancelamento' : 'Reagendamento'}
                               </span>
                               <span className='font-bold uppercase text-[10px]'>
                                 {req.status === 'pending' ? '⏳ Pendente' : req.status === 'approved' ? '✅ Aprovada' : '❌ Recusada'}
                               </span>
                             </div>
                             <p className='text-navy-600'>{req.reason}</p>
                             {req.admin_response && (
                               <p className='mt-1 text-navy-500 italic'>Resposta: {req.admin_response}</p>
                             )}
                           </div>
                         ))}
                       </div>
                     )}

                     {!showChangeRequestForm ? (
                       <button
                         onClick={() => setShowChangeRequestForm(true)}
                         className='w-full py-2.5 px-4 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center justify-center gap-2'
                       >
                         <MessageSquarePlus className='w-4 h-4' />
                         Solicitar Mudança nesta Agenda
                       </button>
                     ) : (
                       <div className='bg-white rounded-lg p-4 border border-navy-200 space-y-3 shadow-sm'>
                         <div>
                           <label className='text-xs font-semibold text-navy-600 block mb-1'>Tipo de Solicitação</label>
                           <select
                             value={changeRequestType}
                             onChange={e => setChangeRequestType(e.target.value as any)}
                             className='w-full text-sm border border-navy-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-100 focus:border-primary-500'
                           >
                             <option value="change">Alterar detalhes</option>
                             <option value="reschedule">Reagendar datas</option>
                             <option value="cancel">Cancelar alocação</option>
                           </select>
                         </div>

                         {changeRequestType === 'reschedule' && (
                           <div className='grid grid-cols-2 gap-3'>
                             <div>
                               <label className='text-xs font-semibold text-navy-600 block mb-1'>Nova data</label>
                               <input
                                 type='date'
                                 value={changeRequestNewDate}
                                 onChange={e => setChangeRequestNewDate(e.target.value)}
                                 className='w-full text-sm border border-navy-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-100 focus:border-primary-500'
                               />
                             </div>
                             <div>
                               <label className='text-xs font-semibold text-navy-600 block mb-1'>Novos dias (opcional)</label>
                               <input
                                 type='number'
                                 min={1}
                                 placeholder="Nº de dias"
                                 value={changeRequestNewDays ?? ''}
                                 onChange={e => setChangeRequestNewDays(e.target.value ? parseInt(e.target.value) : null)}
                                 className='w-full text-sm border border-navy-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-100 focus:border-primary-500'
                               />
                             </div>
                           </div>
                         )}

                         <div>
                           <label className='text-xs font-semibold text-navy-600 block mb-1'>
                             Motivo da solicitação <span className='text-red-500'>*</span>
                           </label>
                           <textarea
                             value={changeRequestReason}
                             onChange={e => setChangeRequestReason(e.target.value)}
                             placeholder='Descreva o motivo da alteração...'
                             className='w-full text-sm border border-navy-200 rounded-lg p-3 focus:ring-2 focus:ring-primary-100 focus:border-primary-500 min-h-[80px] text-navy-700 placeholder:text-navy-300'
                           />
                         </div>

                         <div className='flex gap-2'>
                           <button
                             onClick={handleSubmitChangeRequest}
                             disabled={submittingRequest || !changeRequestReason.trim()}
                             className='flex-1 py-2 px-4 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50'
                           >
                             <Send className='w-3.5 h-3.5' />
                             {submittingRequest ? 'Enviando...' : 'Enviar Solicitação'}
                           </button>
                           <button
                             onClick={() => { setShowChangeRequestForm(false); setChangeRequestReason(''); }}
                             className='px-3 py-2 text-sm text-navy-500 hover:bg-navy-100 rounded-lg transition-colors'
                           >
                             Cancelar
                           </button>
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Admin: View requests for this allocation */}
                 {userRole === 'ADM' && allocationRequests.length > 0 && (
                   <div className='space-y-3'>
                     <h3 className='font-semibold text-navy-900 border-b border-navy-100 pb-2 flex items-center gap-2'>
                       <MessageSquarePlus className='w-4 h-4 text-amber-500' />
                       Solicitações ({allocationRequests.filter(r => r.status === 'pending').length} pendente{allocationRequests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''})
                     </h3>
                     {allocationRequests.map(req => (
                       <div key={req.id} className={clsx(
                         'rounded-lg p-3 text-xs border',
                         req.status === 'pending' && 'bg-amber-50 border-amber-200',
                         req.status === 'approved' && 'bg-emerald-50 border-emerald-200',
                         req.status === 'rejected' && 'bg-red-50 border-red-200'
                       )}>
                         <div className='flex items-center justify-between mb-1'>
                           <span className='font-bold text-navy-800 capitalize'>
                             {req.request_type === 'change' ? 'Alteração' : req.request_type === 'cancel' ? 'Cancelamento' : 'Reagendamento'}
                           </span>
                           <span className={clsx(
                             'font-bold uppercase text-[10px]',
                             req.status === 'pending' ? 'text-amber-600' : req.status === 'approved' ? 'text-emerald-600' : 'text-red-600'
                           )}>
                             {req.status === 'pending' ? '⏳ Pendente' : req.status === 'approved' ? '✅ Aprovada' : '❌ Recusada'}
                           </span>
                         </div>
                         <p className='text-navy-700 mb-1'>{req.reason}</p>
                         {req.suggested_start_date && (
                           <p className='text-navy-500 text-[11px]'>Sugestão: {format(parseISO(req.suggested_start_date), 'dd/MM/yyyy')}{req.suggested_days ? ` (${req.suggested_days} dias)` : ''}</p>
                         )}
                         <p className='text-navy-400 text-[10px] mt-1'>{format(parseISO(req.created_at), 'dd/MM/yyyy HH:mm')}</p>
                         
                         {req.status === 'pending' && (
                           <div className='mt-2 pt-2 border-t border-navy-200 space-y-2'>
                             <input
                               type='text'
                               placeholder='Resposta (opcional)...'
                               className='w-full text-xs border border-navy-200 rounded p-1.5'
                               onChange={e => setAdminResponse(e.target.value)}
                             />
                             <div className='flex gap-2'>
                               <button
                                 onClick={() => handleResolveRequest(req.id, 'approved')}
                                 className='flex-1 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded flex items-center justify-center gap-1 transition-colors'
                               >
                                 <CheckCheck className='w-3 h-3' /> Aprovar
                               </button>
                               <button
                                 onClick={() => handleResolveRequest(req.id, 'rejected')}
                                 className='flex-1 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded flex items-center justify-center gap-1 transition-colors'
                               >
                                 <XCircle className='w-3 h-3' /> Recusar
                               </button>
                             </div>
                           </div>
                         )}
                         {req.admin_response && req.status !== 'pending' && (
                           <p className='mt-1 text-navy-500 italic text-[11px]'>Resposta: {req.admin_response}</p>
                         )}
                       </div>
                     ))}
                   </div>
                 )}

                 {/* Daily Logs */}
                 <div className='space-y-4'>
                    <h3 className='font-semibold text-navy-900 border-b border-navy-100 pb-2 flex items-center gap-2'>
                       <FileText className='w-4 h-4 text-navy-500' />
                       Diário de Bordo
                    </h3>
                    
                    {loadingLogs ? (
                        <div className="flex justify-center p-8">
                            <Clock className="w-6 h-6 animate-spin text-navy-400" />
                        </div>
                    ) : (() => {
                        const dayDate = parseISO(selectedAllocation.date);
                        const dateStr = selectedAllocation.date;
                        const log = logs.find(l => l.date === dateStr);
                        const draftValue = logDrafts[dateStr] ?? log?.description ?? '';
                        const isToday = isSameDay(dayDate, new Date());
                        return (
                            <div className='group'>
                                <div className='flex items-center justify-between mb-1.5'>
                                    <span className={clsx(
                                    'text-xs font-semibold uppercase tracking-wider',
                                    isToday ? 'text-primary-600' : 'text-navy-500'
                                    )}>
                                    {format(dayDate, 'EEEE, dd MMM', { locale: ptBR })}
                                    </span>
                                    {log?.status === 'completed' && <CheckCircle2 className='w-3 h-3 text-green-500' />}
                                </div>
                                
                                <textarea 
                                    className='w-full text-sm border border-navy-200 rounded-lg p-3 focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all min-h-[80px] text-navy-700 placeholder:text-navy-300'
                                    placeholder={`Descreva as atividades realizadas em ${format(dayDate, 'dd/MM')}...`}
                                    value={draftValue}
                                    onChange={(e) => setLogDrafts(prev => ({ ...prev, [dateStr]: e.target.value }))}
                                    onBlur={(e) => handleSaveLog(dayDate, e.target.value)}
                                />
                                <div className='flex justify-end mt-2'>
                                  <button
                                    onClick={() => handleSaveLog(dayDate, draftValue)}
                                    className='px-3 py-1.5 text-xs font-medium rounded-md bg-navy-900 text-white hover:bg-navy-800'
                                  >
                                    Salvar
                                  </button>
                                </div>
                            </div>
                        );
                    })()}
                 </div>

              </div>
              <div className='p-4 border-t border-navy-100 bg-navy-50 flex justify-between items-center text-xs text-navy-400'>
                 <span>ID: {selectedAllocation.id}</span>
                 {loadingLogs && <span className='flex items-center gap-1'><Clock className='w-3 h-3 animate-spin' /> Salvando...</span>}
              </div>
           </div>
        </div>
      )}

      {/* --- Modal Solicitar Alteração / Nova Agenda (Consultant) --- */}
      {showSolicitacaoModal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 border border-navy-100 max-h-[90vh] flex flex-col'>
            {/* Header */}
            <div className='flex justify-between items-center p-6 border-b border-navy-100'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-amber-50 rounded-lg text-amber-600'>
                  <MessageSquarePlus className='w-6 h-6' />
                </div>
                <div>
                  <h3 className='text-xl font-bold text-navy-900'>Solicitações de Agenda</h3>
                  <p className='text-sm text-navy-500'>Será enviado ao administrador para aprovação.</p>
                </div>
              </div>
              <button onClick={() => setShowSolicitacaoModal(false)} className='p-1 text-navy-400 hover:bg-navy-50 rounded-lg'>
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Tabs */}
            <div className='flex border-b border-navy-100 px-6 pt-4 gap-1'>
              <button
                onClick={() => setSolicitacaoModalTab('alterar')}
                className={clsx(
                  'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors',
                  solicitacaoModalTab === 'alterar'
                    ? 'border-amber-500 text-amber-700 bg-amber-50'
                    : 'border-transparent text-navy-500 hover:text-navy-800'
                )}
              >
                ✏️ Alterar Agenda
              </button>
              <button
                onClick={() => setSolicitacaoModalTab('nova')}
                className={clsx(
                  'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors',
                  solicitacaoModalTab === 'nova'
                    ? 'border-primary-500 text-primary-700 bg-primary-50'
                    : 'border-transparent text-navy-500 hover:text-navy-800'
                )}
              >
                ➕ Nova Agenda
              </button>
            </div>

            {/* Content */}
            <div className='flex-1 overflow-y-auto p-6'>

              {/* ---- ABA: ALTERAR AGENDA ---- */}
              {solicitacaoModalTab === 'alterar' && (
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5 flex items-center gap-2'>
                      <CalendarDays className='w-4 h-4' /> Agenda / Alocação
                    </label>
                    {allocations.length === 0 ? (
                      <p className='text-sm text-navy-400 bg-navy-50 p-3 rounded-lg border border-navy-100'>
                        Você não possui alocações cadastradas no momento.
                      </p>
                    ) : (
                      <select
                        value={solicitacaoAllocId}
                        onChange={e => setSolicitacaoAllocId(e.target.value)}
                        className='w-full rounded-lg border border-navy-200 bg-white text-sm p-2.5 focus:ring-2 focus:ring-amber-100 focus:border-amber-400'
                      >
                        <option value=''>Selecione uma alocação...</option>
                        {allocations.map(a => {
                          const proj = projects.find(p => p.id === a.projectId);
                          return (
                            <option key={a.id} value={a.id}>
                              {proj?.name || 'Projeto'} — {format(parseISO(a.date), 'dd/MM/yyyy')}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Tipo de Solicitação</label>
                    <select
                      value={solicitacaoType}
                      onChange={e => setSolicitacaoType(e.target.value as any)}
                      className='w-full rounded-lg border border-navy-200 bg-white text-sm p-2.5 focus:ring-2 focus:ring-amber-100 focus:border-amber-400'
                    >
                      <option value='change'>Alterar detalhes</option>
                      <option value='reschedule'>Reagendar datas</option>
                      <option value='cancel'>Cancelar alocação</option>
                    </select>
                  </div>

                  {solicitacaoType === 'reschedule' && (
                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Nova data início</label>
                        <input
                          type='date'
                          value={solicitacaoNewDate}
                          onChange={e => setSolicitacaoNewDate(e.target.value)}
                          className='w-full rounded-lg border border-navy-200 text-sm p-2.5 focus:ring-2 focus:ring-amber-100 focus:border-amber-400'
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Dias (opcional)</label>
                        <input
                          type='number'
                          min={1}
                          placeholder='Qtd de dias'
                          value={solicitacaoNewDays ?? ''}
                          onChange={e => setSolicitacaoNewDays(e.target.value ? parseInt(e.target.value) : null)}
                          className='w-full rounded-lg border border-navy-200 text-sm p-2.5 focus:ring-2 focus:ring-amber-100 focus:border-amber-400'
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5'>
                      Motivo <span className='text-red-500'>*</span>
                    </label>
                    <textarea
                      value={solicitacaoReason}
                      onChange={e => setSolicitacaoReason(e.target.value)}
                      placeholder='Descreva o motivo da solicitação...'
                      rows={4}
                      className='w-full rounded-lg border border-navy-200 text-sm p-3 focus:ring-2 focus:ring-amber-100 focus:border-amber-400 text-navy-700 placeholder:text-navy-300'
                    />
                  </div>

                  <div className='flex justify-end gap-3 pt-2'>
                    <button
                      onClick={() => setShowSolicitacaoModal(false)}
                      className='px-4 py-2.5 border border-navy-200 text-navy-700 font-medium rounded-lg hover:bg-navy-50 transition-colors'
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitSolicitacao}
                      disabled={submittingSolicitacao || !solicitacaoAllocId || !solicitacaoReason.trim()}
                      className='flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50'
                    >
                      <Send className='w-4 h-4' />
                      {submittingSolicitacao ? 'Enviando...' : 'Enviar Solicitação'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---- ABA: NOVA AGENDA ---- */}
              {solicitacaoModalTab === 'nova' && (
                <div className='space-y-4'>
                  <div className='bg-primary-50 border border-primary-100 rounded-lg p-3 text-sm text-primary-700'>
                    Solicite a criação de uma nova agenda. O administrador irá analisar e criar a alocação.
                  </div>

                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5 flex items-center gap-2'>
                      <Briefcase className='w-4 h-4' /> Projeto / Cliente <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='text'
                      placeholder='Ex: UNIMED ARARAS, SC RIBEIRAO PRETO...'
                      value={novaAgendaProject}
                      onChange={e => setNovaAgendaProject(e.target.value)}
                      className='w-full rounded-lg border border-navy-200 text-sm p-2.5 focus:ring-2 focus:ring-primary-100 focus:border-primary-400'
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className='block text-sm font-semibold text-navy-700 mb-1.5 flex items-center gap-2'>
                        <CalendarDays className='w-4 h-4' /> Data de início <span className='text-red-500'>*</span>
                      </label>
                      <input
                        type='date'
                        value={novaAgendaStartDate}
                        onChange={e => setNovaAgendaStartDate(e.target.value)}
                        className='w-full rounded-lg border border-navy-200 text-sm p-2.5 focus:ring-2 focus:ring-primary-100 focus:border-primary-400'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Dias estimados</label>
                      <input
                        type='number'
                        min={1}
                        placeholder='Qtd de dias'
                        value={novaAgendaDays ?? ''}
                        onChange={e => setNovaAgendaDays(e.target.value ? parseInt(e.target.value) : null)}
                        className='w-full rounded-lg border border-navy-200 text-sm p-2.5 focus:ring-2 focus:ring-primary-100 focus:border-primary-400'
                      />
                    </div>
                  </div>

                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5'>
                      Observações / Detalhes <span className='text-red-500'>*</span>
                    </label>
                    <textarea
                      value={novaAgendaObs}
                      onChange={e => setNovaAgendaObs(e.target.value)}
                      placeholder='Descreva o escopo, motivo, OS, gerente responsável ou qualquer detalhe relevante...'
                      rows={4}
                      className='w-full rounded-lg border border-navy-200 text-sm p-3 focus:ring-2 focus:ring-primary-100 focus:border-primary-400 text-navy-700 placeholder:text-navy-300'
                    />
                  </div>

                  <div className='flex justify-end gap-3 pt-2'>
                    <button
                      onClick={() => setShowSolicitacaoModal(false)}
                      className='px-4 py-2.5 border border-navy-200 text-navy-700 font-medium rounded-lg hover:bg-navy-50 transition-colors'
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmitNovaAgenda}
                      disabled={submittingSolicitacao || !novaAgendaProject.trim() || !novaAgendaStartDate || !novaAgendaObs.trim()}
                      className='flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50'
                    >
                      <Send className='w-4 h-4' />
                      {submittingSolicitacao ? 'Enviando...' : 'Solicitar Nova Agenda'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- Modal Relatório --- */}
      {showReportModal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 animate-in zoom-in-95 duration-200 border border-navy-100 max-h-[90vh] flex flex-col'>
            <div className='flex justify-between items-center mb-6 border-b border-navy-50 pb-4 shrink-0'>
              <div className='flex items-center gap-3'>
                 <div className='p-2 bg-primary-50 rounded-lg text-primary-600'>
                   <ClipboardList className='w-6 h-6' />
                 </div>
                 <div>
                   <h3 className='text-xl font-bold text-navy-900'>Relatório de Diário de Bordo</h3>
                   <p className='text-sm text-navy-500'>Extraia os logs de atividades dos consultores.</p>
                 </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className='p-1 text-navy-400 hover:bg-navy-50 rounded-lg'>
                <X className='w-5 h-5' />
              </button>
            </div>
            
            {/* Filters */}
            <div className='bg-navy-50 p-4 rounded-lg flex flex-wrap gap-4 items-end mb-6 shrink-0 border border-navy-100'>
              <div>
                 <label className='block text-xs font-bold text-navy-600 uppercase tracking-wider mb-1'>Mês de Referência</label>
                 <input 
                   type='month'
                   className='rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2 bg-white'
                   value={reportMonth}
                   onChange={(e) => setReportMonth(e.target.value)}
                 />
              </div>
              <div className='min-w-[200px]'>
                 <label className='block text-xs font-bold text-navy-600 uppercase tracking-wider mb-1'>Consultor</label>
                 <select 
                     className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2 bg-white'
                     value={reportConsultant}
                     onChange={(e) => setReportConsultant(e.target.value)}
                 >
                    <option value="all">Todos os Consultores</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
              <button 
                onClick={handleGenerateReport}
                disabled={loadingReport}
                className='px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50'
              >
                {loadingReport ? <Clock className='w-4 h-4 animate-spin' /> : <Search className='w-4 h-4' />}
                Gerar Relatório
              </button>
            </div>

            {/* Results */}
            <div className='flex-1 overflow-y-auto min-h-[300px] border border-navy-200 rounded-lg bg-white relative'>
               {reportData ? (
                 reportData.length > 0 ? (
                   <div className='p-0'>
                      <table className='w-full text-left border-collapse'>
                        <thead className='bg-navy-50 sticky top-0 z-10 text-xs font-bold text-navy-500 uppercase tracking-wider'>
                           <tr>
                             <th className='p-3 border-b border-navy-200'>Data</th>
                             <th className='p-3 border-b border-navy-200'>Consultor</th>
                             <th className='p-3 border-b border-navy-200'>Projeto</th>
                             <th className='p-3 border-b border-navy-200 w-1/2'>Atividade Descrita</th>
                           </tr>
                        </thead>
                        <tbody className='divide-y divide-navy-100 text-sm'>
                           {reportData.map((row: any) => (
                             <tr key={row.id} className='hover:bg-navy-50/50'>
                                <td className='p-3 font-medium text-navy-900 whitespace-nowrap'>{format(parseISO(row.date), 'dd/MM/yyyy')}</td>
                                <td className='p-3 text-navy-700'>{row.consultantName}</td>
                                <td className='p-3'>
                                   <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100'>
                                     {row.projectName}
                                   </span>
                                </td>
                                <td className='p-3 text-navy-600 whitespace-pre-wrap'>{row.description || <span className='text-navy-300 italic'>Sem descrição</span>}</td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                 ) : (
                    <div className='flex flex-col items-center justify-center h-full text-navy-400'>
                       <ClipboardList className='w-12 h-12 mb-3 opacity-20' />
                       <p>Nenhum registro encontrado para este período.</p>
                    </div>
                 )
               ) : (
                  <div className='flex flex-col items-center justify-center h-full text-navy-400'>
                     <Search className='w-12 h-12 mb-3 opacity-20' />
                     <p>Selecione os filtros e clique em gerar.</p>
                  </div>
               )}
            </div>

            {/* Footer Actions */}
            {reportData && reportData.length > 0 && (
               <div className='mt-4 pt-4 border-t border-navy-50 flex justify-end gap-3 shrink-0'>
                  <button 
                    onClick={copyReportToClipboard}
                    className='flex items-center gap-2 px-4 py-2 border border-navy-200 hover:bg-navy-50 text-navy-700 font-medium rounded-lg transition-colors'
                  >
                    <Copy className='w-4 h-4' /> Copiar Texto
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className='flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg transition-colors'
                  >
                     Imprimir
                  </button>
               </div>
            )}
          </div>
        </div>
      )}

      {/* --- Modal Nova Agendamento --- */}
      {showModal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 duration-200 border border-navy-100 max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-6 border-b border-navy-50 pb-4'>
              <h3 className='text-xl font-bold text-navy-900'>Criar nova agenda de forma rápida</h3>
              <button onClick={() => setShowModal(false)} className='p-1 text-navy-400 hover:bg-navy-50 rounded-lg'>
                <X className='w-5 h-5' />
              </button>
            </div>
            
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>

              {/* Row 1: Consultor + Projeto (lado a lado) */}
              <div className='md:col-span-2 space-y-4 bg-navy-50/50 p-4 rounded-lg border border-navy-100'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* Consultor */}
                  <div>
                    <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-1.5'>
                      <User className='w-4 h-4' /> Consultor
                    </label>
                    <select
                      className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm p-2.5 border bg-white'
                      value={newAlloc.consultantId}
                      onChange={(e) => setNewAlloc({...newAlloc, consultantId: e.target.value})}
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="new" className="font-semibold text-primary-600">✨ Novo consultor...</option>
                      <option disabled>──────────</option>
                      {consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Projeto — ao selecionar, Gerente é preenchido automaticamente */}
                  <div>
                    <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-1.5'>
                      <Briefcase className='w-4 h-4' /> Projeto
                    </label>
                    <select
                      className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm p-2.5 border bg-white'
                      value={newAlloc.projectId}
                      onChange={(e) => {
                        const sel = projects.find(p => p.id === e.target.value);
                        setNewAlloc({...newAlloc, projectId: e.target.value, manager: sel?.manager || ''});
                      }}
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="new" className="font-semibold text-primary-600">✨ Novo projeto...</option>
                      <option disabled>──────────</option>
                      {projects.filter(p => p.id !== 'free').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Campos expandidos: nome novo de consultor e/ou projeto */}
                {(newAlloc.consultantId === 'new' || newAlloc.projectId === 'new') && (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {newAlloc.consultantId === 'new' && (
                      <div>
                        <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Nome do Consultor</label>
                        <input
                          type='text'
                          autoFocus
                          placeholder='Digite o nome...'
                          className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                          value={newAlloc.newConsultantName}
                          onChange={(e) => setNewAlloc({...newAlloc, newConsultantName: e.target.value})}
                        />
                      </div>
                    )}
                    {newAlloc.projectId === 'new' && (
                      <div>
                        <label className='block text-sm font-semibold text-navy-700 mb-1.5'>Nome do Projeto</label>
                        <input
                          type='text'
                          placeholder='Digite o projeto...'
                          className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                          value={newAlloc.newProjectName}
                          onChange={(e) => setNewAlloc({...newAlloc, newProjectName: e.target.value})}
                        />
                        <div className="mt-3 flex items-center">
                          <input
                            type="checkbox"
                            id="isPrivate"
                            className="rounded border-navy-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                            checked={newAlloc.isPrivate}
                            onChange={(e) => setNewAlloc({...newAlloc, isPrivate: e.target.checked})}
                          />
                          <label htmlFor="isPrivate" className="ml-2 text-sm text-navy-600 flex items-center gap-1 cursor-pointer font-medium">
                            Projeto Particular
                            <span className="text-xs text-navy-400 font-normal ml-0.5">(Visível apenas para ADMs e Envolvidos)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OS + Gerente (Gerente preenchido automaticamente pelo Projeto) */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5'>OS (opcional)</label>
                    <input
                      type='text'
                      placeholder='Número da OS'
                      className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                      value={newAlloc.os}
                      onChange={(e) => setNewAlloc({...newAlloc, os: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-navy-700 mb-1.5 flex items-center gap-1.5'>
                      Gerente
                      {newAlloc.manager && newAlloc.projectId && newAlloc.projectId !== 'new' && (
                        <span className='text-[10px] font-normal text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full'>auto</span>
                      )}
                    </label>
                    <input
                      type='text'
                      placeholder='Preenchido automaticamente pelo projeto...'
                      className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                      value={newAlloc.manager}
                      onChange={(e) => setNewAlloc({...newAlloc, manager: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Dates Block */}
              <div>
                <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-1.5'>
                  <CalendarDays className='w-4 h-4' /> Data Início
                </label>
                <input
                  type='date'
                  className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                  value={newAlloc.startDate}
                  onChange={(e) => setNewAlloc({...newAlloc, startDate: e.target.value})}
                />
              </div>

              <div>
                <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-1.5'>
                  <CalendarDays className='w-4 h-4' /> Data Fim
                </label>
                <input
                  type='date'
                  className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                  value={newAlloc.endDate}
                  onChange={(e) => setNewAlloc({...newAlloc, endDate: e.target.value})}
                />
              </div>

            </div>

             <div className='pt-6 mt-6 flex justify-end gap-3 border-t border-navy-50'>
              <button 
                onClick={() => setShowModal(false)}
                className='px-4 py-2.5 border border-navy-300 text-navy-700 font-medium rounded-lg hover:bg-navy-50 transition-colors'
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddAllocation}
                className='flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary-900/20'
              >
                <Save className='w-4 h-4' /> Criar Agenda
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
