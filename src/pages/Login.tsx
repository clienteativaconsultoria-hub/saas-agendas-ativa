import React, { useState } from 'react';
import { Calendar, Lock, Mail, ArrowRight, Loader2, AlertCircle, Shield } from 'lucide-react';
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) navigate('/dashboard');
    } catch (err: any) {
      if (err.status === 500 || err.message?.includes('Database error')) {
        setError('Erro interno no servidor. Execute o script SQL no painel do Supabase.');
      } else {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex'>

      {/* Left panel — dark branding */}
      <div className='hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden'
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #1e3a8a 100%)',
        }}>
        {/* Glow orbs */}
        <div className='absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full pointer-events-none'
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)' }} />
        <div className='absolute bottom-[-40px] right-[-40px] w-64 h-64 rounded-full pointer-events-none'
          style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)' }} />

        {/* Grid overlay */}
        <svg className='absolute inset-0 w-full h-full opacity-[0.05]' xmlns='http://www.w3.org/2000/svg'>
          <defs>
            <pattern id='lgrid' width='48' height='48' patternUnits='userSpaceOnUse'>
              <path d='M 48 0 L 0 0 0 48' fill='none' stroke='white' strokeWidth='1'/>
            </pattern>
          </defs>
          <rect width='100%' height='100%' fill='url(#lgrid)' />
        </svg>

        {/* Logo */}
        <div className='relative z-10'>
          <div className='flex items-center gap-3 mb-2'>
            <div className='w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-400/30 flex items-center justify-center'>
              <Calendar className='w-5 h-5 text-primary-400' />
            </div>
            <span className='text-white font-bold text-xl tracking-tight'>
              Agendas
            </span>
          </div>
        </div>

        {/* Hero text */}
        <div className='relative z-10'>
          <h2 className='text-4xl font-extrabold text-white leading-tight tracking-tight mb-4'>
            Gestão de<br />
            alocação de<br />
            <span className='text-primary-400'>consultores</span>
          </h2>
          <p className='text-white/50 text-sm leading-relaxed max-w-xs'>
            Controle agenda, diário de bordo, prazos e relatórios estratégicos — tudo em um só lugar.
          </p>

          {/* Feature pills */}
          <div className='flex flex-wrap gap-2 mt-6'>
            {['Alocação inteligente', 'Alertas de prazo', 'Relatórios', 'Painel estratégico'].map(f => (
              <span key={f}
                className='text-[11px] font-semibold text-primary-300 bg-primary-400/10 border border-primary-400/20 px-3 py-1 rounded-full'>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className='relative z-10 flex items-center gap-2 text-white/25 text-xs'>
          <Shield className='w-3.5 h-3.5' />
          Acesso seguro com criptografia de ponta a ponta
        </div>
      </div>

      {/* Right panel — form */}
      <div className='flex-1 flex items-center justify-center p-8 bg-navy-50'>
        <div className='w-full max-w-sm'>

          {/* Mobile logo */}
          <div className='lg:hidden flex items-center justify-center gap-3 mb-8'>
            <div className='w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg'>
              <Calendar className='w-5 h-5 text-white' />
            </div>
            <span className='text-navy-900 font-bold text-xl'>
              Agendas
            </span>
          </div>

          <h1 className='text-2xl font-extrabold text-navy-950 mb-1 tracking-tight'>Bem-vindo de volta</h1>
          <p className='text-sm text-navy-500 mb-8'>Entre com suas credenciais para continuar</p>

          <form onSubmit={handleLogin} className='space-y-4'>

            {error && (
              <div className='flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm'>
                <AlertCircle className='w-4 h-4 shrink-0 mt-0.5' />
                {error}
              </div>
            )}

            <div className='space-y-1'>
              <label htmlFor='email' className='block text-sm font-semibold text-navy-700'>
                E-mail corporativo
              </label>
              <div className='relative'>
                <Mail className='w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none' />
                <input
                  id='email'
                  type='email'
                  autoComplete='email'
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder='nome@empresa.com'
                  className='input pl-10'
                />
              </div>
            </div>

            <div className='space-y-1'>
              <label htmlFor='password' className='block text-sm font-semibold text-navy-700'>
                Senha
              </label>
              <div className='relative'>
                <Lock className='w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none' />
                <input
                  id='password'
                  type='password'
                  autoComplete='current-password'
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder='••••••••'
                  className='input pl-10'
                />
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <label className='flex items-center gap-2 text-sm text-navy-600 cursor-pointer select-none'>
                <input type='checkbox' className='w-4 h-4 rounded border-navy-300 text-primary-600' />
                Lembrar de mim
              </label>
              <a href='#' className='text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors'>
                Esqueceu?
              </a>
            </div>

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full h-11 mt-2 text-sm'
            >
              {loading ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar na Plataforma
                  <ArrowRight className='w-4 h-4' />
                </>
              )}
            </button>
          </form>

          <p className='mt-8 text-center text-xs text-navy-400'>
            Problemas de acesso? Entre em contato com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
