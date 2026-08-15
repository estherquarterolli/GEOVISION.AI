import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ConfiguracaoPendente } from '@/components/ConfiguracaoPendente'

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { configurado, carregando, session } = useAuth()

  if (!configurado) return <ConfiguracaoPendente />

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="progresso-ia w-48" />
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace />

  return <>{children}</>
}
