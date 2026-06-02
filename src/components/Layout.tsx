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
  History,
  FileSpreadsheet,
  Bell
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
      if (!session) { navigate('/login'); return; }
      if (session.user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single();
        if (data) {
          setUserProfile({ name: data.full_name, role: data.role });
        } else {
          setUserProfile({ name: session.user.email?.split('@')[0] || 'Usuário', role: 'Convidado' });
        }
      }
    }
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) navigate('/login');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { to: '/schedule',  icon: Calendar,         label: 'Agendas & Alocação' },
    { to: '/consultants', icon: Users,           label: 'Consultores' },
    { to: '/projects',  icon: Briefcase,         label: 'Projetos' },
    ...(userProfile.role === 'ADM' || userProfile.role === 'GERENTE'
      ? [{ to: '/requests', icon: History, label: 'Solicitações' }]
      : []),
    ...(userProfile.role === 'ADM' ? [{ to: '/reports', icon: FileText, label: 'Relatórios' }] : []),
    ...(userProfile.role === 'ADM' ? [{ to: '/import',  icon: FileSpreadsheet, label: 'Conferência Excel' }] : []),
    { to: '/config', icon: Settings, label: 'Configurações' },
  ];

  const initials = userProfile.name
    ? userProfile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <div className='flex h-screen overflow-hidden bg-navy-50'>

      {/* ── Sidebar (dark) ── */}
      <aside
        className={clsx(
          'relative flex flex-col transition-all duration-300 ease-in-out z-20 flex-shrink-0',
          'bg-navy-900 border-r border-navy-800',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
        style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.08)' }}
      >
        {/* Logo strip */}
        <div className='flex items-center h-14 px-4 border-b border-navy-800 shrink-0'>
          {/* Icon */}
          <div className='w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0'>
            <Calendar className='w-4 h-4 text-white' />
          </div>

          {!collapsed && (
            <div className='ml-3 overflow-hidden'>
              <span className='text-white font-bold text-base tracking-tight leading-none'>
                Agendas
              </span>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={clsx(
              'ml-auto p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200',
              collapsed && 'mx-auto'
            )}
          >
            <ChevronLeft className={clsx('w-4 h-4 transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Nav */}
        <nav className='flex-1 p-3 space-y-0.5 overflow-y-auto custom-scrollbar'>
          {!collapsed && (
            <p className='text-[10px] font-bold uppercase tracking-widest text-white/25 px-3 py-2 mb-1'>
              Menu
            </p>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center',
                isActive
                  ? 'bg-white/12 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/7'
              )}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx(
                    'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                    isActive ? 'text-primary-400' : 'text-white/40 group-hover:text-white/70'
                  )} />
                  {!collapsed && (
                    <span className='truncate'>{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <span className='ml-auto w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0' />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className='p-3 border-t border-navy-800 shrink-0'>
          {!collapsed ? (
            <div className='flex items-center gap-3 p-2 rounded-xl hover:bg-white/7 transition-colors group cursor-default'>
              <div className='w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0'>
                {initials}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-semibold text-white truncate leading-none mb-0.5'>
                  {userProfile.name || 'Carregando...'}
                </div>
                <div className='text-[11px] text-white/40 truncate'>
                  {userProfile.role || '...'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title='Sair'
                className='p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0'
              >
                <LogOut className='w-3.5 h-3.5' />
              </button>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-2'>
              <div className='w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold'>
                {initials}
              </div>
              <button
                onClick={handleLogout}
                className='p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all'
              >
                <LogOut className='w-3.5 h-3.5' />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className='flex-1 flex flex-col min-w-0 overflow-hidden'>

        {/* Topbar */}
        <header className='h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white border-b border-navy-100'>
          {/* Search */}
          <div className='relative flex-1 max-w-md group'>
            <Search className='w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 group-focus-within:text-primary-500 transition-colors' />
            <input
              type='text'
              placeholder='Buscar consultores, projetos, OS...'
              className='w-full h-9 pl-9 pr-4 bg-navy-50 border border-navy-100 rounded-xl text-sm text-navy-900 placeholder-navy-400 outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all'
            />
            <kbd className='hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 bg-white border border-navy-200 rounded text-[10px] text-navy-400 font-sans'>
              ⌘K
            </kbd>
          </div>

          {/* Right actions */}
          <div className='flex items-center gap-2 ml-4'>
            <button className='relative p-2 rounded-xl text-navy-500 hover:bg-navy-100 hover:text-navy-900 transition-all'>
              <Bell className='w-4 h-4' />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className='flex-1 overflow-auto custom-scrollbar'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
