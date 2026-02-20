import { 
  Calendar, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  ChevronLeft,
  Search,
  Users,
  Briefcase,
  FileText,
  History
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function Layout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '', role: '' });

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      if (session.user) {
        const { data } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
        if (data) {
          setUserProfile({
            name: data.full_name,
            role: data.role
          });
        } else {
           // Fallback
           setUserProfile({ name: session.user.email?.split('@')[0] || 'Usuário', role: 'Convidado' });
        }
      }
    }
    loadUser();

    // Listen for auth changes (like sign out from other tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            navigate('/login');
        }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { to: '/schedule', icon: Calendar, label: 'Agendas & Alocação' },
    { to: '/consultants', icon: Users, label: 'Consultores' },
    { to: '/projects', icon: Briefcase, label: 'Projetos' },
    // Histórico de solicitações visivel para ADM e GERENTE
    ...(userProfile.role === 'ADM' || userProfile.role === 'GERENTE'
      ? [{ to: '/requests', icon: History, label: 'Solicitações' }]
      : []),
    // Relatórios apenas para ADM
    ...(userProfile.role === 'ADM' ? [{ to: '/reports', icon: FileText, label: 'Relatórios' }] : []),
    { to: '/config', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className='flex h-screen bg-navy-50 overflow-hidden'>
      {/* Sidebar */}
      <aside 
        className={clsx(
          'bg-white border-r border-navy-100 flex flex-col transition-all duration-300 z-20 shadow-sm',
          collapsed ? 'w-20' : 'w-72'
        )}
      >
        <div className='h-16 flex items-center px-6 border-b border-navy-50 justify-between'>
          {!collapsed && (
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary-500/30'>
                <Calendar className='w-5 h-5' />
              </div>
              <span className='text-lg font-bold text-navy-900 tracking-tight'>Agendas<span className='text-primary-600'>Ativa</span></span>
            </div>
          )}
          {collapsed && (
            <div className='w-full flex justify-center'>
               <div className='w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white'>
                <Calendar className='w-4 h-4' />
              </div>
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className='p-1.5 rounded-lg hover:bg-navy-50 text-navy-400 hover:text-navy-900 transition-colors'
          >
            <ChevronLeft className={clsx('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className='flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar'>
          {navItems.map((item) => (
             <NavLink
               key={item.to}
               to={item.to}
               className={({ isActive }) => clsx(
                 'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group',
                 isActive 
                   ? 'bg-primary-50 text-primary-700 shadow-sm' 
                   : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
               )}
             >
               <item.icon className={clsx(
                 'w-5 h-5 transition-colors',
                 collapsed ? 'mx-auto' : 'mr-3',
                 'group-hover:scale-110'
               )} />
               {!collapsed && <span>{item.label}</span>}
             </NavLink>
          ))}
        </nav>

        <div className='p-4 border-t border-navy-50'>
          {!collapsed ? (
            <div className='flex items-center justify-between bg-navy-50/50 p-3 rounded-xl border border-navy-100'>
              <div className='flex items-center gap-3 overflow-hidden'>
                <div className='w-9 h-9 rounded-full bg-white border border-navy-200 flex items-center justify-center text-navy-700 font-bold shadow-sm flex-shrink-0'>
                  {userProfile.name ? userProfile.name.substring(0,2).toUpperCase() : 'U'}
                </div>
                <div className='min-w-0'>
                  <div className='text-sm font-bold text-navy-900 truncate'>{userProfile.name || 'Carregando...'}</div>
                  <div className='text-xs text-navy-500 truncate'>{userProfile.role || '...'}</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className='p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-navy-400 hover:text-red-500 transition-all'
                title='Sair'
              >
                <LogOut className='w-4 h-4' />
              </button>
            </div>
          ) : (
             <div className='flex justify-center'>
               <button 
                onClick={handleLogout}
                className='p-2 rounded-lg hover:bg-white text-navy-400 hover:text-red-500 transition-all'
              >
                <LogOut className='w-5 h-5' />
              </button>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className='flex-1 flex flex-col min-w-0'>
        {/* Header */}
        <header className='h-16 bg-white border-b border-navy-100 flex items-center justify-between px-8 shadow-sm'>
           <div className='flex items-center flex-1 max-w-xl'>
             <div className='relative w-full group'>
               <Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 group-focus-within:text-primary-500 transition-colors' />
               <input 
                type='text' 
                placeholder='Buscar consultores, projetos ou OS...' 
                className='w-full pl-10 pr-4 py-2 bg-navy-50 border-none rounded-lg text-sm text-navy-900 focus:ring-2 focus:ring-primary-100 transition-all'
               />
               <div className='absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1'>
                 <kbd className='hidden sm:inline-block px-1.5 py-0.5 bg-white border border-navy-200 rounded text-[10px] font-sans font-medium text-navy-400'>CTRL K</kbd>
               </div>
             </div>
           </div>

           <div className='flex items-center gap-4'>
             {/* Removed status indicator and logout button as requested */}
           </div>
        </header>

        {/* Viewport */}
        <div className='flex-1 overflow-auto bg-navy-50 custom-scrollbar'>
           <Outlet />
        </div>
      </main>
    </div>
  );
}
