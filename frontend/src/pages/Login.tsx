import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { ConfiguracaoPendente } from '@/components/ConfiguracaoPendente'
import { TerritorioAoDado } from '@/components/marca/TerritorioAoDado'

/** Mensagens da API do Supabase traduzidas — os erros nativos vêm em inglês. */
function traduzirErro(mensagem: string): string {
  if (mensagem.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (mensagem.includes('Email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.'
  }
  return mensagem
}

export function Login() {
  const { configurado, session, entrar } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!configurado) return <ConfiguracaoPendente />
  if (session) {
    const origem = (location.state as { de?: string } | null)?.de ?? '/perfil'
    return <Navigate to={origem} replace />
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : 'Falha ao entrar.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-md flex-col justify-center overflow-hidden px-5 py-10">
      <TerritorioAoDado className="pointer-events-none absolute -top-4 -right-8 h-32" />

      <h1 className="mb-1 text-2xl">Entrar</h1>
      <p className="text-tinta-suave mb-6 text-sm">
        Acesse sua conta para enviar e acompanhar alertas.
      </p>

      <Cartao className="flex flex-col gap-4 p-5">
        <form onSubmit={aoSubmeter} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="E-mail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {erro && (
            <p role="alert" className="text-risco-critico text-sm font-medium">
              {erro}
            </p>
          )}

          <Botao type="submit" largura="cheia" carregando={enviando}>
            Entrar
          </Botao>
        </form>
      </Cartao>

      <p className="text-tinta-suave mt-4 text-center text-sm">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="text-marca-azul font-medium hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
