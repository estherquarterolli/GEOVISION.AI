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

/**
 * Categorias ampliadas em 17/09/2026 com base na Norma de Inspeção
 * Predial do IBAPE/NA e no checklist de CARVALHO, E. M.; ALMEIDA, L. S.
 * "Check-list para inspeções prediais residenciais de múltiplos
 * pavimentos" (COBREAP, 2017) — ver docs/metodologia-priorizacao-gut.md.
 * As três novas opções cobrem sintomas que um morador consegue observar
 * a olho nu e que o checklist trata como sistemas distintos:
 * `desplacamento` (item "Revestimento" do checklist), `armadura_exposta`
 * (item "Estruturas") e `afundamento_recalque` (item "Fundação").
 */
export type TipoAnomalia =
  | 'rachadura'
  | 'inclinacao_muro'
  | 'infiltracao'
  | 'desplacamento'
  | 'armadura_exposta'
  | 'afundamento_recalque'
  | 'outro'

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
  latitude: number | null
  longitude: number | null
  bairro_id: string | null
  tipo_anomalia: TipoAnomalia | null
  descricao: string | null
  nivel_risco: NivelRisco | null
  confianca_ia: number | null
  modelo_versao: string | null
  status: StatusAlerta
  observacao_defesa_civil: string | null
  gravidade_percebida: string | null
  tempo_surgimento: string | null
  evolucao: string | null
  local_anomalia: string | null
  ruido_percebido: string | null
  /** G × U × T — ver app/services/priorizacao.py. Calculado só na fila da Defesa Civil. */
  pontuacao_gut: number | null
  gut_gravidade: number | null
  gut_urgencia: number | null
  gut_tendencia: number | null
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
  gravidade_percebida: string | null
  tempo_surgimento: string | null
  evolucao: string | null
  local_anomalia: string | null
  ruido_percebido: string | null
  pontuacao_gut: number | null
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
  rachadura: 'Rachadura ou fissura',
  inclinacao_muro: 'Muro ou parede inclinados',
  infiltracao: 'Infiltração ou umidade',
  desplacamento: 'Reboco ou concreto caindo (desplacamento)',
  armadura_exposta: 'Ferragem exposta ou enferrujada',
  afundamento_recalque: 'Piso ou chão afundando/rachando',
  outro: 'Outro',
}

export const ROTULO_GRAVIDADE: Record<string, string> = {
  baixo: 'Baixa (estética)',
  medio: 'Média (preocupante)',
  alto: 'Alta (urgente/perigo)',
}

export const ROTULO_TEMPO: Record<string, string> = {
  recente: 'Menos de 1 semana',
  semanas: 'Entre 1 e 4 semanas',
  meses: 'Mais de 1 mês',
}

export const ROTULO_EVOLUCAO: Record<string, string> = {
  estavel: 'Estável (não mudou)',
  aumentando: 'Aumentando devagar',
  rapido: 'Aumentando rápido',
}

export const ROTULO_LOCAL: Record<string, string> = {
  parede: 'Parede',
  viga_pilar: 'Viga ou Pilar',
  laje_piso: 'Laje ou Piso',
  muro_arrimo: 'Muro de Arrimo',
  solo_talude: 'Solo ou Talude',
  outro: 'Outro',
}

/**
 * Pergunta adicionada em 17/09/2026 após conversa com a engenheira civil
 * consultora: ela apontou que som e vibração ao pisar fazem parte da
 * leitura sensorial de risco que um engenheiro faz em campo e que uma
 * foto sozinha não capta. Alimenta a Tendência do método GUT.
 */
export const ROTULO_RUIDO: Record<string, string> = {
  nenhum: 'Nenhum barulho ou vibração notado',
  estalos: 'Estalos ou rangidos',
  vibracao_ao_pisar: 'O piso vibra ou "afunda" ao pisar/caminhar',
  outro: 'Outro tipo de ruído',
}

/** Ordem de prioridade na triagem. Menor número = mais urgente. */
export const PRIORIDADE_RISCO: Record<NivelRisco, number> = {
  critico: 1,
  medio: 2,
  baixo: 3,
}
