import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  rotulo: string
  erro?: string | null
  contexto?: 'cidadao' | 'painel'
  children: ReactNode
}

export function Select({
  rotulo,
  erro,
  contexto = 'cidadao',
  className,
  required,
  children,
  ...props
}: Props) {
  const id = useId()
  const idErro = `${id}-erro`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-tinta text-sm font-medium">
        {rotulo}
        {required && (
          <span className="text-risco-critico ml-0.5" aria-label="obrigatório">
            *
          </span>
        )}
      </label>

      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={cn(
          'bg-superficie text-tinta min-h-11 border px-3.5 py-2.5 text-base',
          'transition-colors',
          contexto === 'cidadao' ? 'rounded-cidadao' : 'rounded-painel',
          erro
            ? 'border-risco-critico focus:border-risco-critico'
            : 'border-borda focus:border-marca-azul',
          className,
        )}
      >
        {children}
      </select>

      {erro && (
        <p id={idErro} role="alert" className="text-risco-critico text-xs font-medium">
          {erro}
        </p>
      )}
    </div>
  )
}
