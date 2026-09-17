import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { Checkbox } from '@/components/ui/Checkbox'
import logoImg from '@/assets/logo.jpg'

// Precisa acompanhar o mínimo do backend (app/routers/auth.py). Com um
// número menor aqui, o cadastro passaria na validação da tela e só falharia
// no servidor, devolvendo a mensagem crua do Pydantic em inglês.
const SENHA_MINIMA = 8

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('User already registered') || mensagem.includes('already registered')) {
    return 'Já existe uma conta com este e-mail. Tente entrar.'
  }
  if (
    mensagem.includes('Password should be at least') ||
    mensagem.includes('String should have at least')
  ) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  }
  if (
    mensagem.includes('Unable to validate email address') ||
    mensagem.includes('value is not a valid email address')
  ) {
    return 'E-mail inválido.'
  }
  return mensagem
}

export function Cadastro() {
  const { session, cadastrar } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [bairro, setBairro] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

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
    } catch (e) {
      setErroGeral(traduzirErro(e instanceof Error ? e.message : 'Falha ao criar conta.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative mx-auto max-w-md px-5 py-8 select-none">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-72 w-72 rounded-full bg-gradient-to-tr from-marca-laranja/15 to-marca-azul/10 blur-[60px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-60 w-60 rounded-full bg-marca-azul/10 blur-[65px]" />

      <div className="flex flex-col items-center mb-6 text-center">
        <div className="relative group mb-3">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-marca-laranja to-marca-azul opacity-30 blur-md" />
          <img
            src={logoImg}
            alt="GeoVision.AI Logo"
            className="relative h-16 w-16 rounded-2xl border border-borda/40 bg-white object-contain p-1 shadow-sm"
          />
        </div>
        <h1 className="text-2xl font-bold text-tinta">Criar conta</h1>
        <p className="text-tinta-suave mt-1.5 text-sm max-w-[280px]">
          Faça seu cadastro para começar a reportar riscos estruturais.
        </p>
      </div>

      <Cartao className="bg-white/95 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl transition-shadow p-5 sm:p-6 flex flex-col gap-4">
        <form onSubmit={aoSubmeter} className="flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Nome completo"
            required
            placeholder="Seu nome completo"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            erro={erros.nome}
          />
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
            rotulo="Bairro"
            ajuda="Usamos para mostrar os riscos mapeados perto de você."
            placeholder="Ex: Engenho de Dentro"
            autoComplete="address-level3"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          <Campo
            rotulo="Senha"
            type="password"
            required
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
          />
          <Campo
            rotulo="Confirmar senha"
            type="password"
            required
            placeholder="Digite a senha novamente"
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
                  className="text-marca-azul font-semibold underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Termos de Uso
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

          <Botao type="submit" largura="cheia" variante="secundaria" carregando={enviando} className="mt-2 relative overflow-hidden group">
            <span className="absolute inset-0 bg-gradient-to-r from-marca-azul to-marca-petroleo opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10">Criar conta</span>
          </Botao>
        </form>
      </Cartao>

      <p className="text-tinta-suave mt-4 text-center text-sm">
        Já tem conta?{' '}
        <Link to="/entrar" className="text-marca-azul font-semibold hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
