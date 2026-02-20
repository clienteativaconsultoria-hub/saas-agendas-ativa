import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin,
  X,
  Save,
  User,
  Pencil,
  Trash2,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Users
} from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';

// --- Types ---
interface Consultant {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  location: string;
  status: string;
  avatar: string;
}

interface FormData {
  name: string;
  email: string;
  role: string;
  phone: string;
  location: string;
  password: string;
}

const emptyForm: FormData = {
  name: '',
  email: '',
  role: 'CONSULTOR',
  phone: '',
  location: '',
  password: 'ativa2026'
};

// Helper to get initials
const getInitials = (name: string) => {
  return (name || '??')
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const roleLabel: Record<string, string> = {
  ADM: 'Administrador',
  CONSULTOR: 'Consultor',
  GERENTE: 'Gerente',
};

const roleColors: Record<string, string> = {
  ADM: 'bg-primary-100 text-primary-800',
  CONSULTOR: 'bg-emerald-100 text-emerald-800',
  GERENTE: 'bg-amber-100 text-amber-800',
};

export function Consultants() {
  const [searchTerm, setSearchTerm] = useState('');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ──────────────────────────────────────────────
  // FETCH - Buscar consultores do banco
  // ──────────────────────────────────────────────
  useEffect(() => {
    fetchConsultants();
  }, []);

  const fetchConsultants = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, phone, location, status, avatar_url')
        .order('full_name');
        
      if (error) throw error;
      
      setConsultants((data || []).map(c => ({
        id: c.id,
        name: c.full_name || '',
        role: c.role || 'CONSULTOR',
        email: c.email || '',
        phone: c.phone || '',
        location: c.location || '',
        status: c.status || 'Ativo',
        avatar: c.avatar_url || getInitials(c.full_name || '')
      })));
    } catch (error: any) {
      console.error('Erro ao buscar consultores:', error);
      showToast('error', 'Erro ao carregar consultores: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // CREATE - Criar novo consultor via RPC
  // ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.name.trim()) return showToast('error', 'Nome é obrigatório');
    if (!formData.email.trim()) return showToast('error', 'Email é obrigatório');

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_consultant', {
        p_email: formData.email.trim().toLowerCase(),
        p_full_name: formData.name.trim().toUpperCase(),
        p_role: formData.role,
        p_phone: formData.phone.trim() || null,
        p_location: formData.location.trim() || null,
        p_password: formData.password || 'ativa2026'
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      setConsultants(prev => [...prev, {
        id: result.id,
        name: result.full_name,
        role: result.role,
        email: result.email,
        phone: result.phone || '',
        location: result.location || '',
        status: result.status || 'Ativo',
        avatar: getInitials(result.full_name)
      }]);

      closeModal();
      showToast('success', `Consultor "${result.full_name}" criado com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao criar consultor:', error);
      showToast('error', error.message || 'Erro ao criar consultor');
    } finally {
      setSaving(false);
    }
  };

  // ──────────────────────────────────────────────
  // UPDATE - Atualizar consultor via RPC
  // ──────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return showToast('error', 'Nome é obrigatório');

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_consultant', {
        p_id: editingId,
        p_full_name: formData.name.trim().toUpperCase(),
        p_role: formData.role,
        p_phone: formData.phone.trim() || null,
        p_location: formData.location.trim() || null,
        p_status: null // mantém o status atual
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      setConsultants(prev => prev.map(c => c.id === editingId ? {
        ...c,
        name: result.full_name,
        role: result.role,
        phone: result.phone || '',
        location: result.location || '',
        avatar: getInitials(result.full_name)
      } : c));

      closeModal();
      showToast('success', 'Consultor atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      showToast('error', error.message || 'Erro ao atualizar consultor');
    } finally {
      setSaving(false);
    }
  };

  // ──────────────────────────────────────────────
  // DELETE - Excluir consultor via RPC
  // ──────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_consultant', {
        p_id: deleteId
      });

      if (error) throw error;

      setConsultants(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
      showToast('success', 'Consultor removido com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      showToast('error', error.message || 'Erro ao excluir consultor');
    } finally {
      setDeleting(false);
    }
  };

  // ──────────────────────────────────────────────
  // RESET PASSWORD - Resetar senha via RPC
  // ──────────────────────────────────────────────
  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Resetar a senha de "${name}" para "ativa2026"?`)) return;

    try {
      const { error } = await supabase.rpc('reset_consultant_password', {
        p_id: id,
        p_new_password: 'ativa2026'
      });

      if (error) throw error;
      showToast('success', `Senha de "${name}" resetada para "ativa2026"`);
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      showToast('error', error.message || 'Erro ao resetar senha');
    }
  };

  // ──────────────────────────────────────────────
  // TOGGLE STATUS - Ativar/Inativar consultor
  // ──────────────────────────────────────────────
  const handleToggleStatus = async (c: Consultant) => {
    const newStatus = c.status === 'Ativo' ? 'Inativo' : 'Ativo';
    try {
      const { error } = await supabase.rpc('update_consultant', {
        p_id: c.id,
        p_status: newStatus
      });

      if (error) throw error;
      setConsultants(prev => prev.map(item => item.id === c.id ? { ...item, status: newStatus } : item));
      showToast('success', `${c.name} agora está ${newStatus}`);
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao alterar status');
    }
  };

  // ──────────────────────────────────────────────
  // MODAL helpers
  // ──────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: Consultant) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      email: c.email,
      role: c.role,
      phone: c.phone,
      location: c.location,
      password: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  // ──────────────────────────────────────────────
  // FILTER
  // ──────────────────────────────────────────────
  const filtered = consultants.filter(c => {
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) ||
           c.role.toLowerCase().includes(term) ||
           c.email.toLowerCase().includes(term) ||
           c.phone.toLowerCase().includes(term) ||
           c.location.toLowerCase().includes(term);
  });

  const stats = {
    total: consultants.length,
    ativos: consultants.filter(c => c.status === 'Ativo').length,
    admins: consultants.filter(c => c.role === 'ADM').length,
    consultores: consultants.filter(c => c.role === 'CONSULTOR').length,
  };

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-navy-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando consultores...
      </div>
    );
  }

  return (
    <div className='space-y-6 p-8'>

      {/* Toast */}
      {toast && (
        <div className={clsx(
          'fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right duration-300',
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-navy-900'>Consultores</h1>
          <p className='text-navy-500'>Gerencie a equipe de consultoria e seus perfis.</p>
        </div>
        <button 
          onClick={openCreate}
          className='flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-colors'
        >
          <Plus className='w-4 h-4' /> Novo Consultor
        </button>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='bg-white rounded-xl border border-navy-100 p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-lg bg-navy-100 flex items-center justify-center'>
              <Users className='w-5 h-5 text-navy-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-navy-900'>{stats.total}</p>
              <p className='text-xs text-navy-500'>Total</p>
            </div>
          </div>
        </div>
        <div className='bg-white rounded-xl border border-navy-100 p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center'>
              <CheckCircle2 className='w-5 h-5 text-emerald-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-emerald-700'>{stats.ativos}</p>
              <p className='text-xs text-navy-500'>Ativos</p>
            </div>
          </div>
        </div>
        <div className='bg-white rounded-xl border border-navy-100 p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center'>
              <Shield className='w-5 h-5 text-primary-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-primary-700'>{stats.admins}</p>
              <p className='text-xs text-navy-500'>Admins</p>
            </div>
          </div>
        </div>
        <div className='bg-white rounded-xl border border-navy-100 p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center'>
              <User className='w-5 h-5 text-amber-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-amber-700'>{stats.consultores}</p>
              <p className='text-xs text-navy-500'>Consultores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className='bg-white p-4 rounded-xl border border-navy-100 shadow-sm'>
        <div className='relative max-w-md'>
          <Search className='w-5 h-5 absolute left-3 top-2.5 text-navy-400' />
          <input 
            type='text' 
            placeholder='Buscar por nome, cargo, email, telefone...' 
            className='w-full pl-10 pr-4 py-2 bg-navy-50 border border-navy-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid List */}
      {filtered.length === 0 ? (
        <div className='bg-white rounded-xl border border-navy-100 p-12 text-center text-navy-400'>
          <Users className='w-12 h-12 mx-auto mb-3 opacity-30' />
          <p className='text-lg font-medium'>Nenhum consultor encontrado</p>
          <p className='text-sm mt-1'>Tente ajustar a busca ou adicione um novo consultor.</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {filtered.map((consultant) => (
            <div key={consultant.id} className='bg-white rounded-xl border border-navy-100 shadow-sm hover:shadow-md transition-shadow group'>
              <div className='p-6'>
                <div className='flex justify-between items-start mb-4'>
                  <div className='w-12 h-12 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-navy-700 font-bold text-lg border-2 border-white shadow-sm'>
                    {consultant.avatar}
                  </div>
                  {/* Action Buttons */}
                  <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => openEdit(consultant)}
                      title='Editar'
                      className='p-1.5 text-navy-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors'
                    >
                      <Pencil className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => handleResetPassword(consultant.id, consultant.name)}
                      title='Resetar Senha'
                      className='p-1.5 text-navy-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors'
                    >
                      <KeyRound className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => setDeleteId(consultant.id)}
                      title='Excluir'
                      className='p-1.5 text-navy-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                <div className='mb-4'>
                  <h3 className='font-bold text-lg text-navy-900'>{consultant.name}</h3>
                  <span className={clsx(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1',
                    roleColors[consultant.role] || 'bg-navy-100 text-navy-800'
                  )}>
                    {roleLabel[consultant.role] || consultant.role}
                  </span>
                </div>

                <div className='space-y-2.5 text-sm text-navy-600'>
                  <div className='flex items-center gap-2'>
                    <Mail className='w-4 h-4 text-navy-400 shrink-0' />
                    <span className='truncate'>{consultant.email}</span>
                  </div>
                  {consultant.phone && (
                    <div className='flex items-center gap-2'>
                      <Phone className='w-4 h-4 text-navy-400 shrink-0' />
                      <span>{consultant.phone}</span>
                    </div>
                  )}
                  {consultant.location && (
                    <div className='flex items-center gap-2'>
                      <MapPin className='w-4 h-4 text-navy-400 shrink-0' />
                      <span>{consultant.location}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className='px-6 py-4 border-t border-navy-50 bg-navy-50/30 flex justify-between items-center rounded-b-xl'>
                <button
                  onClick={() => handleToggleStatus(consultant)}
                  className={clsx(
                    'flex items-center gap-2 text-xs font-medium rounded-full px-2.5 py-1 transition-colors',
                    consultant.status === 'Ativo'
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-red-700 bg-red-50 hover:bg-red-100'
                  )}
                >
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    consultant.status === 'Ativo' ? 'bg-emerald-500' : 'bg-red-400'
                  )} />
                  {consultant.status}
                </button>
                <button 
                  onClick={() => openEdit(consultant)}
                  className='text-sm font-medium text-primary-600 hover:text-primary-800'
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ────────── Modal Criar / Editar Consultor ────────── */}
      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-navy-100 max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-6 border-b border-navy-50 pb-4'>
              <h3 className='text-xl font-bold text-navy-900'>
                {editingId ? 'Editar Consultor' : 'Novo Consultor'}
              </h3>
              <button onClick={closeModal} className='p-1 text-navy-400 hover:bg-navy-50 rounded-lg'>
                <X className='w-5 h-5' />
              </button>
            </div>
            
            <div className='space-y-4'>
              {/* Nome */}
              <div>
                <label className='block text-sm font-medium text-navy-700 mb-1'>Nome Completo *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-navy-400" />
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm pl-9 pr-3 py-2.5 border'
                    placeholder="Ex: Ana Maria da Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
               
              {/* Email */}
              <div>
                <label className='block text-sm font-medium text-navy-700 mb-1'>Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-navy-400" />
                  <input 
                    type='email'
                    disabled={!!editingId}
                    className={clsx(
                      'w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm pl-9 pr-3 py-2.5 border',
                      editingId && 'bg-navy-50 text-navy-400 cursor-not-allowed'
                    )}
                    placeholder="email@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                {editingId && <p className='text-xs text-navy-400 mt-1'>Email não pode ser alterado.</p>}
              </div>

              {/* Role */}
              <div>
                <label className='block text-sm font-medium text-navy-700 mb-1'>Cargo / Função</label>
                <select 
                  className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm p-2.5 border bg-white'
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="CONSULTOR">Consultor</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="ADM">Administrador</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className='block text-sm font-medium text-navy-700 mb-1'>Telefone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-navy-400" />
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm pl-9 pr-3 py-2.5 border'
                    placeholder="(11) 99999-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className='block text-sm font-medium text-navy-700 mb-1'>Localização</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-navy-400" />
                  <input 
                    type='text' 
                    className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm pl-9 pr-3 py-2.5 border'
                    placeholder="São Paulo - SP"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>

              {/* Password (only on create) */}
              {!editingId && (
                <div>
                  <label className='block text-sm font-medium text-navy-700 mb-1'>Senha Inicial</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-navy-400" />
                    <input 
                      type='text' 
                      className='w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm pl-9 pr-3 py-2.5 border'
                      placeholder="ativa2026"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                  <p className='text-xs text-navy-400 mt-1'>Senha padrão: ativa2026</p>
                </div>
              )}
            </div>

            <div className='pt-6 mt-6 flex justify-end gap-3 border-t border-navy-50'>
              <button 
                onClick={closeModal}
                className='px-4 py-2.5 border border-navy-300 text-navy-700 font-medium rounded-lg hover:bg-navy-50 transition-colors'
              >
                Cancelar
              </button>
              <button 
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={saving}
                className='flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary-900/20'
              >
                {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                {editingId ? 'Atualizar' : 'Criar Consultor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────── Modal Confirmação de Exclusão ────────── */}
      {deleteId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm'>
          <div className='bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-navy-100'>
            <div className='flex flex-col items-center text-center'>
              <div className='w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4'>
                <Trash2 className='w-6 h-6 text-red-600' />
              </div>
              <h3 className='text-lg font-bold text-navy-900 mb-2'>Excluir Consultor?</h3>
              <p className='text-sm text-navy-500 mb-1'>
                <strong>{consultants.find(c => c.id === deleteId)?.name}</strong>
              </p>
              <p className='text-sm text-navy-500 mb-6'>
                Esta ação remove o login e todas as alocações vinculadas. Não pode ser desfeita.
              </p>
              <div className='flex gap-3 w-full'>
                <button 
                  onClick={() => setDeleteId(null)}
                  className='flex-1 px-4 py-2.5 border border-navy-300 text-navy-700 font-medium rounded-lg hover:bg-navy-50 transition-colors'
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={deleting}
                  className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors'
                >
                  {deleting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Trash2 className='w-4 h-4' />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
