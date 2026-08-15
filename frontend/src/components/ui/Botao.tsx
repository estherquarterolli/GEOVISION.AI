import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Botão base do design system.
 *
 * Altura mínima de 44px em todas as variantes: é o alvo de toque mínimo
 * recomendado para uso com o polegar, e o app é usado em campo, na rua,
 * possivelmente com pressa.
 */

type Variante = 'primaria' | 'secundaria' | 'fantasma' | 'perigo'

const VARIANTES: Record<Variante, string> = {
  primaria:
    'bg-marca-laranja text-white hover:bg-marca-laranja-escuro active:bg-marca-laranja-escuro',
  secundaria:
    'bg-marca-azul text-white hover:bg-marca-azul-escuro active:bg-marca-azul-escuro',
  fantasma:
    'bg-transparent text-marca-azul border border-borda hover:bg-marca-azul-suave',
  perigo: 'bg-risco-critico text-white hover:brightness-95',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  /** Ocupa toda a largura — padrão em ações principais no mobile. */
  largura?: 'auto' | 'cheia'
  carregando?: boolean
  iconeEsquerda?: ReactNode
  contexto?: 'cidadao' | 'painel'
}

export function Botao({
  variante = 'primaria',
  largura = 'auto',
  carregando = false,
  iconeEsquerda,
  contexto = 'cidadao',
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 px-5 font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        contexto === 'cidadao' ? 'rounded-cidadao' : 'rounded-painel',
        largura === 'cheia' && 'w-full',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        iconeEsquerda
      )}
      {children}
    </button>
  )
}
