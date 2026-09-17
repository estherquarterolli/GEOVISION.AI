import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  apiJson,
  EVENTO_SESSAO_EXPIRADA,
  guardarToken,
  limparToken,
  obterToken,
} from '@/lib/api'
import type { Usuario } from '@/types/dominio'

interface DadosCadastro {
  nome: string
  email: string
  senha: string
  bairroTexto: string
}

interface RespostaAuth {
  usuario: Usuario
  token: string
}

interface ContextoAuth {
  configurado: boolean
  carregando: boolean
  session: any | null
  usuario: Usuario | null
  cadastrar: (dados: DadosCadastro) => Promise<void>
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const ContextoAuthReact = createContext<ContextoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const encerrarSessao = useCallback(() => {
    limparToken()
    setSession(null)
    setUsuario(null)
  }, [])

  // O token agora expira (72h por padrão). Sem ouvir isto, a interface
  // continuaria mostrando o usuário logado enquanto toda requisição falha.
  useEffect(() => {
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessao)
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, encerrarSessao)
  }, [encerrarSessao])

  useEffect(() => {
    if (!obterToken()) {
      setCarregando(false)
      return
    }

    apiJson<Usuario>('/api/auth/me')
      .then((user) => {
        setUsuario(user)
        setSession({ user: { id: user.id } })
      })
      .catch((err) => {
        console.error('Falha ao restaurar sessão local:', err)
        limparToken()
      })
      .finally(() => {
        setCarregando(false)
      })
  }, [])

  function aplicarSessao(dados: RespostaAuth) {
    guardarToken(dados.token)
    setUsuario(dados.usuario)
    setSession({ user: { id: dados.usuario.id } })
  }

  async function cadastrar({ nome, email, senha, bairroTexto }: DadosCadastro) {
    aplicarSessao(
      await apiJson<RespostaAuth>('/api/auth/signup', {
        method: 'POST',
        autenticado: false,
        mensagemPadrao: 'Erro ao realizar cadastro.',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, bairroTexto }),
      }),
    )
  }

  async function entrar(email: string, senha: string) {
    aplicarSessao(
      await apiJson<RespostaAuth>('/api/auth/login', {
        method: 'POST',
        autenticado: false,
        mensagemPadrao: 'E-mail ou senha incorretos.',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      }),
    )
  }

  async function sair() {
    encerrarSessao()
  }

  return (
    <ContextoAuthReact.Provider
      value={{ configurado: true, carregando, session, usuario, cadastrar, entrar, sair }}
    >
      {children}
    </ContextoAuthReact.Provider>
  )
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(ContextoAuthReact)
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return contexto
}
