import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Cartao } from '@/components/ui/Cartao'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { ROTULO_ANOMALIA, ROTULO_STATUS, type Alerta } from '@/types/dominio'

const FORMATADOR_DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const PASSOS = [
  {
    titulo: 'Fotografe',
    descricao: 'Toque em Reportar e tire 3 fotos do problema.',
    icone: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
    ),
  },
  {
    titulo: 'A IA classifica',
    descricao: 'Em segundos, o risco vira baixo, médio ou crítico.',
    icone: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    ),
  },
  {
    titulo: 'A Defesa Civil age',
    descricao: 'Casos críticos vão direto para a fila de vistoria.',
    icone: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12c0 4.556-3.04 8.4-7.2 9.618a1.5 1.5 0 01-1.6 0C7.04 20.4 4 16.556 4 12V6.741a1.5 1.5 0 01.9-1.374l6.75-2.813a1.5 1.5 0 011.2 0l6.75 2.813a1.5 1.5 0 01.9 1.374V12z"
      />
    ),
  },
]

const ICONE_TOTAL = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  />
)
const ICONE_ANDAMENTO = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
)
const ICONE_RESOLVIDO = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
)

export function Inicio() {
  const { usuario } = useAuth()

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas', usuario?.id],
    queryFn: async () => {
      return await apiJson<Alerta[]>('/api/alertas', {
        mensagemPadrao: 'Falha ao carregar alertas.',
      })
    },
    enabled: Boolean(usuario),
  })

  if (!usuario) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="progresso-ia w-48" />
      </div>
    )
  }

  const primeiroNome = usuario.nome.split(' ')[0]
  const total = alertas?.length ?? 0
  const ativos = alertas?.filter((a) => a.status !== 'resolvido' && a.status !== 'nao_procede').length ?? 0
  const resolvidos = alertas?.filter((a) => a.status === 'resolvido').length ?? 0
  const recentes = alertas?.slice(0, 3) ?? []

  return (
    <div className="relative mx-auto flex max-w-2xl flex-col gap-6 px-5 py-8">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-marca-laranja/10 to-marca-azul/10 blur-[60px]" />

      <header>
        <h1 className="text-2xl">Olá, {primeiroNome}! 👋</h1>
        <p className="text-tinta-suave mt-1 text-sm">Relate riscos estruturais do seu bairro em poucos toques.</p>
      </header>

      {/* Como funciona — reforça o propósito do sistema para quem chega agora */}
      <Cartao className="p-5">
        <h2 className="text-sm font-semibold">Como funciona</h2>
        <hr className="divisor-territorio mt-2 mb-4" />
        <ol className="flex flex-col gap-4">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex items-start gap-3">
              <span className="bg-marca-azul-suave text-marca-azul flex size-9 shrink-0 items-center justify-center rounded-full">
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  {passo.icone}
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium">
                  <span className="text-tinta-suave metrica mr-1.5 text-xs">{indice + 1}.</span>
                  {passo.titulo}
                </p>
                <p className="text-tinta-suave mt-0.5 text-xs leading-relaxed">{passo.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </Cartao>

      {/* Resumo rápido dos alertas do cidadão */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Cartao className="flex flex-col items-center gap-1 p-4 text-center">
            <svg className="text-tinta-suave size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {ICONE_TOTAL}
            </svg>
            <p className="metrica text-2xl">{total}</p>
            <p className="text-tinta-suave text-xs">Total</p>
          </Cartao>
          <Cartao className="flex flex-col items-center gap-1 p-4 text-center">
            <svg className="text-marca-azul size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {ICONE_ANDAMENTO}
            </svg>
            <p className="metrica text-marca-azul text-2xl">{ativos}</p>
            <p className="text-tinta-suave text-xs">Em andamento</p>
          </Cartao>
          <Cartao className="flex flex-col items-center gap-1 p-4 text-center">
            <svg className="text-risco-baixo size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {ICONE_RESOLVIDO}
            </svg>
            <p className="metrica text-risco-baixo text-2xl">{resolvidos}</p>
            <p className="text-tinta-suave text-xs">Resolvidos</p>
          </Cartao>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">Seus alertas</h2>
          {total > 3 && (
            <Link to="/perfil" className="text-marca-azul text-sm font-medium hover:underline">
              Ver todos →
            </Link>
          )}
        </div>

        {isLoading && <div className="progresso-ia" />}

        {!isLoading && total === 0 && (
          <Cartao className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">Nenhum alerta enviado ainda.</p>
            <p className="text-tinta-suave text-xs">
              Toque em <span className="text-marca-laranja font-semibold">Reportar</span> abaixo para enviar o
              primeiro.
            </p>
            <svg
              className="text-marca-laranja mt-1 size-5 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Cartao>
        )}

        {!isLoading && recentes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recentes.map((alerta) => (
              <li key={alerta.id}>
                <Cartao className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Anomalia'}
                    </p>
                    <p className="text-tinta-suave text-xs">
                      {FORMATADOR_DATA_CURTA.format(new Date(alerta.criado_em))} · {ROTULO_STATUS[alerta.status]}
                    </p>
                  </div>
                  {alerta.nivel_risco ? (
                    <SeloRisco nivel={alerta.nivel_risco} tamanho="sm" />
                  ) : (
                    <span className="text-tinta-suave text-xs">Em análise</span>
                  )}
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Cartao className="from-marca-azul-suave flex items-center gap-4 bg-gradient-to-r to-transparent p-5">
        <span className="bg-marca-laranja flex size-10 shrink-0 items-center justify-center rounded-full text-white">
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold">Sua participação transforma seu bairro!</p>
          <p className="text-tinta-suave mt-0.5 text-xs">Cada alerta ajuda a Defesa Civil a agir mais cedo.</p>
        </div>
      </Cartao>
    </div>
  )
}
