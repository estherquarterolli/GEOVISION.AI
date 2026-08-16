import { useState } from 'react'
import { Cartao } from '@/components/ui/Cartao'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { cn } from '@/lib/cn'

interface GuiaAnomalia {
  titulo: string
  descricao: string
  regras: {
    nivel: 'baixo' | 'medio' | 'critico'
    sinal: string
    explicacao: string
  }[]
}

const GUIAS: GuiaAnomalia[] = [
  {
    titulo: 'Fissuras e Rachaduras',
    descricao: 'Aberturas na alvenaria ou elementos estruturais. Fique atento à direção e espessura.',
    regras: [
      {
        nivel: 'baixo',
        sinal: 'Fina e horizontal',
        explicacao: 'Fissuras com menos de 1mm de espessura, horizontais, geralmente superficiais na pintura ou reboco.'
      },
      {
        nivel: 'medio',
        sinal: 'Vertical ou moderada',
        explicacao: 'Trincas de 1 a 3mm, verticais. Merecem acompanhamento para verificar se estão aumentando de tamanho.'
      },
      {
        nivel: 'critico',
        sinal: 'Diagonal e larga',
        explicacao: 'Rachaduras com mais de 3mm de espessura, em sentido diagonal, ou que atravessam pilares e vigas.'
      }
    ]
  },
  {
    titulo: 'Muro de Arrimo e Encostas',
    descricao: 'Estruturas de contenção de terra. O movimento e a drenagem são vitais.',
    regras: [
      {
        nivel: 'baixo',
        sinal: 'Manchas de umidade',
        explicacao: 'Pequenas manchas de infiltração sem estufamento ou rachaduras no corpo do muro.'
      },
      {
        nivel: 'medio',
        sinal: 'Pequenas trincas',
        explicacao: 'Trincas finas nas juntas dos blocos ou drenos entupidos com pouca vazão de água.'
      },
      {
        nivel: 'critico',
        sinal: 'Inclinação ou estufamento',
        explicacao: 'Muro visivelmente inclinado, barriga (estufamento), rachaduras largas ou terra cedendo no topo.'
      }
    ]
  },
  {
    titulo: 'Infiltração e Umidade',
    descricao: 'Presença indesejada de água que enfraquece o concreto e corrói a armadura de aço.',
    regras: [
      {
        nivel: 'baixo',
        sinal: 'Mancha seca ou bolhas',
        explicacao: 'Pintura descascando ou bolhas na parede em áreas úmidas sem gotejamento constante.'
      },
      {
        nivel: 'medio',
        sinal: 'Mofo e goteiras',
        explicacao: 'Mancha escura persistente, mofo espalhado ou gotejamento constante em lajes ou tetos.'
      },
      {
        nivel: 'critico',
        sinal: 'Ferro exposto e concreto caindo',
        explicacao: 'Armadura de ferro enferrujada exposta, concreto estufado descascando e caindo em pedaços.'
      }
    ]
  }
]

export function Educacao() {
  const [guiaAtivo, setGuiaAtivo] = useState(0)

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 select-none">
      
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-64 w-64 rounded-full bg-gradient-to-tr from-marca-laranja/10 to-marca-azul/10 blur-[60px]" />

      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-tinta">Como identificar riscos?</h1>
        <p className="text-tinta-suave mt-1.5 text-sm">
          Aprenda a reconhecer anomalias estruturais em sua casa e saiba quando acionar a Defesa Civil.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-borda mb-6 bg-white/40 backdrop-blur rounded-lg p-0.5 shadow-sm">
        {GUIAS.map((g, idx) => (
          <button
            key={g.titulo}
            onClick={() => setGuiaAtivo(idx)}
            className={cn(
              'flex-1 py-2 text-center text-xs font-semibold rounded-md transition-all duration-200',
              guiaAtivo === idx
                ? 'bg-marca-azul text-white shadow-sm'
                : 'text-tinta-suave hover:bg-white/50 hover:text-tinta'
            )}
          >
            {g.titulo.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Details Container */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-tinta">{GUIAS[guiaAtivo]?.titulo}</h2>
          <p className="text-tinta-suave text-xs mt-1">{GUIAS[guiaAtivo]?.descricao}</p>
        </div>

        <div className="flex flex-col gap-4">
          {GUIAS[guiaAtivo]?.regras.map((regra) => (
            <Cartao
              key={regra.nivel}
              className={cn(
                'p-4 border-l-4 transition-all duration-200 hover:shadow-md bg-white/95',
                regra.nivel === 'baixo' && 'border-l-risco-baixo',
                regra.nivel === 'medio' && 'border-l-risco-medio',
                regra.nivel === 'critico' && 'border-l-risco-critico'
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-semibold text-sm text-tinta">{regra.sinal}</span>
                <SeloRisco nivel={regra.nivel} tamanho="sm" />
              </div>
              <p className="text-xs text-tinta-suave leading-relaxed">{regra.explicacao}</p>
            </Cartao>
          ))}
        </div>

        {/* Warning card */}
        <Cartao className="bg-risco-critico-suave border-risco-critico/20 p-4 mt-2">
          <div className="flex gap-3">
            <svg className="size-5 text-risco-critico flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-xs font-bold text-risco-critico uppercase tracking-wider">Atenção!</h3>
              <p className="text-xs text-tinta mt-1 leading-relaxed">
                Em caso de risco crítico iminente, barulhos de estalo na estrutura, portas emperrando repentinamente ou muros cedendo, **saia do local imediatamente** e ligue para a Defesa Civil no número **199** ou Bombeiros no **193**.
              </p>
            </div>
          </div>
        </Cartao>
      </div>

    </div>
  )
}
