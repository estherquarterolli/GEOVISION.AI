import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Usuario } from '@/types/dominio'

interface DadosCadastro {
  nome: string
  email: string
  senha: string
  bairroTexto: string
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

const API_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('geovision_token')
    if (!token) {
      setCarregando(false)
      return
    }

    fetch(`${API_URL}/api/auth/me?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Token inválido')
        return res.json()
      })
      .then((user) => {
        setUsuario(user)
        setSession({ user: { id: user.id } })
      })
      .catch((err) => {
        console.error('Falha ao restaurar sessão local:', err)
        localStorage.removeItem('geovision_token')
      })
      .finally(() => {
        setCarregando(false)
      })
  }, [])

  async function cadastrar({ nome, email, senha, bairroTexto }: DadosCadastro) {
    const resposta = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, bairroTexto }),
    })

    if (!resposta.ok) {
      const erroInfo = await resposta.json().catch(() => ({}))
      throw new Error(erroInfo.detail || 'Erro ao realizar cadastro.')
    }

    const dados = await resposta.json()
    localStorage.setItem('geovision_token', dados.token)
    setUsuario(dados.usuario)
    setSession({ user: { id: dados.usuario.id } })
  }

  async function entrar(email: string, senha: string) {
    const resposta = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })

    if (!resposta.ok) {
      const erroInfo = await resposta.json().catch(() => ({}))
      throw new Error(erroInfo.detail || 'E-mail ou senha incorretos.')
    }

    const dados = await resposta.json()
    localStorage.setItem('geovision_token', dados.token)
    setUsuario(dados.usuario)
    setSession({ user: { id: dados.usuario.id } })
  }

  async function sair() {
    localStorage.removeItem('geovision_token')
    setSession(null)
    setUsuario(null)
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
