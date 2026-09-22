import { useState, useEffect, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import logoImg from '@/assets/logo.jpg'
import logoDefesaCivil from '@/assets/logo-defesa-civil-rj.png'

const MAX_TENTATIVAS = 3
const TEMPO_BLOQUEIO_SEGUNDOS = 30

export function AdminLogin() {
  const { session, usuario, entrar, sair } = useAuth()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [tentativasFalhas, setTentativasFalhas] = useState(0)
  const [tempoBloqueio, setTempoBloqueio] = useState(0)

  // Temporizador para bloqueio por tentativas excessivas
  useEffect(() => {
    let timer: any
    if (tempoBloqueio > 0) {
      timer = setInterval(() => {
        setTempoBloqueio((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [tempoBloqueio])

  // A chamada precisa vir antes de qualquer retorno condicional. Depois de
  // autenticar, a tela redireciona; deixá-la abaixo desse retorno fazia o
  // React renderizar menos hooks e derrubava o painel em produção.
  useEffect(() => {
    if (session && usuario && usuario.papel === 'cidadao') {
      sair().then(() => {
        setErro('ACESSO RESTRITO: Esta credencial não possui permissão de administrador. A sessão foi revogada.')
      })
    }
  }, [session, usuario, sair])

  // Se já autenticado como admin ou defesa civil, redireciona para o painel
  if (session && usuario && (usuario.papel === 'admin' || usuario.papel === 'defesa_civil')) {
    return <Navigate to="/painel" replace />
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    if (tempoBloqueio > 0) return

    setErro(null)
    setEnviando(true)

    try {
      await entrar(email.trim(), senha)

      // Nota: o entrar atualiza o estado de usuario na próxima renderização,
      // mas verificamos também no fluxo ou o efeito de redirecionamento cuidará disso.
    } catch (e) {
      const novasTentativas = tentativasFalhas + 1
      setTentativasFalhas(novasTentativas)

      if (novasTentativas >= MAX_TENTATIVAS) {
        setTempoBloqueio(TEMPO_BLOQUEIO_SEGUNDOS)
        setTentativasFalhas(0)
        setErro(`Limite de tentativas excedido por segurança. Aguarde ${TEMPO_BLOQUEIO_SEGUNDOS} segundos.`)
      } else {
        const restantes = MAX_TENTATIVAS - novasTentativas
        setErro(
          (e instanceof Error ? e.message : 'Credenciais de administrador inválidas.') +
            ` (${restantes} tentativa${restantes > 1 ? 's restantes' : ' restante'})`
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  const bloqueado = tempoBloqueio > 0

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-10 selection:bg-cyan-500 selection:text-white">
      {/* Background Cybernetic Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-96 w-96 rounded-full bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-emerald-500/10 blur-[100px]" />
      <div className="absolute bottom-10 right-10 -z-10 h-64 w-64 rounded-full bg-cyan-900/20 blur-[80px]" />

      {/* Grid pattern decorativo */}
      <div className="absolute inset-0 -z-10 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="w-full max-w-md">
        {/* Header Institucional */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="mb-5 flex w-full items-center justify-center gap-2 sm:gap-6">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-60 blur-md transition duration-500 group-hover:opacity-100" />
              <div className="relative size-16 rounded-2xl border border-cyan-400/40 bg-white p-1.5 shadow-2xl sm:size-18">
                <img
                  src={logoImg}
                  alt="GeoVision.AI"
                  className="size-full rounded-xl object-contain"
                />
              </div>
            </div>

            <span aria-hidden="true" className="h-12 w-px bg-slate-700" />

            <img
              src={logoDefesaCivil}
              alt="Defesa Civil do Estado do Rio de Janeiro"
              className="h-auto w-[190px] max-w-[58%] object-contain sm:w-[240px] sm:max-w-none"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            GeoVision<span className="text-cyan-400 font-mono">::ADMIN</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Autenticação segura de gestão, Defesa Civil e supervisão de IA
          </p>
        </div>

        {/* Card de Formulário */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8 flex flex-col gap-5">
          <form onSubmit={aoSubmeter} className="flex flex-col gap-4.5" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono uppercase tracking-wider">
                E-mail Administrativo
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={bloqueado}
                  placeholder="admin@geovision.ai"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition disabled:opacity-50 font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
                  Chave de Acesso (Senha)
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                >
                  {mostrarSenha ? 'Ocultar' : 'Exibir'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  disabled={bloqueado}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition disabled:opacity-50 font-mono"
                />
              </div>
            </div>

            {/* Aviso de Erro ou Bloqueio */}
            {erro && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-start gap-2 backdrop-blur">
                <svg className="size-4 shrink-0 text-rose-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{erro}</span>
              </div>
            )}

            {bloqueado && (
              <div className="text-center py-2 text-xs font-mono text-amber-400 font-semibold bg-amber-950/40 border border-amber-500/30 rounded-xl">
                🔒 Bloqueio temporário ativo: {tempoBloqueio}s
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || bloqueado}
              className="mt-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-900/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {enviando ? (
                <>
                  <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Validando Credenciais...</span>
                </>
              ) : (
                <>
                  <span>Autenticar no Painel de Controle</span>
                  <svg className="size-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Badges de Auditoria e Segurança */}
          <div className="mt-2 pt-4 border-t border-slate-800/80 flex flex-col gap-2 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Criptografia SHA-256 / Bcrypt</span>
              </span>
              <span className="text-slate-500">Sessão Auditada</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Todas as tentativas de acesso a esta interface são registradas para conformidade e segurança da rede.
            </p>
          </div>
        </div>

        {/* Link para login de cidadão */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Você é um cidadão ou morador?{' '}
          <Link to="/entrar" className="text-cyan-400 hover:text-cyan-300 font-medium hover:underline">
            Acessar o portal público
          </Link>
        </div>
      </div>
    </div>
  )
}
