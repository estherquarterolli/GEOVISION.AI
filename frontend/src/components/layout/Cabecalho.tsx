import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import logoImg from '@/assets/logo.jpg'

export function Cabecalho() {
  const { session, usuario, sair } = useAuth()

  return (
    <header className="bg-superficie border-borda border-b">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 text-xl">
          <img src={logoImg} alt="" className="size-8 rounded-lg object-contain" />
          <span>
            GeoVision<span className="text-marca-laranja">.AI</span>
          </span>
        </Link>

        {session && (
          <div className="flex items-center gap-3">
            {usuario && (
              <span className="text-tinta-suave hidden text-sm sm:inline">
                Olá, {usuario.nome.split(' ')[0]}
              </span>
            )}
            <button
              type="button"
              onClick={() => void sair()}
              title="Sair"
              aria-label="Sair"
              className="text-tinta-suave hover:bg-marca-azul-suave hover:text-marca-azul flex size-9 items-center justify-center rounded-full transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
