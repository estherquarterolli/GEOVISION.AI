import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { apiJson } from '@/lib/api'
import { Cartao } from '@/components/ui/Cartao'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { ROTULO_ANOMALIA, type NivelRisco, type TipoAnomalia } from '@/types/dominio'

// Fix default leaflet marker icon issue in react builds
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

interface AlertaPublico {
  id: string
  latitude: number | null
  longitude: number | null
  nivel_risco: NivelRisco | null
  tipo_anomalia: TipoAnomalia | null
  criado_em: string
}

export function MapaBairro() {
  const [centroMapa] = useState<[number, number]>([-22.8988, -43.2930]) // Default center: Engenho de Dentro

  // Load public alerts
  const { data: alertasPublicos = [], isLoading } = useQuery<AlertaPublico[]>({
    queryKey: ['public-alerts'],
    queryFn: async () => {
      return await apiJson<AlertaPublico[]>('/api/alertas/publicos', {
        mensagemPadrao: 'Falha ao obter alertas públicos',
      })
    }
  })

  // Filter alerts with valid coordinates
  const alertasValidos = alertasPublicos.filter(a => a.latitude && a.longitude)

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 select-none flex flex-col gap-6">
      
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-64 w-64 rounded-full bg-gradient-to-tr from-marca-laranja/10 to-marca-azul/10 blur-[60px]" />

      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-tinta">Mapa do Bairro</h1>
        <p className="text-tinta-suave mt-1.5 text-sm">
          Acompanhe os alertas ativos relatados pela comunidade no Engenho de Dentro.
        </p>
      </header>

      {/* Info indicator */}
      <div className="flex gap-2 items-center text-xs text-tinta-suave bg-white/60 p-3 rounded-lg border border-borda/40">
        <svg className="size-4 text-marca-azul flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Mapa 100% anônimo: sem fotos ou dados pessoais.</span>
      </div>

      {/* Map container */}
      <Cartao className="relative h-96 min-h-[380px] rounded-cidadao overflow-hidden border border-borda shadow-card">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 z-20 flex items-center justify-center">
            <div className="progresso-ia w-48" />
          </div>
        )}
        
        <MapContainer
          center={centroMapa}
          zoom={15}
          className="h-full w-full z-10"
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {alertasValidos.map((alerta) => (
            <Marker
              key={alerta.id}
              position={[alerta.latitude!, alerta.longitude!]}
            >
              <Popup>
                <div className="text-tinta text-xs max-w-[180px]">
                  <div className="font-bold border-b pb-1 mb-1.5">
                    {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Risco Reportado'}
                  </div>
                  <p className="text-tinta-suave mb-2">
                    Enviado em: <strong>{FORMATADOR_DATA.format(new Date(alerta.criado_em))}</strong>
                  </p>
                  {alerta.nivel_risco ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span>Risco:</span>
                      <SeloRisco nivel={alerta.nivel_risco} tamanho="sm" />
                    </div>
                  ) : (
                    <span className="text-[10px] text-tinta-suave">Aguardando classificação</span>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Cartao>

      <div className="flex justify-between items-center text-xs text-tinta-suave">
        <span>Total de riscos ativos: <strong>{alertasValidos.length}</strong></span>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-risco-critico" />
            <span>Crítico</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-risco-medio" />
            <span>Médio</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-risco-baixo" />
            <span>Baixo</span>
          </div>
        </div>
      </div>

    </div>
  )
}
