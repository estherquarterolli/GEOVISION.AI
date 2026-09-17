import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cartao } from '@/components/ui/Cartao'
import { Botao } from '@/components/ui/Botao'

const ARTIGOS = [
  {
    titulo: '1. Objeto e Integração com a Defesa Civil',
    texto:
      'O GeoVision.AI é uma plataforma de triagem de riscos estruturais integrada ao painel de monitoramento da Defesa Civil. Desenvolvida no âmbito do Programa Jovens Cientistas Cariocas, ela serve como canal de alerta auxiliar. O sistema otimiza a triagem, mas não substitui o laudo técnico oficial emitido pelos engenheiros da Defesa Civil após vistoria presencial.',
  },
  {
    titulo: '2. Cadastro e Responsabilidade do Cidadão',
    texto:
      'Para utilizar a plataforma, o cidadão deve se cadastrar com nome, e-mail e bairro de residência. Ao submeter um alerta, o usuário assume total responsabilidade pela veracidade das informações. O envio de alertas falsos (trote) ou simulações maliciosas é passível de punição legal por mobilização indevida de serviços públicos de emergência.',
  },
  {
    titulo: '3. Coleta de Dados e Geolocalização',
    texto:
      'Para a correta triagem e atendimento, o aplicativo coleta: (a) 3 fotografias em diferentes ângulos da anomalia; (b) a geolocalização exata do local (coordenadas GPS); (c) data e hora do registro. A permissão de geolocalização é indispensável para que as equipes de vistoria da Defesa Civil localizem o ponto com precisão.',
  },
  {
    titulo: '4. Uso de Dados e Segurança (LGPD)',
    texto:
      'Os dados coletados são tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). O uso das informações é exclusivo para fins de segurança pública, prevenção de desastres e planejamento urbano. Nenhuma informação pessoal ou de localização é compartilhada para fins comerciais ou publicitários.',
  },
  {
    titulo: '5. Classificação por Inteligência Artificial',
    texto:
      'A plataforma emprega inteligência artificial para realizar uma estimativa inicial de risco (Baixo, Médio ou Crítico) baseada nas imagens fornecidas. Essa classificação é meramente um indicativo de urgência para a fila de atendimento da Defesa Civil. A decisão final de intervenção técnica e evacuação é sempre de caráter humano.',
  },
  {
    titulo: '6. Canais Oficiais de Emergência',
    texto:
      'O GeoVision.AI é um canal de triagem preventiva. Em situações de emergência iminente, como desabamentos em curso, deslizamento de encostas ou barulhos intensos na estrutura, o cidadão deve ligar imediatamente para o telefone de emergência 199 (Defesa Civil) ou 193 (Corpo de Bombeiros).',
  },
  {
    titulo: '7. Uso Adequado e Proibições',
    texto:
      'É estritamente proibido o uso do aplicativo para envio de fotos impróprias, imagens baixadas da internet ou reportes de riscos localizados fora da área de cobertura cadastrada.',
  },
  {
    titulo: '8. Propriedade e Licenciamento',
    texto:
      'O GeoVision.AI é propriedade intelectual desenvolvida no Programa JCC 2026. A cessão do fluxo de dados é de uso exclusivo da Defesa Civil do Rio de Janeiro para o aprimoramento dos serviços de prevenção de acidentes e desastres naturais.',
  },
]

