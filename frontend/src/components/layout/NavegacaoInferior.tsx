import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'

export function NavegacaoInferior() {
  const location = useLocation()
  const path = location.pathname

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-borda/40 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-flutuante backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        
        {/* Tab 1: Início */}
        <Link
          to="/"
          className={cn(
            'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors duration-200',
            path === '/' ? 'text-marca-azul' : 'text-tinta-suave hover:text-tinta'
          )}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7m-14 0v8a2 2 0 002 2h3m9-10l2 2m-2-2v8a2 2 0 01-2 2h-3m-6 0a2 2 0 002-2v-4a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 002 2m-6 0h6"
            />
          </svg>
          <span>Início</span>
        </Link>

        {/* Tab 2: Mapa do Bairro */}
        <Link
          to="/mapa-bairro"
          className={cn(
            'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors duration-200',
            path === '/mapa-bairro' ? 'text-marca-azul' : 'text-tinta-suave hover:text-tinta'
          )}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <span>Mapa</span>
        </Link>

        {/* Tab 3: Novo Alerta (Prominent Button) */}
        <Link
          to="/novo-alerta"
          className="relative -top-5 flex flex-col items-center gap-1 group mx-1"
        >
          {/* Outer glowing effect */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-marca-laranja to-marca-laranja-escuro opacity-40 blur-md transition duration-300 group-hover:opacity-70 group-hover:scale-110" />
          <div className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition duration-300 group-hover:scale-105",
            path === '/novo-alerta' 
              ? 'bg-marca-laranja-escuro text-white' 
              : 'bg-marca-laranja text-white'
          )}>
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="mt-0.5 text-[10px] font-semibold text-marca-laranja group-hover:text-marca-laranja-escuro">
            Reportar
          </span>
        </Link>

        {/* Tab 4: Educação */}
        <Link
          to="/educacao"
          className={cn(
            'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors duration-200',
            path === '/educacao' ? 'text-marca-azul' : 'text-tinta-suave hover:text-tinta'
          )}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span>Aprender</span>
        </Link>

        {/* Tab 5: Perfil */}
        <Link
          to="/perfil"
          className={cn(
            'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors duration-200',
            path === '/perfil' ? 'text-marca-azul' : 'text-tinta-suave hover:text-tinta'
          )}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>Perfil</span>
        </Link>

      </div>
    </nav>
  )
}
