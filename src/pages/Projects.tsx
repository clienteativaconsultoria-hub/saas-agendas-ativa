import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Briefcase,
  User,
  FileText,
  X,
  Save
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

type ProjectTipo = 'Particular' | 'MV';

const PARTICULARES = ['UNIMED ARARAS', 'ESSELENSE', 'SC RIBEIRAO PRETO'];

const normalizeClient = (client: string): string => {
  const upper = (client || '').toUpperCase().trim();
  if (upper === 'ARARAS') return 'UNIMED ARARAS';
  if (upper === 'UNIMED ARARAS / ESSELENSE' || upper === 'ESSELENSE / UNIMED ARARAS') return 'ESSELENSE';
  if (upper === 'UNIMED ARARAS / SC RIBEIRAO PRETO' || upper === 'SC RIBEIRAO PRETO / UNIMED ARARAS') return 'SC RIBEIRAO PRETO';
  return client.trim();
};

const getProjectTipo = (client: string): ProjectTipo => {
  const normalized = normalizeClient(client).toUpperCase().trim();
  return PARTICULARES.some(p => normalized === p) ? 'Particular' : 'MV';
};

type Project = {
  id: string;
  name: string;
  client: string;
  color: string;
  status: string;
  deadline: string;
  progress: number;
  os?: string;
  manager?: string;
  is_private?: boolean;
  tipo: ProjectTipo;
};
type Allocation = {
  id: string;
  consultantId: string;
  projectId: string;
  date: string;
  os?: string;
  manager?: string;
};
type DailyLog = { id: string; allocation_id: string; date: string; description: string; status: 'pending' | 'completed' };
type Consultant = { id: string; name: string };

