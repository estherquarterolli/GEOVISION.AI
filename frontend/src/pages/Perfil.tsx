import { useAuth } from '@/lib/auth'
import { Cartao } from '@/components/ui/Cartao'

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

export function Perfil() {
  const { usuario } = useAuth()

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
      <div>
        <h1 className="text-2xl">{usuario.nome}</h1>
        <p className="text-tinta-suave text-sm">{usuario.email}</p>
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
        <Cartao className="text-tinta-suave p-8 text-center text-sm">
          Você ainda não enviou nenhum alerta.
          <br />
          O envio de fotos chega no próximo sprint de desenvolvimento.
        </Cartao>
      </section>
    </div>
  )
}
