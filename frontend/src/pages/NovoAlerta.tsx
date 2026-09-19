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
import { SeloRisco } from '@/components/ui/SeloRisco'
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

  const inputRef1 = useRef<HTMLInputElement>(null)
  const inputRef2 = useRef<HTMLInputElement>(null)
  const inputRef3 = useRef<HTMLInputElement>(null)

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
          <p className="text-xs font-bold text-tinta uppercase tracking-wider">Fotos Obrigatórias</p>
          
          {/* Foto 1 */}
          <Cartao className="p-4 border-borda/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-tinta">Foto 1: Visão Geral</span>
              {!fotos[0] && <span className="text-[10px] text-risco-critico font-medium">* Obrigatória</span>}
            </div>
            <input
              ref={inputRef1}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => aoEscolherFoto(0, e.target.files?.[0])}
            />
            {previas[0] ? (
              <div className="relative">
                <img src={previas[0]} alt="Visão Geral" className="rounded-cidadao aspect-video w-full object-cover" />
                <button
                  type="button"
                  onClick={() => inputRef1.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1 rounded bg-black/60 hover:bg-black/80 text-[11px] text-white backdrop-blur font-semibold transition"
                >
                  Alterar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef1.current?.click()}
                className="w-full border-2 border-dashed border-borda/80 hover:border-marca-azul/60 rounded-cidadao p-5 flex flex-col items-center justify-center gap-1.5 transition text-tinta bg-superficie"
              >
                <svg className="size-6 text-tinta-suave" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium text-tinta-suave">Capturar foto</span>
              </button>
            )}
          </Cartao>

          {/* Foto 2 */}
          <Cartao className="p-4 border-borda/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-tinta">Foto 2: Detalhe</span>
              {!fotos[1] && <span className="text-[10px] text-risco-critico font-medium">* Obrigatória</span>}
            </div>
            <input
              ref={inputRef2}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => aoEscolherFoto(1, e.target.files?.[0])}
            />
            {previas[1] ? (
              <div className="relative">
                <img src={previas[1]} alt="Detalhe da Anomalia" className="rounded-cidadao aspect-video w-full object-cover" />
                <button
                  type="button"
                  onClick={() => inputRef2.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1 rounded bg-black/60 hover:bg-black/80 text-[11px] text-white backdrop-blur font-semibold transition"
                >
                  Alterar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef2.current?.click()}
                className="w-full border-2 border-dashed border-borda/80 hover:border-marca-azul/60 rounded-cidadao p-5 flex flex-col items-center justify-center gap-1.5 transition text-tinta bg-superficie"
              >
                <svg className="size-6 text-tinta-suave" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium text-tinta-suave">Capturar foto</span>
              </button>
            )}
          </Cartao>

          {/* Foto 3 */}
          <Cartao className="p-4 border-borda/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-tinta">Foto 3: Close-up com Escala</span>
              {!fotos[2] && <span className="text-[10px] text-risco-critico font-medium">* Obrigatória</span>}
            </div>
            <input
              ref={inputRef3}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => aoEscolherFoto(2, e.target.files?.[0])}
            />
            {previas[2] ? (
              <div className="relative">
                <img src={previas[2]} alt="Close-up" className="rounded-cidadao aspect-video w-full object-cover" />
                <button
                  type="button"
                  onClick={() => inputRef3.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1 rounded bg-black/60 hover:bg-black/80 text-[11px] text-white backdrop-blur font-semibold transition"
                >
                  Alterar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef3.current?.click()}
                className="w-full border-2 border-dashed border-borda/80 hover:border-marca-azul/60 rounded-cidadao p-5 flex flex-col items-center justify-center gap-1.5 transition text-tinta bg-superficie"
              >
                <svg className="size-6 text-tinta-suave" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium text-tinta-suave">Capturar foto</span>
              </button>
            )}
          </Cartao>
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
          <SeloRisco nivel={alerta.nivel_risco} variante="solido" confianca={alerta.confianca_ia} />
        ) : (
          <p className="text-tinta-suave text-sm">
            Sua foto foi encaminhada para análise da Defesa Civil.
          </p>
        )}

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
