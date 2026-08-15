import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Campo de formulário com rótulo, ajuda e erro.
 *
 * O rótulo é sempre associado ao input via id gerado — nunca só um texto
 * acima. Isso faz o leitor de tela anunciar o campo corretamente e amplia a
 * área de toque no mobile.
 *
 * A mensagem de erro usa role="alert" para ser anunciada assim que aparece.
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  rotulo: string
  ajuda?: ReactNode
  erro?: string | null
  contexto?: 'cidadao' | 'painel'
}

export function Campo({
  rotulo,
  ajuda,
  erro,
  contexto = 'cidadao',
  className,
  required,
  ...props
}: Props) {
  const id = useId()
  const idAjuda = `${id}-ajuda`
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

      {ajuda && (
        <p id={idAjuda} className="text-tinta-suave text-xs">
          {ajuda}
        </p>
      )}

      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={erro ? true : undefined}
        aria-describedby={cn(Boolean(ajuda) && idAjuda, Boolean(erro) && idErro) || undefined}
        className={cn(
          'bg-superficie text-tinta min-h-11 border px-3.5 py-2.5 text-base',
          'placeholder:text-tinta-suave transition-colors',
          contexto === 'cidadao' ? 'rounded-cidadao' : 'rounded-painel',
          erro
            ? 'border-risco-critico focus:border-risco-critico'
            : 'border-borda focus:border-marca-azul',
          className,
        )}
      />

      {erro && (
        <p id={idErro} role="alert" className="text-risco-critico text-xs font-medium">
          {erro}
        </p>
      )}
    </div>
  )
}
