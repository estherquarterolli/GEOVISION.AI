const DIMENSAO_MAXIMA = 1600
const QUALIDADE_JPEG = 0.82

/**
 * Redimensiona e reencoda a foto antes do envio.
 *
 * Fotos de celular modernas passam de 10–20 MB — o limite do serviço de IA é
 * 8 MB (`ai-service/app/routers/classificacao.py`) e o upload/classificação
 * fica lento sem necessidade: nenhum modelo de visão computacional precisa
 * da resolução nativa da câmera para classificar risco estrutural.
 */
export async function comprimirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)

  const escala = Math.min(1, DIMENSAO_MAXIMA / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('Canvas 2D indisponível neste navegador.')
  contexto.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao comprimir a imagem.'))),
      'image/jpeg',
      QUALIDADE_JPEG,
    )
  })
}
