/**
 * Tipos do domínio do GeoVision.AI.
 *
 * Espelham os enums e tabelas de supabase/migrations/0001_esquema_inicial.sql.
 * Qualquer mudança de enum no banco precisa ser refletida aqui — são a mesma
 * verdade escrita em duas linguagens.
 */

export type NivelRisco = 'baixo' | 'medio' | 'critico'

export type StatusAlerta =
  | 'processando'
  | 'recebido'
  | 'em_vistoria'
  | 'resolvido'
  | 'nao_procede'

export type PapelUsuario = 'cidadao' | 'defesa_civil' | 'admin'

export type TipoAnomalia = 'rachadura' | 'inclinacao_muro' | 'infiltracao' | 'outro'

export interface Bairro {
  id: string
  nome: string
  codigo_ibge: string | null
}

export interface Usuario {
  id: string
  nome: string
  email: string
  bairro_id: string | null
  bairro_texto: string | null
  papel: PapelUsuario
  termos_aceitos_em: string
  criado_em: string
}

export interface Alerta {
  id: string
  usuario_id: string
  foto_path: string
  endereco_manual: string | null
  bairro_id: string | null
  tipo_anomalia: TipoAnomalia | null
  descricao: string | null
  nivel_risco: NivelRisco | null
  confianca_ia: number | null
  modelo_versao: string | null
  status: StatusAlerta
  observacao_defesa_civil: string | null
  criado_em: string
  classificado_em: string | null
  resolvido_em: string | null
}

/** Linha de vw_fila_triagem — lat/lng já extraídos para consumo do mapa. */
export interface ItemFilaTriagem {
  id: string
  nivel_risco: NivelRisco | null
  confianca_ia: number | null
  status: StatusAlerta
  tipo_anomalia: TipoAnomalia | null
  criado_em: string
  foto_path: string
  latitude: number | null
  longitude: number | null
  bairro: string | null
  autor: string | null
}

export interface MetricasPainel {
  alertas_ativos: number
  criticos_ativos: number
  ultimas_24h: number
  tempo_medio_resposta_horas: number | null
}

/* -----------------------------------------------------------------------------
 * Rótulos para exibição
 *
 * Centralizados aqui para que "Crítico" seja escrito uma única vez no código —
 * evita divergência de texto entre o app do cidadão e o painel.
 * -------------------------------------------------------------------------- */

export const ROTULO_RISCO: Record<NivelRisco, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  critico: 'Crítico',
}

export const ROTULO_STATUS: Record<StatusAlerta, string> = {
  processando: 'Analisando',
  recebido: 'Recebido pela Defesa Civil',
  em_vistoria: 'Vistoria em andamento',
  resolvido: 'Resolvido',
  nao_procede: 'Sem risco identificado',
}

export const ROTULO_ANOMALIA: Record<TipoAnomalia, string> = {
  rachadura: 'Rachadura',
  inclinacao_muro: 'Muro inclinado',
  infiltracao: 'Infiltração',
  outro: 'Outro',
}

/** Ordem de prioridade na triagem. Menor número = mais urgente. */
export const PRIORIDADE_RISCO: Record<NivelRisco, number> = {
  critico: 1,
  medio: 2,
  baixo: 3,
}
