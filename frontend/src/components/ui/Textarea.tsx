import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  rotulo: string
  ajuda?: ReactNode
  contexto?: 'cidadao' | 'painel'
}

export function Textarea({ rotulo, ajuda, contexto = 'cidadao', className, ...props }: Props) {
  const id = useId()
  const idAjuda = `${id}-ajuda`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-tinta text-sm font-medium">
        {rotulo}
      </label>

      {ajuda && (
        <p id={idAjuda} className="text-tinta-suave text-xs">
          {ajuda}
        </p>
      )}

      <textarea
        {...props}
        id={id}
        aria-describedby={ajuda ? idAjuda : undefined}
        rows={props.rows ?? 3}
        className={cn(
          'bg-superficie text-tinta border-borda resize-none border px-3.5 py-2.5 text-base',
          'placeholder:text-tinta-suave focus:border-marca-azul transition-colors',
          contexto === 'cidadao' ? 'rounded-cidadao' : 'rounded-painel',
          className,
        )}
      />
    </div>
  )
}
