import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Superfície base.
 *
 * O `contexto` decide o raio: arredondado no app do cidadão (acolhedor),
 * quase reto no painel da Defesa Civil (institucional). É a regra de raio do
 * design system aplicada uma vez, aqui, em vez de repetida em cada tela.
 */
interface Props extends HTMLAttributes<HTMLDivElement> {
  contexto?: 'cidadao' | 'painel'
  /** Sem sombra — para listas densas do painel, onde sombra vira ruído. */
  plano?: boolean
}

export function Cartao({
  contexto = 'cidadao',
  plano = false,
  className,
  children,
  ...props
}: Props) {
  return (
    <div
      {...props}
      className={cn(
        'bg-superficie border-borda border',
        contexto === 'cidadao' ? 'rounded-cidadao' : 'rounded-painel',
        !plano && 'shadow-card',
        className,
      )}
    >
      {children}
    </div>
  )
}
