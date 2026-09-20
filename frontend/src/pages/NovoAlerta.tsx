import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useGeolocalizacao } from '@/hooks/useGeolocalizacao'
import { enviarAlerta } from '@/services/alertas'
import { Botao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Campo } from '@/components/ui/Campo'
import {
  ROTULO_ANOMALIA,
  ROTULO_GRAVIDADE,
  ROTULO_TEMPO,
  ROTULO_EVOLUCAO,
  ROTULO_LOCAL,
  ROTULO_RUIDO,
  type Alerta,
  type TipoAnomalia
} from '@/types/dominio'

export function NovoAlerta() {
  const { usuario } = useAuth()
  const geo = useGeolocalizacao()

  const cameraRef1 = useRef<HTMLInputElement>(null)
  const galeriaRef1 = useRef<HTMLInputElement>(null)
  const cameraRef2 = useRef<HTMLInputElement>(null)
  const galeriaRef2 = useRef<HTMLInputElement>(null)
  const cameraRef3 = useRef<HTMLInputElement>(null)
  const galeriaRef3 = useRef<HTMLInputElement>(null)

  const [fotos, setFotos] = useState<(File | null)[]>([null, null, null])
  const [previas, setPrevias] = useState<(string | null)[]>([null, null, null])

  const [tipoAnomalia, setTipoAnomalia] = useState<TipoAnomalia | ''>('')
  const [localAnomalia, setLocalAnomalia] = useState('')
  const [tempoSurgimento, setTempoSurgimento] = useState('')
  const [evolucao, setEvolucao] = useState('')
  const [gravidadePercebida, setGravidadePercebida] = useState('')
  const [ruidoPercebido, setRuidoPercebido] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enderecoManual, setEnderecoManual] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [alertaEnviado, setAlertaEnviado] = useState<Alerta | null>(null)

  // Libera as URLs de preview ao trocar de foto ou desmontar
  useEffect(() => {
    return () => {
      previas.forEach((p) => {
        if (p) URL.revokeObjectURL(p)
      })
    }
  }, [previas])

  function aoEscolherFoto(indice: number, arquivo: File | undefined) {
    if (!arquivo) return
    const novasFotos = [...fotos]
    novasFotos[indice] = arquivo
    setFotos(novasFotos)

    const novasPrevias = [...previas]
    if (novasPrevias[indice]) URL.revokeObjectURL(novasPrevias[indice]!)
    novasPrevias[indice] = URL.createObjectURL(arquivo)
    setPrevias(novasPrevias)
  }

  function aoRemoverFoto(indice: number) {
    const novasFotos = [...fotos]
    novasFotos[indice] = null
    setFotos(novasFotos)

    const novasPrevias = [...previas]
    if (novasPrevias[indice]) {
      URL.revokeObjectURL(novasPrevias[indice]!)
      novasPrevias[indice] = null
    }
    setPrevias(novasPrevias)
  }

  const precisaEnderecoManual = geo.estado === 'negada' || geo.estado === 'indisponivel'
  const temLocalizacao = geo.estado === 'concedida' || (precisaEnderecoManual && enderecoManual.trim().length > 3)
  const podeEnviar = Boolean(fotos[0] && fotos[1] && fotos[2] && tipoAnomalia && temLocalizacao)

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    if (!usuario || !fotos[0] || !fotos[1] || !fotos[2] || !tipoAnomalia) return

    setErro(null)
    setEnviando(true)
    try {
      const resultado = await enviarAlerta({
        fotos: fotos.filter(Boolean) as File[],
        tipoAnomalia,
        descricao,
        coordenadas: geo.estado === 'concedida' ? geo.coordenadas : null,
        enderecoManual: precisaEnderecoManual ? enderecoManual.trim() : null,
        gravidadePercebida: gravidadePercebida || undefined,
        tempoSurgimento: tempoSurgimento || undefined,
        evolucao: evolucao || undefined,
        localAnomalia: localAnomalia || undefined,
        ruidoPercebido: ruidoPercebido || undefined,
      })
      setAlertaEnviado(resultado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o alerta. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setFotos([null, null, null])
    setPrevias([null, null, null])
    setTipoAnomalia('')
    setLocalAnomalia('')
    setTempoSurgimento('')
    setEvolucao('')
    setGravidadePercebida('')
    setRuidoPercebido('')
    setDescricao('')
    setEnderecoManual('')
    setErro(null)
    setAlertaEnviado(null)
  }

  if (alertaEnviado) {
    return <TelaConfirmacao alerta={alertaEnviado} aoReiniciar={reiniciar} />
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-2xl">Novo alerta</h1>
      <p className="text-tinta-suave mb-6 text-sm">Fotografe o problema e envie para a Defesa Civil.</p>

      {/* Guia de Fotos Estilizado */}
      <div className="mb-6 rounded-cidadao border border-marca-azul/20 bg-marca-azul/5 p-4 text-sm text-tinta">
        <h2 className="mb-2 font-bold text-marca-azul flex items-center gap-1.5">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Instruções: 3 Fotos Obrigatórias
        </h2>
        <p className="text-tinta-suave text-xs mb-3.5">3 fotos, 3 distâncias — assim a IA consegue triar o risco:</p>

        <figure className="mb-4 overflow-hidden rounded-cidadao border border-marca-azul/20 bg-superficie shadow-sm">
          <a
            href="/exemplo-fotos-fissura.webp"
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir o exemplo de fotos em tamanho maior"
          >
            <img
              src="/exemplo-fotos-fissura.webp"
              alt="Exemplo da mesma fissura fotografada de longe, a uma distância intermediária e em close-up"
              className="aspect-[3/2] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </a>
          <figcaption className="grid grid-cols-3 divide-x divide-borda border-t border-borda text-center">
            <span className="px-1 py-2 text-[10px] leading-tight text-tinta-suave">
              <strong className="block text-tinta">1. Geral</strong>
              2 a 3 metros
            </span>
            <span className="px-1 py-2 text-[10px] leading-tight text-tinta-suave">
              <strong className="block text-tinta">2. Detalhe</strong>
              aproximadamente 1 metro
            </span>
            <span className="px-1 py-2 text-[10px] leading-tight text-tinta-suave">
              <strong className="block text-tinta">3. Close-up</strong>
              aproximadamente 30 cm
            </span>
          </figcaption>
        </figure>

        <p className="mb-3.5 rounded-cidadao bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-tinta-suave dark:bg-white/5">
          Fotografe <strong className="text-tinta">a mesma anomalia</strong> nas três
          distâncias. No close-up, coloque uma moeda, caneta ou régua ao lado da
          fissura para indicar a escala, sempre que isso puder ser feito com segurança.
          Toque na imagem para ampliar.
        </p>

        <div className="flex flex-col gap-3.5 mt-2">
          <div className="flex gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marca-azul text-[11px] font-bold text-white">1</div>
            <div>
              <p className="font-semibold text-xs text-tinta">Visão Geral (Contexto)</p>
              <p className="text-[11px] text-tinta-suave">Foto de longe (2-3m) mostrando a estrutura inteira onde está o risco.</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marca-azul text-[11px] font-bold text-white">2</div>
            <div>
              <p className="font-semibold text-xs text-tinta">Detalhe da Anomalia</p>
              <p className="text-[11px] text-tinta-suave">Foto média (1m) focando especificamente na trinca, vazamento ou inclinação.</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marca-azul text-[11px] font-bold text-white">3</div>
            <div>
              <p className="font-semibold text-xs text-tinta">Close-up com Escala</p>
              <p className="text-[11px] text-tinta-suave">Foto de muito perto (30cm), posicionando uma caneta, dedo ou moeda ao lado do risco para dar escala.</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={aoSubmeter} className="flex flex-col gap-5" noValidate>
        
        {/* Bloco de Upload de Imagens */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-tinta uppercase tracking-wider">3 Fotos Obrigatórias</p>
            <span className="text-xs text-tinta-suave">
              {fotos.filter(Boolean).length} de 3 selecionadas
            </span>
          </div>

          {[
            {
              indice: 0,
              titulo: 'Foto 1: Visão Geral',
              subtitulo: 'Contexto amplo (2 a 3m)',
              cameraRef: cameraRef1,
              galeriaRef: galeriaRef1,
            },
            {
              indice: 1,
              titulo: 'Foto 2: Detalhe',
              subtitulo: 'Foco na anomalia (~1m)',
              cameraRef: cameraRef2,
              galeriaRef: galeriaRef2,
            },
            {
              indice: 2,
              titulo: 'Foto 3: Close-up com Escala',
              subtitulo: 'Aproximada com referência (~30cm)',
              cameraRef: cameraRef3,
              galeriaRef: galeriaRef3,
            },
          ].map(({ indice, titulo, subtitulo, cameraRef, galeriaRef }) => {
            const fotoAtual = fotos[indice]
            const previaAtual = previas[indice]

            return (
              <Cartao key={indice} className="p-4 border-borda/60">
                {/* Inputs ocultos: um para acionar a câmera e outro para a galeria */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    aoEscolherFoto(indice, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <input
                  ref={galeriaRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                  className="hidden"
                  onChange={(e) => {
                    aoEscolherFoto(indice, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />

                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-semibold text-tinta">{titulo}</span>
                    <span className="text-[11px] text-tinta-suave ml-2">({subtitulo})</span>
                  </div>
                  {fotoAtual ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      ✓ Pronta
                    </span>
                  ) : (
                    <span className="text-[10px] text-risco-critico font-medium">* Obrigatória</span>
                  )}
                </div>

                {previaAtual ? (
                  <div className="relative rounded-cidadao overflow-hidden border border-borda">
                    <img
                      src={previaAtual}
                      alt={titulo}
                      className="aspect-video w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between gap-2 backdrop-blur-[2px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => cameraRef.current?.click()}
                          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[11px] text-white font-medium transition flex items-center gap-1"
                          title="Tirar outra foto com a câmera"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Câmera
                        </button>
                        <button
                          type="button"
                          onClick={() => galeriaRef.current?.click()}
                          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[11px] text-white font-medium transition flex items-center gap-1"
                          title="Escolher outra imagem da galeria"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Galeria
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => aoRemoverFoto(indice)}
                        className="px-2 py-1 rounded bg-rose-500/80 hover:bg-rose-600 text-[11px] text-white font-medium transition flex items-center gap-1"
                        title="Remover foto"
                      >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      className="border-2 border-dashed border-borda/80 hover:border-marca-azul/60 hover:bg-marca-azul/5 rounded-cidadao p-4 flex flex-col items-center justify-center gap-1.5 transition text-tinta bg-superficie group"
                    >
                      <div className="size-8 rounded-full bg-marca-azul/10 text-marca-azul flex items-center justify-center group-hover:scale-110 transition">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-tinta">Tirar foto</span>
                      <span className="text-[10px] text-tinta-suave">Abrir câmera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galeriaRef.current?.click()}
                      className="border-2 border-dashed border-borda/80 hover:border-marca-azul/60 hover:bg-marca-azul/5 rounded-cidadao p-4 flex flex-col items-center justify-center gap-1.5 transition text-tinta bg-superficie group"
                    >
                      <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-tinta">Galeria</span>
                      <span className="text-[10px] text-tinta-suave">Importar mídia</span>
                    </button>
                  </div>
                )}
              </Cartao>
            )
          })}
        </div>

        {/* Informações adicionais do Morador */}
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-xs font-bold text-tinta uppercase tracking-wider">Sessão de Triagem do Morador</p>
          
          <Select
            rotulo="Tipo de anomalia"
            required
            value={tipoAnomalia}
            onChange={(e) => setTipoAnomalia(e.target.value as TipoAnomalia)}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {(Object.entries(ROTULO_ANOMALIA) as [TipoAnomalia, string][]).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>

          <Select
            rotulo="Onde está localizada a anomalia?"
            value={localAnomalia}
            onChange={(e) => setLocalAnomalia(e.target.value)}
          >
            <option value="">Selecione...</option>
            {Object.entries(ROTULO_LOCAL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>

          <Select
            rotulo="Há quanto tempo surgiu?"
            value={tempoSurgimento}
            onChange={(e) => setTempoSurgimento(e.target.value)}
          >
            <option value="">Selecione...</option>
            {Object.entries(ROTULO_TEMPO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>

          <Select
            rotulo="Qual a evolução percebida?"
            value={evolucao}
            onChange={(e) => setEvolucao(e.target.value)}
          >
            <option value="">Selecione...</option>
            {Object.entries(ROTULO_EVOLUCAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>

          <Select
            rotulo="Gravidade estimada (sua percepção)"
            value={gravidadePercebida}
            onChange={(e) => setGravidadePercebida(e.target.value)}
          >
            <option value="">Selecione...</option>
            {Object.entries(ROTULO_GRAVIDADE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>

          <Select
            rotulo="Você notou algum barulho ou vibração no local?"
            value={ruidoPercebido}
            onChange={(e) => setRuidoPercebido(e.target.value)}
          >
            <option value="">Selecione...</option>
            {Object.entries(ROTULO_RUIDO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          rotulo="Descrição e observações adicionais (opcional)"
          placeholder="Ex.: a trinca aumenta quando passam caminhões pesados na rua ou depois de chuvas fortes."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <BlocoLocalizacao
          geo={geo}
          precisaEnderecoManual={precisaEnderecoManual}
          enderecoManual={enderecoManual}
          setEnderecoManual={setEnderecoManual}
        />

        {erro && (
          <p role="alert" className="text-risco-critico text-sm font-medium">
            {erro}
          </p>
        )}

        <Botao type="submit" largura="cheia" disabled={!podeEnviar} carregando={enviando}>
          Enviar alerta
        </Botao>
      </form>
    </div>
  )
}

interface BlocoLocalizacaoProps {
  geo: ReturnType<typeof useGeolocalizacao>
  precisaEnderecoManual: boolean
  enderecoManual: string
  setEnderecoManual: (valor: string) => void
}

function BlocoLocalizacao({
  geo,
  precisaEnderecoManual,
  enderecoManual,
  setEnderecoManual,
}: BlocoLocalizacaoProps) {
  if (geo.estado === 'concedida') {
    return (
      <Cartao className="border-risco-baixo-suave p-4">
        <p className="text-sm font-medium">📍 Localização capturada</p>
        <p className="text-tinta-suave metrica mt-0.5 text-xs">
          {geo.coordenadas?.latitude.toFixed(5)}, {geo.coordenadas?.longitude.toFixed(5)}
        </p>
      </Cartao>
    )
  }

  if (precisaEnderecoManual) {
    return (
      <Campo
        rotulo="Endereço"
        required
        ajuda="Não conseguimos acessar sua localização. Digite o endereço para a Defesa Civil encontrar o local."
        placeholder="Rua, número, bairro"
        value={enderecoManual}
        onChange={(e) => setEnderecoManual(e.target.value)}
      />
    )
  }

  return (
    <Cartao className="flex flex-col gap-3 p-4">
      <p className="text-sm">
        Sua localização exata ajuda a Defesa Civil a chegar mais rápido.
      </p>
      <Botao
        type="button"
        variante="fantasma"
        carregando={geo.estado === 'solicitando'}
        onClick={geo.solicitar}
        className="self-start"
      >
        Permitir localização
      </Botao>
    </Cartao>
  )
}

interface TelaConfirmacaoProps {
  alerta: Alerta
  aoReiniciar: () => void
}

function TelaConfirmacao({ alerta, aoReiniciar }: TelaConfirmacaoProps) {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <Cartao className="flex flex-col items-center gap-4 p-6 text-center">
        <h1 className="text-lg">Alerta enviado</h1>

        {alerta.nivel_risco ? (
          <div className="w-full rounded-cidadao border border-marca-azul/20 bg-marca-azul/5 p-4 text-left">
            <p className="text-sm font-semibold text-tinta">Triagem automática concluída</p>
            <p className="mt-1 text-xs leading-relaxed text-tinta-suave">
              O resultado da IA é preliminar e será usado apenas para organizar a
              análise da Defesa Civil.
            </p>
          </div>
        ) : (
          <p className="text-tinta-suave text-sm">
            Suas fotos foram encaminhadas para análise da Defesa Civil.
          </p>
        )}

        <p className="rounded-cidadao bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Se houver queda de material, estalos, movimentação visível ou perigo
          imediato, afaste-se do local e ligue para a Defesa Civil (199) ou para
          os Bombeiros (193), independentemente do resultado automático.
        </p>

        <p className="text-tinta-suave text-sm">
          Você pode acompanhar o status deste alerta no seu perfil.
        </p>

        <div className="mt-2 flex w-full gap-2">
          <Link to="/perfil" className="w-full">
            <Botao variante="fantasma" largura="cheia">
              Ver meu perfil
            </Botao>
          </Link>
          <Botao variante="primaria" largura="cheia" onClick={aoReiniciar}>
            Enviar outro
          </Botao>
        </div>
      </Cartao>
    </div>
  )
}
