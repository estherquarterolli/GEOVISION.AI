import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Checkbox acessível, usado sobretudo no aceite dos Termos de Uso — o único
 * ponto do cadastro em que "o usuário viu e marcou de propósito" precisa ser
 * verificável, não só visualmente sugerido.
 *
 * O alvo de toque cobre o texto inteiro (não só o quadrado de 20px), porque
 * é a mesma exigência de área mínima de toque do resto do design system.
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  rotulo: ReactNode
  erro?: string | null
}

export function Checkbox({ rotulo, erro, className, required, ...props }: Props) {
  const id = useId()
  const idErro = `${id}-erro`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
        <input
          {...props}
          id={id}
          type="checkbox"
          required={required}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          className={cn(
            'border-borda text-marca-laranja mt-0.5 size-5 shrink-0 rounded',
            'focus-visible:outline-marca-azul focus-visible:outline-2 focus-visible:outline-offset-2',
            erro && 'border-risco-critico',
            className,
          )}
        />
        <span className="text-tinta text-sm">{rotulo}</span>
      </label>

      {erro && (
        <p id={idErro} role="alert" className="text-risco-critico text-xs font-medium">
          {erro}
        </p>
      )}
    </div>
  )
}
