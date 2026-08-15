import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { RotaProtegida } from '@/components/RotaProtegida'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { Perfil } from '@/pages/Perfil'
import { TermosDeUso } from '@/pages/TermosDeUso'
import { VitrineDesignSystem } from '@/pages/VitrineDesignSystem'

function Inicio() {
  const { session } = useAuth()
  return <Navigate to={session ? '/perfil' : '/entrar'} replace />
}

function Layout() {
  return (
    <div className="min-h-dvh">
      <Cabecalho />
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
      </Routes>
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Fora do Layout: tela cheia, sem cabeçalho de app autenticado. */}
        <Route path="/design-system" element={<VitrineDesignSystem />} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  )
}
