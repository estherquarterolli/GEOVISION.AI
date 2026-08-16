import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ConfiguracaoPendente } from '@/components/ConfiguracaoPendente'
import type { PapelUsuario } from '@/types/dominio'

interface Props {
  children: ReactNode
  /** Sem essa prop, qualquer sessão autenticada passa — o padrão da maioria das telas. */
  papeisPermitidos?: PapelUsuario[]
}

export function RotaProtegida({ children, papeisPermitidos }: Props) {
  const { configurado, carregando, session, usuario } = useAuth()

  if (!configurado) return <ConfiguracaoPendente />

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="progresso-ia w-48" />
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace />

  // Uma tela de "acesso restrito" em vez de redirecionar de volta: um
  // cidadão que cai aqui por engano precisa entender por quê, não ser
  // silenciosamente jogado para outro lugar sem explicação.
  if (papeisPermitidos && usuario && !papeisPermitidos.includes(usuario.papel)) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-lg">Acesso restrito</h1>
        <p className="text-tinta-suave mt-2 text-sm">
          Esta área é exclusiva da equipe da Defesa Civil.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
