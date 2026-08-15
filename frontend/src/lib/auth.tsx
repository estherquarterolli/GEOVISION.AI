import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
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
  session: Session | null
  usuario: Usuario | null
  cadastrar: (dados: DadosCadastro) => Promise<void>
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const ContextoAuthReact = createContext<ContextoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCarregando(false)
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession)
      if (!novaSession) {
        setUsuario(null)
        setCarregando(false)
      }
    })

    return () => assinatura.subscription.unsubscribe()
  }, [])

  // Busca o perfil (tabela `usuarios`) sempre que a sessão muda — é onde
  // vivem nome, bairro e papel, que não fazem parte do auth.users.
  useEffect(() => {
    if (!session) return

    let cancelado = false
    setCarregando(true)

    supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          console.error('Falha ao carregar perfil do usuário:', error.message)
        }
        setUsuario(data ?? null)
        setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [session])

  async function cadastrar({ nome, email, senha, bairroTexto }: DadosCadastro) {
    // termos_aceitos_em vai junto do signUp: o trigger fn_criar_perfil_usuario
    // (migration 0002) lê esses metadados para criar a linha em `usuarios` no
    // mesmo instante da conta, sem depender de sessão ativa — necessário
    // porque, com confirmação de e-mail ligada, não há sessão até o usuário
    // confirmar o e-mail.
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          bairro_texto: bairroTexto || null,
          termos_aceitos_em: new Date().toISOString(),
        },
      },
    })

    if (error) throw error
  }

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  async function sair() {
    await supabase.auth.signOut()
    setUsuario(null)
  }

  return (
    <ContextoAuthReact.Provider
      value={{ configurado: supabaseConfigurado, carregando, session, usuario, cadastrar, entrar, sair }}
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
