/**
 * Ponto único de acesso à API do serviço de classificação.
 *
 * Antes, sete arquivos repetiam a mesma linha de `API_URL` e montavam o fetch
 * na mão. Além da duplicação, isso impedia duas coisas que produção exige:
 * mandar o token de sessão em toda requisição e reagir a um 401 em um lugar
 * só, em vez de espalhar tratamento de sessão expirada por cada tela.
 */

/**
 * `??` e não `||`: em produção o nginx serve o app e a API na mesma origem e
 * o build define VITE_AI_SERVICE_URL como string vazia. Com `||`, a string
 * vazia seria descartada e o app publicado tentaria falar com o localhost do
 * celular do cidadão.
 */
export const API_URL = import.meta.env.VITE_AI_SERVICE_URL ?? 'http://localhost:8001'

const CHAVE_TOKEN = 'geovision_token'

/** Disparado quando a API recusa o token. O AuthProvider ouve e desloga. */
export const EVENTO_SESSAO_EXPIRADA = 'geovision:sessao-expirada'

export function obterToken(): string | null {
  return localStorage.getItem(CHAVE_TOKEN)
}

export function guardarToken(token: string): void {
  localStorage.setItem(CHAVE_TOKEN, token)
}

export function limparToken(): void {
  localStorage.removeItem(CHAVE_TOKEN)
}

/** URL pública de uma foto de alerta a partir do caminho salvo no banco. */
export function urlDaFoto(caminho: string): string {
  return `${API_URL}/uploads/${caminho}`
}

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
    this.name = 'ErroApi'
  }
}

async function detalheDoErro(resposta: Response, padrao: string): Promise<string> {
  try {
    const corpo = await resposta.json()
    // FastAPI devolve `detail` como string ou, em erro de validação, como
    // lista de objetos — exibir "[object Object]" ao cidadão não ajuda.
    if (typeof corpo?.detail === 'string') return corpo.detail
    if (Array.isArray(corpo?.detail) && corpo.detail[0]?.msg) return corpo.detail[0].msg
  } catch {
    /* resposta sem corpo JSON — fica com a mensagem padrão */
  }
  return padrao
}

interface OpcoesApi extends RequestInit {
  /** Requisições públicas (login, cadastro) passam false. */
  autenticado?: boolean
  /** Mensagem exibida quando a API não explica o erro. */
  mensagemPadrao?: string
}

/**
 * fetch com o Bearer token anexado e erro já traduzido em `ErroApi`.
 *
 * `caminho` é relativo à API, começando com barra: `/api/alertas`.
 */
export async function api(caminho: string, opcoes: OpcoesApi = {}): Promise<Response> {
  const { autenticado = true, mensagemPadrao = 'Falha na comunicação com o servidor.', headers, ...resto } = opcoes

  const cabecalhos = new Headers(headers)
  if (autenticado) {
    const token = obterToken()
    if (token) cabecalhos.set('Authorization', `Bearer ${token}`)
  }

  const resposta = await fetch(`${API_URL}${caminho}`, { ...resto, headers: cabecalhos })

  if (resposta.status === 401) {
    // Token expirado ou inválido: limpa a sessão local antes de propagar o
    // erro, senão o app fica preso mostrando uma sessão que o servidor já
    // rejeitou.
    limparToken()
    window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA))
    throw new ErroApi(await detalheDoErro(resposta, 'Sessão expirada. Entre novamente.'), 401)
  }

  if (!resposta.ok) {
    throw new ErroApi(await detalheDoErro(resposta, mensagemPadrao), resposta.status)
  }

  return resposta
}

/** Atalho para as rotas que devolvem JSON. */
export async function apiJson<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const resposta = await api(caminho, opcoes)
  return (await resposta.json()) as T
}
