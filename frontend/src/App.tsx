import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { RotaProtegida } from '@/components/RotaProtegida'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { Inicio } from '@/pages/Inicio'
import { Perfil } from '@/pages/Perfil'
import { NovoAlerta } from '@/pages/NovoAlerta'
import { TermosDeUso } from '@/pages/TermosDeUso'
import { VitrineDesignSystem } from '@/pages/VitrineDesignSystem'
import { PainelDefesaCivil } from '@/pages/PainelDefesaCivil'
import { Educacao } from '@/pages/Educacao'
import { MapaBairro } from '@/pages/MapaBairro'
import { AdminLogin } from '@/pages/AdminLogin'

import { NavegacaoInferior } from '@/components/layout/NavegacaoInferior'

function RaizAutenticada() {
  const { carregando, session } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="progresso-ia w-48" />
      </div>
    )
  }

  return session ? <Inicio /> : <Navigate to="/entrar" replace />
}

function Layout() {
  const { session } = useAuth()

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho />
      <main className={session ? 'flex-1 pb-24' : 'flex-1'}>
        <Routes>
          <Route path="/" element={<RaizAutenticada />} />
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

function RaizAdmin() {
  const { carregando, session, usuario } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="size-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      </div>
    )
  }

  if (session && usuario && (usuario.papel === 'admin' || usuario.papel === 'defesa_civil')) {
    return <Navigate to="/painel" replace />
  }

  return <Navigate to="/admin/login" replace />
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Fora do Layout: tela cheia, sem cabeçalho de app autenticado. */}
        <Route path="/design-system" element={<VitrineDesignSystem />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RaizAdmin />} />
        {/* O painel expõe o endereço de todos os alertas da cidade. A API já
            recusa quem não é da equipe; isto evita a tela quebrada de
            requisições em 403 para um cidadão que abra a URL. */}
        <Route
          path="/painel"
          element={
            <RotaProtegida papeisPermitidos={['defesa_civil', 'admin']}>
              <PainelDefesaCivil />
            </RotaProtegida>
          }
        />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  )
}
