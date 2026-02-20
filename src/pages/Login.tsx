import React, { useState } from 'react';
import { Calendar, Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Tentando login com:', email.trim());
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        throw error;
      }

      console.log('Login bem sucedido:', data);

      if (data.session) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Fallback amigável para erro 500 (problema de config do servidor)
      if (err.status === 500 || err.message?.includes('Database error')) {
         setError('Erro interno no servidor (Banco de Dados). Por favor, execute o script "super_fix.sql" no painel do Supabase.');
      } else {
         setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-navy-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
      <div className='sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='flex justify-center'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30'>
            <Calendar className='w-7 h-7' />
          </div>
        </div>
        <h2 className='mt-6 text-center text-3xl font-bold tracking-tight text-navy-900'>
          Agendas<span className='text-primary-600'>Ativa</span>
        </h2>
        <p className='mt-2 text-center text-sm text-navy-600'>
          Acesse sua conta para gerenciar alocações
        </p>
      </div>

      <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='bg-white py-8 px-4 shadow-xl shadow-navy-100/50 sm:rounded-xl sm:px-10 border border-navy-100'>
          <form className='space-y-6' onSubmit={handleLogin}>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor='email' className='block text-sm font-medium text-navy-700'>
                Email Corporativo
              </label>
              <div className='mt-1 relative rounded-md shadow-sm'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Mail className='h-5 w-5 text-navy-400' aria-hidden='true' />
                </div>
                <input
                  id='email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='block w-full pl-10 sm:text-sm border-navy-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2.5 border outline-none'
                  placeholder='nome@empresa.com'
                />
              </div>
            </div>

            <div>
              <label htmlFor='password' className='block text-sm font-medium text-navy-700'>
                Senha
              </label>
              <div className='mt-1 relative rounded-md shadow-sm'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Lock className='h-5 w-5 text-navy-400' aria-hidden='true' />
                </div>
                <input
                  id='password'
                  name='password'
                  type='password'
                  autoComplete='current-password'
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='block w-full pl-10 sm:text-sm border-navy-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 p-2.5 border outline-none'
                  placeholder='••••••••'
                />
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <input
                  id='remember-me'
                  name='remember-me'
                  type='checkbox'
                  className='h-4 w-4 text-primary-600 focus:ring-primary-500 border-navy-300 rounded'
                />
                <label htmlFor='remember-me' className='ml-2 block text-sm text-navy-900'>
                  Lembrar de mim
                </label>
              </div>

              <div className='text-sm'>
                <a href='#' className='font-medium text-primary-600 hover:text-primary-500'>
                  Esqueceu a senha?
                </a>
              </div>
            </div>

            <div>
              <button
                type='submit'
                disabled={loading}
                className='w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-navy-900 hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed'
              >
                {loading ? (
                   <>
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                     Entrando...
                   </>
                ) : (
                   <>
                     Entrar na Plataforma
                     <ArrowRight className='ml-2 w-4 h-4' />
                   </>
                )}
              </button>
            </div>
          </form>

          <div className='mt-6'>
            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <div className='w-full border-t border-navy-200' />
              </div>
              <div className='relative flex justify-center text-sm'>
                <span className='px-2 bg-white text-navy-500'>Acesso Seguro</span>
              </div>
            </div>
            <div className='mt-6 grid grid-cols-1 gap-3'>
              <div className='flex justify-center items-center space-x-2 text-xs text-navy-400'>
                <Lock className='w-3 h-3' />
                <span>Criptografia de ponta a ponta</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
