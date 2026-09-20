import { cn } from '@/lib/cn'
import { ROTULO_RISCO, type NivelRisco } from '@/types/dominio'

/**
 * Selo de nível de risco — a assinatura visual do produto.
 *
 * Aparece sobreposto à foto da anomalia, na lista de alertas e na fila de
 * triagem. Por isso o componente é único: a cor do risco nunca deve divergir
 * entre app do cidadão e painel da Defesa Civil.
 *
 * A cor sozinha não comunica o nível para quem tem daltonismo, então o texto
 * ("Baixo"/"Médio"/"Crítico") é sempre exibido junto — nunca só a bolinha.
 */

const ESTILOS: Record<NivelRisco, string> = {
  baixo: 'bg-risco-baixo-suave text-risco-baixo border-risco-baixo/30',
  medio: 'bg-risco-medio-suave text-risco-medio border-risco-medio/30',
  critico: 'bg-risco-critico-suave text-risco-critico border-risco-critico/30',
}

const ESTILOS_SOLIDO: Record<NivelRisco, string> = {
  baixo: 'bg-risco-baixo text-white border-transparent',
  medio: 'bg-risco-medio text-white border-transparent',
  critico: 'bg-risco-critico text-white border-transparent',
}

interface Props {
  nivel: NivelRisco
  /** Sólido para sobrepor a foto; suave para listas e cartões. */
  variante?: 'suave' | 'solido'
  tamanho?: 'sm' | 'md'
  /**
   * Exibe a confiança estatística do modelo (0–1).
   * Este valor não é uma porcentagem de risco estrutural.
   */
  confianca?: number | null
  className?: string
}

export function SeloRisco({
  nivel,
  variante = 'suave',
  tamanho = 'md',
  confianca,
  className,
}: Props) {
  const paleta = variante === 'solido' ? ESTILOS_SOLIDO : ESTILOS

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        tamanho === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        paleta[nivel],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          variante === 'solido' ? 'bg-white/80' : 'bg-current',
        )}
      />
      Risco {ROTULO_RISCO[nivel]}
      {confianca != null && (
        <span
          className="metrica border-l border-current/30 pl-1.5 text-[0.85em] opacity-80"
          title="Confiança da classificação automática; não representa probabilidade de colapso ou porcentagem de risco estrutural."
        >
          Confiança da IA: {Math.round(confianca * 100)}%
        </span>
      )}
    </span>
  )
}