export function TermosDeUso() {
  const [secaoAberta, setSecaoAberta] = useState<number | null>(0)

  const alternarSecao = (index: number) => {
    setSecaoAberta(secaoAberta === index ? null : index)
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      {/* Banner Oficial do Cabeçalho */}
      <div className="mb-6 overflow-hidden rounded-cidadao border border-marca-azul/10 bg-superficie shadow-card">
        <div className="bg-marca-azul p-5 text-white border-b-4 border-marca-laranja">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-marca-laranja text-lg">
              🛡️
            </div>
            <div>
              <h1 className="text-sm font-extrabold uppercase tracking-wider text-white/90">
                Política de Integração
              </h1>
              <p className="font-titulo text-lg font-bold text-white">
                Defesa Civil & GeoVision.AI
              </p>
            </div>
          </div>
        </div>
        
        {/* Info Callout */}
        <div className="border-l-4 border-marca-laranja bg-marca-laranja-suave/50 p-4 text-xs text-tinta">
          <div className="flex gap-2">
            <span className="text-base text-marca-laranja">⚠️</span>
            <div>
              <p className="font-bold text-marca-laranja-escuro mb-0.5">Aviso Importante de Serviço Público</p>
              <p className="text-tinta-suave leading-relaxed">
                Este aplicativo é uma ferramenta de triagem preventiva direta. Ao enviar um alerta com as 3 fotos solicitadas, os dados de imagem e geolocalização são registrados e transmitidos à equipe operacional da Defesa Civil para priorização de vistorias técnicas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mb-4 font-titulo text-base font-bold text-tinta">Termos e Condições de Uso</h2>

      {/* Accordion List */}
      <div className="flex flex-col gap-3">
        {ARTIGOS.map((artigo, idx) => {
          const aberto = secaoAberta === idx
          return (
            <Cartao
              key={idx}
              className={`overflow-hidden transition-all duration-200 border border-borda/60 ${
                aberto ? 'ring-1 ring-marca-azul/20 bg-superficie' : 'bg-superficie/80 hover:bg-superficie'
              }`}
            >
              <button
                type="button"
                onClick={() => alternarSecao(idx)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left font-semibold text-xs text-tinta select-none cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold rounded-full size-5 flex items-center justify-center ${
                    aberto ? 'bg-marca-azul text-white' : 'bg-marca-azul-suave text-marca-azul'
                  }`}>
                    {idx + 1}
                  </span>
                  {artigo.titulo}
                </span>
                <span className={`text-tinta-suave transition-transform duration-200 ${aberto ? 'rotate-180 text-marca-azul' : ''}`}>
                  ▼
                </span>
              </button>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  aberto ? 'max-h-[300px] border-t border-borda/40' : 'max-h-0'
                }`}
              >
                <p className="p-4 text-xs text-tinta-suave leading-relaxed bg-fundo/30">
                  {artigo.texto}
                </p>
              </div>
            </Cartao>
          )
        })}
      </div>

      {/* Cartão de Telefones de Emergência */}
      <Cartao className="mt-8 p-5 border-risco-critico/20 bg-risco-critico-suave/30 text-center flex flex-col items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-risco-critico">Situação de Risco Iminente?</h3>
          <p className="text-xs text-tinta-suave mt-1 max-w-md mx-auto">
            Em caso de ruídos na estrutura, estalos nas paredes, rachaduras que aumentam em tempo real ou deslizamentos de terra, evacue o local e ligue imediatamente:
          </p>
        </div>

        <div className="flex gap-4 w-full max-w-xs justify-center">
          <div className="flex-1 bg-white p-2.5 rounded-cidadao border border-risco-critico/25 shadow-sm">
            <span className="text-[10px] font-bold text-tinta-suave uppercase block">Defesa Civil</span>
            <span className="text-lg font-bold text-risco-critico">📞 199</span>
          </div>
          <div className="flex-1 bg-white p-2.5 rounded-cidadao border border-risco-critico/25 shadow-sm">
            <span className="text-[10px] font-bold text-tinta-suave uppercase block">Bombeiros</span>
            <span className="text-lg font-bold text-risco-critico">📞 193</span>
          </div>
        </div>
      </Cartao>

      {/* Botões de Ação */}
      <div className="mt-6 flex gap-2">
        <Link to="/cadastro" className="flex-1">
          <Botao variante="secundaria" largura="cheia">
            Voltar ao Cadastro
          </Botao>
        </Link>
        <Link to="/perfil" className="flex-1">
          <Botao variante="primaria" largura="cheia">
            Entrar no App
          </Botao>
        </Link>
      </div>

      <div className="mt-8 text-center text-[10px] text-tinta-suave">
        GeoVision.AI &bull; Programa Jovens Cientistas Cariocas 2026
      </div>
    </div>
  )
}
