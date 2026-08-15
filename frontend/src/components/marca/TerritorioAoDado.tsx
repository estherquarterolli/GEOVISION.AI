/**
 * Motivo gráfico da marca: "Do Território ao Dado".
 *
 * Traduz a logo em elemento de interface — as linhas de contorno topográfico
 * (laranja) se convertem em uma rede de nós conectados (azul) e fecham em um
 * pino de localização. É a jornada do dado no produto: relevo/risco natural →
 * dado estruturado pela IA → ponto de ação no mapa.
 *
 * Uso previsto: telas vazias, splash, cabeçalho de onboarding e estado de
 * "IA processando". Sempre como fundo sutil — nunca sobreposto a conteúdo
 * legível, para não virar ruído.
 */
interface Props {
  className?: string
  /** Opacidade do motivo. Padrão baixo: é textura de fundo, não ilustração. */
  opacidade?: number
}

export function TerritorioAoDado({ className, opacidade = 0.16 }: Props) {
  return (
    <svg
      viewBox="0 0 320 140"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ opacity: opacidade }}
    >
      {/* Contorno topográfico — lado do território */}
      <g stroke="var(--color-marca-laranja)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 108C28 92 44 96 64 84s28-30 52-34" />
        <path d="M6 88C30 72 48 78 68 66s26-28 50-32" />
        <path d="M10 68C34 54 52 60 70 50s24-24 46-28" />
      </g>

      {/* Rede de nós — lado do dado */}
      <g stroke="var(--color-marca-azul)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M150 42l44 26 40-18 44 30" />
        <path d="M150 42l38 54 46-28" />
        <path d="M194 68l40 28" />
      </g>
      <g fill="var(--color-marca-azul)">
        <circle cx="150" cy="42" r="4" />
        <circle cx="194" cy="68" r="4" />
        <circle cx="234" cy="50" r="4" />
        <circle cx="188" cy="96" r="4" />
        <circle cx="234" cy="96" r="4" />
      </g>

      {/* Pino de localização — o ponto de ação */}
      <path
        d="M278 98c0-9 7-16 16-16s16 7 16 16c0 12-16 28-16 28s-16-16-16-28z"
        fill="var(--color-marca-laranja)"
      />
      <circle cx="294" cy="98" r="6" fill="var(--color-fundo)" />
    </svg>
  )
}
