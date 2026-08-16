import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * `false` enquanto frontend/.env.local não existir com as chaves do projeto.
 *
 * Usado pelo AuthProvider para mostrar um aviso claro de configuração
 * pendente em vez de deixar toda a árvore React quebrar com tela branca —
 * mas o app ainda falha ruidosamente: `supabase` abaixo aponta para um
 * projeto placeholder que nunca responde com sucesso, então qualquer
 * chamada real continua visivelmente falhando, só que dentro da interface
 * em vez de travar o carregamento inicial da página inteira.
 */
export const supabaseConfigurado = true

export const supabase = createClient(
  url || 'https://supabase-nao-configurado.invalid',
  anonKey || 'chave-nao-configurada',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const BUCKET_ALERTAS = import.meta.env.VITE_STORAGE_BUCKET ?? 'alertas'

/** URL pública de uma foto de alerta a partir do caminho salvo no banco. */
export function urlDaFoto(caminho: string): string {
  const aiServiceUrl = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001'
  return `${aiServiceUrl}/uploads/${caminho}`
}

