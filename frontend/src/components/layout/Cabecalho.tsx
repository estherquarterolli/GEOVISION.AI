import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Botao } from '@/components/ui/Botao'

export function Cabecalho() {
  const { session, usuario, sair } = useAuth()

  return (
    <header className="bg-superficie border-borda border-b">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Link to="/" className="text-xl">
          GeoVision<span className="text-marca-laranja">.AI</span>
        </Link>

        {session && (
          <div className="flex items-center gap-3">
            {usuario && (
              <span className="text-tinta-suave hidden text-sm sm:inline">
                Olá, {usuario.nome.split(' ')[0]}
              </span>
            )}
            <Link to="/perfil" className="text-marca-azul text-sm font-medium hover:underline">
              Meu perfil
            </Link>
            <Botao variante="fantasma" onClick={() => void sair()}>
              Sair
            </Botao>
          </div>
        )}
      </div>
    </header>
  )
}
