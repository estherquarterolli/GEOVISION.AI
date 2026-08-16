import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import logoImg from '@/assets/logo.jpg'

export function Login() {
  const { session, entrar } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

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
      setErro(e instanceof Error ? e.message : 'Falha ao entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[85vh] max-w-md flex-col justify-center px-5 py-10 select-none">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-72 w-72 rounded-full bg-gradient-to-tr from-marca-laranja/15 to-marca-azul/10 blur-[60px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-60 w-60 rounded-full bg-marca-azul/10 blur-[65px]" />

      <div className="flex flex-col items-center mb-8 text-center">
        <div className="relative group mb-4">
          {/* Subtle colored shadow border glow */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-marca-laranja to-marca-azul opacity-30 blur-md transition duration-500 group-hover:opacity-60" />
          <img
            src={logoImg}
            alt="GeoVision.AI Logo"
            className="relative h-20 w-20 rounded-2xl border border-borda/40 bg-white object-contain p-1 shadow-md transition duration-300 group-hover:scale-105"
          />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
          GeoVision<span className="text-marca-laranja">.AI</span>
        </h1>
        <p className="text-tinta-suave mt-1.5 text-sm max-w-[280px]">
          Plataforma de mapeamento de riscos e alerta estrutural
        </p>
      </div>

      <Cartao className="bg-white/95 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl transition-shadow p-6 sm:p-8 flex flex-col gap-5">
        <form onSubmit={aoSubmeter} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="E-mail"
            type="email"
            required
            placeholder="seu@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {erro && (
            <p role="alert" className="text-risco-critico text-sm font-medium">
              {erro}
            </p>
          )}

          <Botao type="submit" largura="cheia" variante="secundaria" carregando={enviando} className="mt-2 relative overflow-hidden group">
            <span className="absolute inset-0 bg-gradient-to-r from-marca-azul to-marca-petroleo opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10">Entrar</span>
          </Botao>
        </form>
      </Cartao>

      <p className="text-tinta-suave mt-6 text-center text-sm">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="text-marca-azul font-semibold hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
