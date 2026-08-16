import { useState } from 'react'

interface Coordenadas {
  latitude: number
  longitude: number
}

type EstadoGeo = 'ocioso' | 'solicitando' | 'concedida' | 'negada' | 'indisponivel'

/**
 * Wrapper da Geolocation API com estado explícito de permissão.
 *
 * Existe separado da tela porque o plano exige um padrão específico: nunca
 * disparar o prompt nativo do navegador sem antes mostrar, na própria
 * interface, uma linha explicando por quê — e tratar a recusa com um
 * fallback claro (endereço manual), não com um formulário travado.
 */
export function useGeolocalizacao() {
  const [estado, setEstado] = useState<EstadoGeo>('ocioso')
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null)

  function solicitar() {
    if (!('geolocation' in navigator)) {
      setEstado('indisponivel')
      return
    }

    setEstado('solicitando')
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setCoordenadas({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
        })
        setEstado('concedida')
      },
      () => setEstado('negada'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return { estado, coordenadas, solicitar }
}
