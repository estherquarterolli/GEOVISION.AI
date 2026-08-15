import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { Checkbox } from '@/components/ui/Checkbox'
import { ConfiguracaoPendente } from '@/components/ConfiguracaoPendente'

const SENHA_MINIMA = 6

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('User already registered') || mensagem.includes('already registered')) {
    return 'Já existe uma conta com este e-mail. Tente entrar.'
  }
  if (mensagem.includes('Password should be at least')) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  }
  if (mensagem.includes('Unable to validate email address')) {
    return 'E-mail inválido.'
  }
  return mensagem
}

export function Cadastro() {
  const { configurado, session, cadastrar } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [bairro, setBairro] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cadastroFeito, setCadastroFeito] = useState(false)

  if (!configurado) return <ConfiguracaoPendente />
  if (session) return <Navigate to="/perfil" replace />

  function validar(): boolean {
    const proximosErros: Record<string, string> = {}

    if (nome.trim().length < 2) proximosErros.nome = 'Digite seu nome completo.'
    if (senha.length < SENHA_MINIMA) {
      proximosErros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
    }
    if (confirmarSenha !== senha) proximosErros.confirmarSenha = 'As senhas não coincidem.'
    if (!aceitouTermos) proximosErros.termos = 'É preciso aceitar os Termos de Uso para continuar.'

    setErros(proximosErros)
    return Object.keys(proximosErros).length === 0
  }

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    setErroGeral(null)
    if (!validar()) return

    setEnviando(true)
    try {
      await cadastrar({ nome: nome.trim(), email, senha, bairroTexto: bairro.trim() })
      setCadastroFeito(true)
    } catch (e) {
      setErroGeral(traduzirErro(e instanceof Error ? e.message : 'Falha ao criar conta.'))
    } finally {
      setEnviando(false)
    }
  }

  if (cadastroFeito) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <Cartao className="flex flex-col gap-3 p-6 text-center">
          <h1 className="text-lg">Confira seu e-mail</h1>
          <p className="text-tinta-suave text-sm">
            Enviamos um link de confirmação para <strong className="text-tinta">{email}</strong>.
            Confirme para poder entrar.
          </p>
          <Link to="/entrar" className="text-marca-azul mt-2 text-sm font-medium hover:underline">
            Ir para a tela de login
          </Link>
        </Cartao>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-2xl">Criar conta</h1>
      <p className="text-tinta-suave mb-6 text-sm">
        Leva menos de um minuto. Você vai poder enviar e acompanhar alertas de risco.
      </p>

      <Cartao className="p-5">
        <form onSubmit={aoSubmeter} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Nome completo"
            required
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            erro={erros.nome}
          />
          <Campo
            rotulo="E-mail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Bairro"
            ajuda="Usamos para mostrar os riscos mapeados perto de você."
            placeholder="Engenho de Dentro"
            autoComplete="address-level3"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            type="password"
            required
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
          />
          <Campo
            rotulo="Confirmar senha"
            type="password"
            required
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            erro={erros.confirmarSenha}
          />

          <Checkbox
            checked={aceitouTermos}
            onChange={(e) => setAceitouTermos(e.target.checked)}
            erro={erros.termos}
            rotulo={
              <>
                Li e aceito os{' '}
                <Link
                  to="/termos"
                  target="_blank"
                  className="text-marca-azul underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Termos de Uso e Política de Privacidade
                </Link>
                .
              </>
            }
          />

          {erroGeral && (
            <p role="alert" className="text-risco-critico text-sm font-medium">
              {erroGeral}
            </p>
          )}

          <Botao type="submit" largura="cheia" carregando={enviando}>
            Criar conta
          </Botao>
        </form>
      </Cartao>

      <p className="text-tinta-suave mt-4 text-center text-sm">
        Já tem conta?{' '}
        <Link to="/entrar" className="text-marca-azul font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
