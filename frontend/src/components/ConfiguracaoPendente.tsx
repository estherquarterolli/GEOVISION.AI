import { Cartao } from '@/components/ui/Cartao'

/**
 * Mostrado no lugar de qualquer tela que dependa do Supabase (login,
 * cadastro, perfil) enquanto frontend/.env.local não existir.
 *
 * Existe para que "npm run dev" sem configuração mostre uma explicação
 * clara em vez de um formulário que erra de forma confusa em cada
 * tentativa de submit.
 */
export function ConfiguracaoPendente() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <Cartao className="border-risco-medio-suave flex flex-col gap-3 p-6">
        <h1 className="text-lg">Supabase ainda não configurado</h1>
        <p className="text-tinta-suave text-sm">
          Esta tela precisa de um projeto Supabase para funcionar. Para configurar:
        </p>
        <ol className="text-tinta-suave list-inside list-decimal space-y-1 text-sm">
          <li>
            Crie um projeto em{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="text-marca-azul underline"
            >
              supabase.com
            </a>
          </li>
          <li>
            No SQL Editor, rode as migrations de{' '}
            <code className="rounded bg-black/5 px-1">supabase/migrations/</code> em ordem
          </li>
          <li>
            Copie{' '}
            <code className="rounded bg-black/5 px-1">frontend/.env.example</code> para{' '}
            <code className="rounded bg-black/5 px-1">.env.local</code> e preencha com a URL e a
            chave anon do projeto
          </li>
          <li>Reinicie o servidor de desenvolvimento</li>
        </ol>
      </Cartao>
    </div>
  )
}
