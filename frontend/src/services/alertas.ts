import { apiJson } from '@/lib/api'
import { comprimirImagem } from '@/lib/imagem'
import type { Alerta, TipoAnomalia } from '@/types/dominio'

export interface NovoAlertaEntrada {
  fotos: File[]
  tipoAnomalia: TipoAnomalia
  descricao: string
  /** Presente quando a permissão de localização foi concedida. */
  coordenadas: { latitude: number; longitude: number } | null
  /** Fallback quando o GPS foi negado. */
  enderecoManual: string | null
  gravidadePercebida?: string
  tempoSurgimento?: string
  evolucao?: string
  localAnomalia?: string
}

export async function enviarAlerta(entrada: NovoAlertaEntrada): Promise<Alerta> {
  // usuario_id não vai mais no formulário: o servidor usa o dono do token.
  const dados = new FormData()
  dados.append('tipo_anomalia', entrada.tipoAnomalia)
  dados.append('descricao', entrada.descricao || '')
  if (entrada.enderecoManual) {
    dados.append('endereco_manual', entrada.enderecoManual)
  }
  if (entrada.coordenadas) {
    dados.append('latitude', String(entrada.coordenadas.latitude))
    dados.append('longitude', String(entrada.coordenadas.longitude))
  }
  if (entrada.gravidadePercebida) {
    dados.append('gravidade_percebida', entrada.gravidadePercebida)
  }
  if (entrada.tempoSurgimento) {
    dados.append('tempo_surgimento', entrada.tempoSurgimento)
  }
  if (entrada.evolucao) {
    dados.append('evolucao', entrada.evolucao)
  }
  if (entrada.localAnomalia) {
    dados.append('local_anomalia', entrada.localAnomalia)
  }

  // Comprime e anexa todas as fotos
  for (const foto of entrada.fotos) {
    const fotoComprimida = await comprimirImagem(foto)
    dados.append('fotos', fotoComprimida, 'foto.jpg')
  }

  return await apiJson<Alerta>('/api/alertas', {
    method: 'POST',
    mensagemPadrao: 'Falha ao enviar alerta.',
    body: dados,
  })
}