export function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'Particular' | 'MV'>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [projectAllocations, setProjectAllocations] = useState<Allocation[]>([]);
  const [projectLogs, setProjectLogs] = useState<DailyLog[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    manager: '',
    status: 'Em Andamento',
    deadline: '',
    progress: 0,
    color: 'bg-primary-100 text-primary-700 border-primary-200',
    is_private: false
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const formatDeadline = (value: any) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return format(parsed, 'dd/MM/yyyy');
  };

  const mapProjectRow = (p: any): Project => {
    const rawClient = p.client ?? p.client_name ?? 'Não informado';
    const client = normalizeClient(rawClient);
    return {
      id: p.id,
      name: p.name,
      client,
      color: p.color || 'bg-navy-100 text-navy-700 border-navy-200',
      status: p.status || 'Em Planejamento',
      deadline: formatDeadline(p.deadline),
      progress: p.progress || 0,
      os: p.os,
      manager: p.manager,
      is_private: p.is_private,
      tipo: getProjectTipo(client)
    };
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      if (data) {
        setProjects(data.map(mapProjectRow));
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      if (!newProject.name) return alert('Nome do projeto é obrigatório');

      const normalizedClient = normalizeClient(newProject.client);
      const basePayload = {
        name: newProject.name,
        manager: newProject.manager || null,
        status: newProject.status,
        deadline: newProject.deadline || null,
        progress: newProject.progress,
        color: newProject.color,
        is_private: newProject.is_private,
        tipo: getProjectTipo(normalizedClient)
      };

      const tryInsert = async (clientField: 'client' | 'client_name') => {
        return supabase.from('projects').insert({
          ...basePayload,
          [clientField]: normalizedClient
        }).select().single();
      };

      let insertResult = await tryInsert('client');
      if (insertResult.error && String(insertResult.error.message || '').includes('client')) {
        insertResult = await tryInsert('client_name');
      }

      if (insertResult.error) throw insertResult.error;

      if (insertResult.data) {
        setProjects(prev => [mapProjectRow(insertResult.data), ...prev]);
        setShowModal(false);
        setNewProject({
            name: '',
            client: '',
            manager: '',
            status: 'Em Andamento',
            deadline: '',
            progress: 0,
            color: 'bg-primary-100 text-primary-700 border-primary-200',
            is_private: false
        });
      }
    } catch (error) {
       console.error(error);
       alert('Erro ao criar projeto');
    }
  };

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = activeTab === 'all' ? true
      : activeTab === 'active' ? p.status === 'Em Andamento' || p.status === 'Crítico' || p.status === 'Em Planejamento'
      : activeTab === 'archived' ? p.status === 'Concluído'
      : true;
    const matchTipo = tipoFilter === 'all' ? true : p.tipo === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  });

  const handleOpenProjectDetails = async (project: Project) => {
    setSelectedProject(project);
    setIsDrawerOpen(true);
    setLoadingDetails(true);
    setProjectAllocations([]);
    setProjectLogs([]);
    setConsultants([]);

    try {
      const { data: allocData, error: allocError } = await supabase
        .from('allocations')
        .select('*')
        .eq('project_id', project.id);

      if (allocError) throw allocError;

      const allocations = (allocData || []).map((a: any) => ({
        id: a.id,
        consultantId: a.consultant_id,
        projectId: a.project_id,
        date: a.date,
        os: a.os,
        manager: a.manager
      }));

      setProjectAllocations(allocations);

      const consultantIds = Array.from(new Set(allocations.map(a => a.consultantId)));
      if (consultantIds.length > 0) {
        const { data: consData, error: consError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', consultantIds);

        if (consError) throw consError;
        setConsultants((consData || []).map((c: any) => ({ id: c.id, name: c.full_name })));
      }

      const allocationIds = allocations.map(a => a.id);
      if (allocationIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('project_daily_logs')
          .select('*')
          .in('allocation_id', allocationIds);

        if (logsError) throw logsError;
        setProjectLogs((logsData || []) as DailyLog[]);
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getConsultantName = (id: string) => {
    return consultants.find(c => c.id === id)?.name || 'Consultor não informado';
  };

  return (
    <div className='space-y-6 p-8'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-navy-900'>Projetos e Clientes</h1>
          <p className='text-navy-500'>Acompanhe o status e progresso de todos os projetos ativos.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className='flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-colors'
        >
          <Plus className='w-4 h-4' /> Novo Projeto
        </button>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        {[
          { label: 'Projetos Ativos', value: projects.filter(p => p.status === 'Em Andamento').length, icon: Briefcase, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Tipo Particular', value: projects.filter(p => p.tipo === 'Particular').length, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Tipo MV', value: projects.filter(p => p.tipo === 'MV').length, icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Clientes Únicos', value: new Set(projects.map(p => p.client).filter(c => c !== 'Não informado')).size, icon: Building2, color: 'text-navy-600', bg: 'bg-navy-50' },
        ].map((stat, idx) => (
          <div key={idx} className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm flex items-center justify-between'>
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

      <div className='bg-white rounded-xl border border-navy-100 shadow-sm overflow-hidden'>
        {/* Table Header / Toolbar */}
        <div className='p-4 border-b border-navy-100 flex flex-col sm:flex-row items-center justify-between gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex items-center gap-1 bg-navy-50 rounded-lg p-1 border border-navy-100'>
                {['active', 'archived', 'all'].map(tab => (
                   <button 
                     key={tab}
                     onClick={() => setActiveTab(tab)}
                     className={clsx(
                       'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                       activeTab === tab ? 'bg-white shadow-sm text-navy-900' : 'text-navy-500 hover:text-navy-900'
                     )}
                   >
                     {tab === 'active' ? 'Ativos' : tab === 'archived' ? 'Arquivados' : 'Todos'}
                   </button>
                ))}
              </div>
              {/* Tipo Filter */}
              <div className='flex items-center gap-1 bg-navy-50 rounded-lg p-1 border border-navy-100'>
                {(['all', 'Particular', 'MV'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTipoFilter(t)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                      tipoFilter === t
                        ? t === 'Particular'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : t === 'MV'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white shadow-sm text-navy-900'
                        : 'text-navy-500 hover:text-navy-900'
                    )}
                  >
                    {t === 'all' ? 'Todos tipos' : t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className='relative w-full sm:w-64'>
              <Search className='w-4 h-4 absolute left-3 top-2.5 text-navy-400' />
              <input 
                type='text' 
                placeholder='Buscar projeto...' 
                className='w-full pl-9 pr-3 py-2 bg-navy-50 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>

        {/* Projects List */}
        <div className='overflow-x-auto'>
           <table className='w-full text-left text-sm'>
             <thead className='bg-navy-50/50 border-b border-navy-100 text-xs uppercase text-navy-500 font-semibold'>
               <tr>
                 <th className='px-6 py-4'>Projeto</th>
                 <th className='px-6 py-4'>Tipo</th>
                 <th className='px-6 py-4'>Gerente</th>
                 <th className='px-6 py-4'>Status</th>
                 <th className='px-6 py-4'>Prazo</th>
                 <th className='px-6 py-4'>Progresso</th>
                 <th className='px-6 py-4 text-right'>Ações</th>
               </tr>
             </thead>
             <tbody className='divide-y divide-navy-50'>
               {filtered.length > 0 ? filtered.map((project) => (
                 <tr key={project.id} className='hover:bg-navy-50/30 transition-colors'>
                   <td className='px-6 py-4 font-medium text-navy-900'>
                     <div className='flex items-center gap-3'>
                       <div className={`w-3 h-3 rounded-full ${project.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                       {project.name}
                     </div>
                   </td>
                   <td className='px-6 py-4'>
                     <span className={clsx(
                       'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border',
                       project.tipo === 'Particular'
                         ? 'bg-amber-50 text-amber-700 border-amber-200'
                         : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                     )}>
                       {project.tipo}
                     </span>
                   </td>
                   <td className='px-6 py-4 text-navy-600'>
                     <div className='flex items-center gap-2'>
                        <User className='w-3.5 h-3.5 text-navy-400' />
                        {project.manager || '-'}
                     </div>
                   </td>
                   <td className='px-6 py-4'>
                      <span className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium border',
                        project.status === 'Em Andamento' ? 'bg-primary-50 text-primary-700 border-primary-100' :
                        project.status === 'Crítico' ? 'bg-red-50 text-red-700 border-red-100' :
                        project.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-navy-50 text-navy-700 border-navy-100'
                      )}>
                        {project.status}
                      </span>
                   </td>
                   <td className='px-6 py-4 text-navy-600'>
                      <div className='flex items-center gap-2'>
                        <CalendarDays className='w-3.5 h-3.5 text-navy-400' />
                        {project.deadline}
                      </div>
                   </td>
                   <td className='px-6 py-4'>
                      <div className='flex items-center gap-2 max-w-[100px]'>
                        <div className='flex-1 h-1.5 bg-navy-100 rounded-full overflow-hidden'>
                          <div className='h-full bg-primary-600 rounded-full' style={{ width: `${project.progress}%` }}></div>
                        </div>
                        <span className='text-xs text-navy-500 font-medium'>{project.progress}%</span>
                      </div>
                   </td>
                   <td className='px-6 py-4 text-right'>
                      <button
                        onClick={() => handleOpenProjectDetails(project)}
                        className='p-1.5 hover:bg-navy-100 rounded-lg text-navy-400 hover:text-navy-600 transition-colors'
                      >
                        <MoreVertical className='w-4 h-4' />
                      </button>
                   </td>
                 </tr>
               )) : (
                  <tr>
                    <td colSpan={7} className='p-12 text-center text-navy-400'>
                      Nenhum projeto encontrado.
                    </td>
                  </tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

       {/* Modal Novo Projeto */}
       {showModal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 border border-navy-100'>
            <div className='flex justify-between items-center mb-6 border-b border-navy-50 pb-4'>
              <h3 className='text-xl font-bold text-navy-900'>Novo Projeto</h3>
              <button onClick={() => setShowModal(false)} className='p-1 text-navy-400 hover:bg-navy-50 rounded-lg'>
                <X className='w-5 h-5' />
              </button>
            </div>
            
            <div className='space-y-4'>
               <div>
                  <label className='block text-sm font-medium text-navy-700 mb-1'>Nome do Projeto</label>
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  />
               </div>
               <div>
                  <label className='block text-sm font-medium text-navy-700 mb-1 flex items-center gap-2'>
                    Cliente
                    {newProject.client && (
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border',
                        getProjectTipo(newProject.client) === 'Particular'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      )}>
                        {getProjectTipo(newProject.client)}
                      </span>
                    )}
                  </label>
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                    placeholder='Ex: UNIMED ARARAS, ESSELENSE, SC RIBEIRAO PRETO...'
                    value={newProject.client}
                    onChange={(e) => setNewProject({...newProject, client: e.target.value})}
                  />
                  <p className='mt-1 text-xs text-navy-400'>
                    Particular: UNIMED ARARAS · ESSELENSE · SC RIBEIRAO PRETO
                  </p>
               </div>
               <div>
                  <label className='block text-sm font-medium text-navy-700 mb-1'>Gerente</label>
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                    placeholder='Nome do gerente responsável'
                    value={newProject.manager}
                    onChange={(e) => setNewProject({...newProject, manager: e.target.value})}
                  />
               </div>
               <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-navy-700 mb-1'>Status</label>
                    <select
                        className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border bg-white'
                        value={newProject.status}
                        onChange={(e) => setNewProject({...newProject, status: e.target.value})}
                    >
                        <option value="Em Planejamento">Em Planejamento</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Concluído">Concluído</option>
                        <option value="Crítico">Crítico</option>
                    </select>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-navy-700 mb-1'>Prazo</label>
                    <input 
                        type='date' 
                        className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                        value={newProject.deadline}
                        onChange={(e) => setNewProject({...newProject, deadline: e.target.value})}
                    />
                  </div>
               </div>
               <div>
                  <label className='block text-sm font-medium text-navy-700 mb-1'>Progresso (%)</label>
                  <input 
                    type='number' 
                    min="0"
                    max="100"
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border'
                    value={newProject.progress}
                    onChange={(e) => setNewProject({...newProject, progress: parseInt(e.target.value)})}
                  />
               </div>

               <div className='flex items-center gap-2 pt-2'>
                  <input 
                    type='checkbox' 
                    id='is_private'
                    className='w-4 h-4 rounded border-navy-300 text-navy-900 focus:ring-navy-900'
                    checked={newProject.is_private}
                    onChange={(e) => setNewProject({...newProject, is_private: e.target.checked})}
                  />
                  <label htmlFor='is_private' className='text-sm font-medium text-navy-700 select-none cursor-pointer'>
                    Projeto Particular / Confidencial
                  </label>
                  <span className='text-xs text-navy-400'>(Visível apenas para ADM)</span>
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
                onClick={handleCreateProject}
                className='flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary-900/20'
              >
                <Save className='w-4 h-4' /> Salvar Projeto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Detalhes do Projeto */}
      {isDrawerOpen && selectedProject && (
        <div className='fixed inset-0 z-50 overflow-hidden'>
          <div className='absolute inset-0 bg-navy-900/20 backdrop-blur-[1px]' onClick={() => setIsDrawerOpen(false)} />
          <div className='absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col border-l border-navy-100 animate-in slide-in-from-right duration-300'>
            <div className='px-6 py-4 border-b border-navy-100 flex items-start justify-between bg-navy-50/50'>
              <div>
                <h2 className='text-lg font-bold text-navy-900 flex items-center gap-2'>
                  <Briefcase className='w-4 h-4 text-primary-600' />
                  {selectedProject.name}
                </h2>
                <p className='text-sm text-navy-500 mt-1 flex items-center gap-2'>
                  <Building2 className='w-3.5 h-3.5' />
                  {selectedProject.client}
                </p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className='p-1 hover:bg-navy-100 rounded text-navy-400'>
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-6 space-y-6'>
              <div className='bg-primary-50 rounded-lg p-4 border border-primary-100 space-y-2'>
                <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                  <Building2 className='w-4 h-4' />
                  Tipo:
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ml-1',
                    selectedProject.tipo === 'Particular'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  )}>
                    {selectedProject.tipo}
                  </span>
                </div>
                <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                  <CheckCircle2 className='w-4 h-4' />
                  Status: {selectedProject.status}
                </div>
                <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                  <CalendarDays className='w-4 h-4' />
                  Prazo: {selectedProject.deadline}
                </div>
                <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                  <Clock className='w-4 h-4' />
                  Progresso: {selectedProject.progress}%
                </div>
                {selectedProject.os && (
                  <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                    <FileText className='w-4 h-4' />
                    OS: {selectedProject.os}
                  </div>
                )}
                {selectedProject.manager && (
                  <div className='flex items-center gap-3 text-primary-800 font-medium text-sm'>
                    <User className='w-4 h-4' />
                    Gerente: {selectedProject.manager}
                  </div>
                )}
              </div>

              <div className='space-y-4'>
                <h3 className='font-semibold text-navy-900 border-b border-navy-100 pb-2 flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-navy-500' />
                  Diário de Bordo
                </h3>

                {loadingDetails ? (
                  <div className='flex justify-center p-8'>
                    <Clock className='w-6 h-6 animate-spin text-navy-400' />
                  </div>
                ) : (
                  <div className='space-y-4'>
                    {projectAllocations.length === 0 ? (
                      <div className='text-sm text-navy-400'>Nenhuma alocação encontrada para este projeto.</div>
                    ) : (
                      projectAllocations.map((alloc) => {
                        const logs = projectLogs
                          .filter(l => l.allocation_id === alloc.id)
                          .sort((a, b) => a.date.localeCompare(b.date));

                        return (
                          <div key={alloc.id} className='rounded-lg border border-navy-100 bg-white p-4 space-y-3'>
                            <div className='flex items-start justify-between gap-4'>
                              <div>
                                <p className='text-sm font-semibold text-navy-900 flex items-center gap-2'>
                                  <User className='w-3.5 h-3.5 text-navy-400' />
                                  {getConsultantName(alloc.consultantId)}
                                </p>
                                <p className='text-xs text-navy-500 mt-1 flex items-center gap-2'>
                                  <CalendarDays className='w-3.5 h-3.5' />
                                  {format(parseISO(alloc.date), 'dd/MM/yyyy')}
                                </p>
                              </div>
                              {alloc.os && (
                                <span className='text-xs font-medium text-navy-600 bg-navy-50 border border-navy-100 rounded-full px-2 py-0.5'>
                                  OS {alloc.os}
                                </span>
                              )}
                            </div>

                            {logs.length === 0 ? (
                              <div className='text-xs text-navy-400'>Sem registros no diário de bordo.</div>
                            ) : (
                              <div className='space-y-2'>
                                {logs.map(log => (
                                  <div key={log.id} className='text-sm text-navy-700 border-l-2 border-primary-200 pl-3'>
                                    <div className='flex items-center gap-2 text-xs text-navy-500 mb-1'>
                                      <CalendarDays className='w-3 h-3' />
                                      {format(parseISO(log.date), 'dd/MM/yyyy')}
                                      {log.status === 'completed' && <CheckCircle2 className='w-3 h-3 text-green-500' />}
                                    </div>
                                    {log.description || 'Sem descrição.'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

