import { comprimirImagem } from '@/lib/imagem'
import type { Alerta, TipoAnomalia } from '@/types/dominio'

const API_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001'

export interface NovoAlertaEntrada {
  usuarioId: string
  foto: File
  tipoAnomalia: TipoAnomalia
  descricao: string
  /** Presente quando a permissão de localização foi concedida. */
  coordenadas: { latitude: number; longitude: number } | null
  /** Fallback quando o GPS foi negado. */
  enderecoManual: string | null
}

export async function enviarAlerta(entrada: NovoAlertaEntrada): Promise<Alerta> {
  const fotoComprimida = await comprimirImagem(entrada.foto)

  const dados = new FormData()
  dados.append('usuario_id', entrada.usuarioId)
  dados.append('tipo_anomalia', entrada.tipoAnomalia)
  dados.append('descricao', entrada.descricao || '')
  if (entrada.enderecoManual) {
    dados.append('endereco_manual', entrada.enderecoManual)
  }
  if (entrada.coordenadas) {
    dados.append('latitude', String(entrada.coordenadas.latitude))
    dados.append('longitude', String(entrada.coordenadas.longitude))
  }
  dados.append('foto', fotoComprimida, 'foto.jpg')

  const resposta = await fetch(`${API_URL}/api/alertas`, {
    method: 'POST',
    body: dados,
  })

  if (!resposta.ok) {
    const erroInfo = await resposta.json().catch(() => ({}))
    throw new Error(erroInfo.detail || 'Falha ao enviar alerta.')
  }

  return await resposta.json()
}
