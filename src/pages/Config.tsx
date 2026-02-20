import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User as UserIcon, Mail, Briefcase, Save } from 'lucide-react';

export function Config() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    id: '',
    full_name: '',
    role: '',
    email: ''
  });
  const [originalEmail, setOriginalEmail] = useState('');

  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
           const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

           if (error && error.code !== 'PGRST116') {
             console.error('Error fetching profile:', error);
           }
           
           if (data) {
             setProfile({
               id: data.id,
               full_name: data.full_name || '',
               role: data.role || '',
               email: user.email || ''
             });
             setOriginalEmail(user.email || '');
           } else if (user) {
              setProfile({
               id: user.id,
               full_name: '',
               role: '',
               email: user.email || ''
             });
             setOriginalEmail(user.email || '');
           }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, []);

  const handleSave = async () => {
    if (!profile.id) return;
    
    setIsSaving(true);
    let message = '';
    
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role
        });

      if (profileError) throw profileError;
      message = 'Informações atualizadas com sucesso!';

      if (profile.email !== originalEmail) {
         const { error: authError } = await supabase.auth.updateUser({ email: profile.email });
         if (authError) throw authError;
         message += ' Verifique seu novo email para confirmar a alteração.';
         setOriginalEmail(profile.email);
      }

      alert(message);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Erro ao atualizar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-500 animate-pulse">Carregando informações...</div>
      </div>
    );
  }

  return (
    <div className='max-w-2xl mx-auto p-6 md:p-8 animate-in fade-in duration-500'>
       <div className='bg-white rounded-xl shadow-sm border border-navy-100 p-8'>
         <div className='flex items-center justify-between mb-8'>
            <h3 className='text-xl font-bold text-navy-900'>Meu Perfil</h3>
            <span className='px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full'>
              {profile.role || 'Usuário'}
            </span>
         </div>
         
         <div className='flex items-center gap-5 mb-10 pb-10 border-b border-navy-50'>
            <div className='h-20 w-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 border-4 border-white shadow-lg flex items-center justify-center shrink-0'>
              <span className='text-primary-700 text-2xl font-bold'>
                {profile.full_name ? profile.full_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'US'}
              </span>
            </div>
            <div>
              <p className='text-lg font-bold text-navy-900'>{profile.full_name || 'Usuário'}</p>
              <p className='text-sm text-navy-500'>{profile.email}</p>
            </div>
         </div>

         <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div className="md:col-span-2">
               <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-2'>
                 <Mail className='w-4 h-4 text-navy-400' /> Email
               </label>
               <input 
                 type='email' 
                 className='block w-full rounded-lg border-navy-200 bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 text-sm p-2.5 border transition-all' 
                 value={profile.email} 
                 onChange={(e) => setProfile({ ...profile, email: e.target.value })}
               />
               <p className='text-xs text-amber-600 mt-1'>
                 Alterar o email exigirá verificação no novo endereço.
               </p>
            </div>

            <div className='md:col-span-2'>
              <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-2'>
                 <UserIcon className='w-4 h-4 text-navy-400' /> Nome Completo
              </label>
              <input 
                type='text' 
                placeholder='Ex: João Silva'
                className='block w-full rounded-lg border-navy-200 bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 text-sm p-2.5 border transition-all' 
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>
            
            <div className='md:col-span-2'>
              <label className='flex items-center gap-2 text-sm font-semibold text-navy-700 mb-2'>
                <Briefcase className='w-4 h-4 text-navy-400' /> Cargo
              </label>
              <select 
                className='block w-full rounded-lg border-navy-200 bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 text-sm p-2.5 border transition-all' 
                value={profile.role} 
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              >
                <option value="" disabled>Selecione um cargo...</option>
                <option value="CONSULTOR">Consultor</option>
                <option value="GERENTE">Gerente</option>
                <option value="ADM">Administrador</option>
              </select>
            </div>
         </div>

         <div className='flex justify-end pt-8 mt-8 border-t border-navy-100'>
           <button 
             onClick={handleSave}
             disabled={isSaving}
             className='flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white rounded-lg font-medium shadow-lg shadow-navy-900/20 hover:bg-navy-800 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none'
           >
             <Save className='w-4 h-4' />
             {isSaving ? 'Salvando...' : 'Salvar Alterações'}
           </button>
         </div>
       </div>
    </div>
  );
}
