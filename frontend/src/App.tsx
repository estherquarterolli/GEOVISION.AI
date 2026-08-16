import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { RotaProtegida } from '@/components/RotaProtegida'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { Perfil } from '@/pages/Perfil'
import { NovoAlerta } from '@/pages/NovoAlerta'
import { TermosDeUso } from '@/pages/TermosDeUso'
import { VitrineDesignSystem } from '@/pages/VitrineDesignSystem'
import { PainelDefesaCivil } from '@/pages/PainelDefesaCivil'
import { Educacao } from '@/pages/Educacao'
import { MapaBairro } from '@/pages/MapaBairro'

import { NavegacaoInferior } from '@/components/layout/NavegacaoInferior'

function Inicio() {
  const { session } = useAuth()
  return <Navigate to={session ? '/perfil' : '/entrar'} replace />
}

function Layout() {
  const { session } = useAuth()

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho />
      <main className={session ? 'flex-1 pb-24' : 'flex-1'}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/termos" element={<TermosDeUso />} />
          <Route
            path="/perfil"
            element={
              <RotaProtegida>
                <Perfil />
              </RotaProtegida>
            }
          />
          <Route
            path="/novo-alerta"
            element={
              <RotaProtegida>
                <NovoAlerta />
              </RotaProtegida>
            }
          />
          <Route
            path="/educacao"
            element={
              <RotaProtegida>
                <Educacao />
              </RotaProtegida>
            }
          />
          <Route
            path="/mapa-bairro"
            element={
              <RotaProtegida>
                <MapaBairro />
              </RotaProtegida>
            }
          />
        </Routes>
      </main>
      {session && <NavegacaoInferior />}
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Fora do Layout: tela cheia, sem cabeçalho de app autenticado. */}
        <Route path="/design-system" element={<VitrineDesignSystem />} />
        <Route
          path="/painel"
          element={
            <RotaProtegida>
              <PainelDefesaCivil />
            </RotaProtegida>
          }
        />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  )
}
