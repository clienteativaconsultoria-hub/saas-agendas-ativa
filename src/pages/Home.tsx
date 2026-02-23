import { Calendar, LifeBuoy, ArrowRight, ExternalLink } from 'lucide-react';

export function Home() {
  return (
    <div className="min-h-screen bg-navy-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-200/20 rounded-full blur-3xl animate-blob opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/20 rounded-full blur-3xl animate-blob animation-delay-4000 opacity-50" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-purple-200/20 rounded-full blur-3xl animate-blob animation-delay-2000 opacity-30" />
      </div>

      <div className="w-full max-w-5xl z-10 animate-in fade-in zoom-in duration-700 slide-in-from-bottom-8">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-16">
           <div className="relative group mb-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <img src="/favicon.svg" alt="Ativa Consultoria Logo" className="relative w-40 h-40 md:w-48 md:h-48 object-contain drop-shadow-sm select-none transform transition-transform duration-500 hover:scale-105" />
            </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold text-navy-900 tracking-tight mb-6">
            Ativa <span className="bg-gradient-to-r from-primary-600 to-sky-500 bg-clip-text text-transparent">Consultoria</span>
          </h1>
          <p className="w-full text-lg md:text-xl text-navy-600 leading-relaxed mx-auto px-4 whitespace-nowrap">
            Gestão inteligente de alocação e suporte técnico centralizado em um só lugar.
          </p>
        </div>

        {/* Cards Section */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl mx-auto px-6">
          
          {/* Card: Agendas */}
          <a 
            href="https://www.agendaconsultor.com.br/login"
            className="group relative flex flex-col p-8 bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-lg hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-300 border border-white/50 hover:border-primary-200 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
               <ExternalLink className="w-5 h-5 text-primary-400" />
            </div>
            
            <div className="mb-6">
               <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                 <Calendar className="w-8 h-8" />
               </div>
            </div>

            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-navy-900 group-hover:text-primary-700 transition-colors">
                Sistema de Agendas
              </h3>
              <p className="text-navy-500 text-base leading-relaxed">
                Acesse o painel completo de alocação de consultores, gerenciamento de projetos e visualização de disponibilidade da equipe.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-navy-50">
              <span className="flex items-center justify-between w-full font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
                Acessar Plataforma
                <span className="bg-primary-50 p-2 rounded-full group-hover:bg-primary-100 transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </span>
            </div>
          </a>

          {/* Card: Suporte */}
          <a 
            href="https://suporte.ativaconsultoria.net.br/"
            className="group relative flex flex-col p-8 bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-lg hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 border border-white/50 hover:border-emerald-200 overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
               <ExternalLink className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="mb-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <LifeBuoy className="w-8 h-8" />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-bold text-navy-900 group-hover:text-emerald-700 transition-colors">
                Central de Suporte
              </h3>
              <p className="text-navy-500 text-base leading-relaxed">
                Abra chamados técnicos, acompanhe o status das suas solicitações e obtenha ajuda rápida da nossa equipe de suporte.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-navy-50">
              <span className="flex items-center justify-between w-full font-semibold text-emerald-600 group-hover:text-emerald-700 transition-colors">
                Solicitar Ajuda
                <span className="bg-emerald-50 p-2 rounded-full group-hover:bg-emerald-100 transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </span>
            </div>
          </a>

        </div>

        {/* Footer */}
        <div className="mt-24 text-center pb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <p className="text-navy-400 text-sm">
            © {new Date().getFullYear()} Ativa Consultoria &bull; Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}

