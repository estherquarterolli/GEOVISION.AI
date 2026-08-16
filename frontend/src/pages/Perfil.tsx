import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { Cartao } from '@/components/ui/Cartao'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { ROTULO_ANOMALIA, ROTULO_STATUS, type Alerta } from '@/types/dominio'

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })
const FORMATADOR_DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function Perfil() {
  const { usuario } = useAuth()

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas', usuario?.id],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001'
      const resposta = await fetch(`${API_URL}/api/alertas?usuario_id=${usuario!.id}`)
      if (!resposta.ok) throw new Error('Falha ao carregar alertas.')
      return await resposta.json() as Alerta[]
    },
    enabled: Boolean(usuario),
  })

  // RotaProtegida garante sessão; se o perfil ainda não carregou (linha em
  // `usuarios` ainda não chegou da consulta), mostra o esqueleto em vez de
  // travar num "undefined.nome".
  if (!usuario) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="progresso-ia w-48" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{usuario.nome}</h1>
          <p className="text-tinta-suave text-sm">{usuario.email}</p>
        </div>
      </div>

      <Cartao className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-tinta-suave text-xs">Bairro</p>
          <p className="text-sm font-medium">{usuario.bairro_texto ?? 'Não informado'}</p>
        </div>
        <div>
          <p className="text-tinta-suave text-xs">Conta desde</p>
          <p className="text-sm font-medium">
            {FORMATADOR_DATA.format(new Date(usuario.criado_em))}
          </p>
        </div>
        <div>
          <p className="text-tinta-suave text-xs">Perfil</p>
          <p className="text-sm font-medium capitalize">
            {usuario.papel === 'cidadao' ? 'Cidadão' : usuario.papel}
          </p>
        </div>
      </Cartao>

      <section>
        <h2 className="mb-3 text-lg">Meus alertas</h2>

        {isLoading && <div className="progresso-ia" />}

        {!isLoading && alertas?.length === 0 && (
          <Cartao className="text-tinta-suave p-8 text-center text-sm">
            Você ainda não enviou nenhum alerta.
          </Cartao>
        )}

        {!isLoading && alertas && alertas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <Cartao className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Anomalia'}
                    </p>
                    <p className="text-tinta-suave text-xs">
                      {FORMATADOR_DATA_CURTA.format(new Date(alerta.criado_em))} ·{' '}
                      {ROTULO_STATUS[alerta.status]}
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
    </div>
  )
}
