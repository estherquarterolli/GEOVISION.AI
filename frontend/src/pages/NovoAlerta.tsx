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
import { ROTULO_ANOMALIA, type Alerta, type TipoAnomalia } from '@/types/dominio'

export function NovoAlerta() {
  const { usuario } = useAuth()
  const geo = useGeolocalizacao()
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const [foto, setFoto] = useState<File | null>(null)
  const [previaFoto, setPreviaFoto] = useState<string | null>(null)
  const [tipoAnomalia, setTipoAnomalia] = useState<TipoAnomalia | ''>('')
  const [descricao, setDescricao] = useState('')
  const [enderecoManual, setEnderecoManual] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [alertaEnviado, setAlertaEnviado] = useState<Alerta | null>(null)

  // Libera a URL de preview anterior ao trocar de foto — do contrário cada
  // troca vaza um object URL até a página inteira ser recarregada.
  useEffect(() => {
    return () => {
      if (previaFoto) URL.revokeObjectURL(previaFoto)
    }
  }, [previaFoto])

  function aoEscolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    if (previaFoto) URL.revokeObjectURL(previaFoto)
    setFoto(arquivo)
    setPreviaFoto(URL.createObjectURL(arquivo))
  }

  const precisaEnderecoManual = geo.estado === 'negada' || geo.estado === 'indisponivel'
  const temLocalizacao = geo.estado === 'concedida' || (precisaEnderecoManual && enderecoManual.trim().length > 3)
  const podeEnviar = Boolean(foto && tipoAnomalia && temLocalizacao)

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    if (!usuario || !foto || !tipoAnomalia) return

    setErro(null)
    setEnviando(true)
    try {
      const resultado = await enviarAlerta({
        usuarioId: usuario.id,
        foto,
        tipoAnomalia,
        descricao,
        coordenadas: geo.estado === 'concedida' ? geo.coordenadas : null,
        enderecoManual: precisaEnderecoManual ? enderecoManual.trim() : null,
      })
      setAlertaEnviado(resultado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o alerta. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setFoto(null)
    setPreviaFoto(null)
    setTipoAnomalia('')
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
      <p className="text-tinta-suave mb-6 text-sm">
        Fotografe a rachadura, muro inclinado ou infiltração. A Defesa Civil recebe o
        alerta com sua localização.
      </p>

      <form onSubmit={aoSubmeter} className="flex flex-col gap-5" noValidate>
        <Cartao className="p-5">
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-label="Foto da anomalia"
            onChange={(e) => aoEscolherFoto(e.target.files?.[0])}
          />

          {previaFoto ? (
            <div className="flex flex-col gap-3">
              <img
                src={previaFoto}
                alt="Prévia da foto do alerta"
                className="rounded-cidadao aspect-video w-full object-cover"
              />
              <Botao
                type="button"
                variante="fantasma"
                largura="cheia"
                onClick={() => inputFotoRef.current?.click()}
              >
                Trocar foto
              </Botao>
            </div>
          ) : (
            <Botao
              type="button"
              variante="secundaria"
              largura="cheia"
              onClick={() => inputFotoRef.current?.click()}
            >
              Tirar ou escolher foto
            </Botao>
          )}
        </Cartao>

        <Select
          rotulo="Tipo de anomalia"
          required
          value={tipoAnomalia}
          onChange={(e) => setTipoAnomalia(e.target.value as TipoAnomalia)}
        >
          <option value="" disabled>
            Selecione
          </option>
          {(Object.entries(ROTULO_ANOMALIA) as [TipoAnomalia, string][]).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>

        <Textarea
          rotulo="Descrição (opcional)"
          placeholder="Ex.: rachadura na parede que aumentou depois da chuva"
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
