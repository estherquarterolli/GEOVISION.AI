import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { Cartao } from '@/components/ui/Cartao'
import { Botao } from '@/components/ui/Botao'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { urlDaFoto } from '@/lib/supabase'
import {
  ROTULO_RISCO,
  ROTULO_STATUS,
  ROTULO_ANOMALIA,
  type Alerta,
  type StatusAlerta
} from '@/types/dominio'

import logoImg from '@/assets/logo.jpg'

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

const API_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001'

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
})

// Custom helper to dynamically move map center
function AtualizadorCentroMapa({ coords }: { coords: [number, number] }) {
  const mapa = useMap()
  useEffect(() => {
    mapa.setView(coords, 14)
  }, [coords, mapa])
  return null
}

export function PainelDefesaCivil() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [alertaSelecionado, setAlertaSelecionado] = useState<Alerta | null>(null)
  const [observacaoText, setObservacaoText] = useState('')
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-22.8988, -43.2930]) // Default center: Engenho de Dentro
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'mapa'>('fila')

  // Load alerts
  const { data: alertas = [], isLoading: carregandoAlertas } = useQuery<Alerta[]>({
    queryKey: ['defesa-civil-alertas'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/alertas/defesa-civil/listar`)
      if (!res.ok) throw new Error('Falha ao obter alertas da Defesa Civil')
      return await res.json()
    }
  })

  // Load metrics
  const { data: metricas, isLoading: carregandoMetricas } = useQuery({
    queryKey: ['defesa-civil-metricas'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/alertas/defesa-civil/metricas`)
      if (!res.ok) throw new Error('Falha ao obter métricas da Defesa Civil')
      return await res.json()
    }
  })

  // Mutation to update alert status
  const atualizarStatusMutacao = useMutation({
    mutationFn: async ({ id, status, observacao }: { id: string; status: StatusAlerta; observacao: string }) => {
      const res = await fetch(`${API_URL}/api/alertas/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, observacao_defesa_civil: observacao })
      })
      if (!res.ok) throw new Error('Erro ao atualizar status do alerta')
      return await res.json()
    },
    onSuccess: (dadoAtualizado) => {
      queryClient.invalidateQueries({ queryKey: ['defesa-civil-alertas'] })
      queryClient.invalidateQueries({ queryKey: ['defesa-civil-metricas'] })
      setAlertaSelecionado(dadoAtualizado)
    }
  })

  // Set first alert as selected on load only for large screens
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024
    if (isDesktop && alertas.length > 0 && !alertaSelecionado) {
      setAlertaSelecionado(alertas[0] || null)
    }
  }, [alertas, alertaSelecionado])

  useEffect(() => {
    if (alertaSelecionado) {
      setObservacaoText(alertaSelecionado.observacao_defesa_civil || '')
      if (alertaSelecionado.latitude && alertaSelecionado.longitude) {
        setCentroMapa([alertaSelecionado.latitude, alertaSelecionado.longitude])
      }
    }
  }, [alertaSelecionado])

  function aoSalvarAcao(novoStatus: StatusAlerta) {
    if (!alertaSelecionado) return
    atualizarStatusMutacao.mutate({
      id: alertaSelecionado.id,
      status: novoStatus,
      observacao: observacaoText.trim()
    })
  }

  // Separate active alerts that have coordinates for map markers
  const alertasComCoordenadas = alertas.filter(a => a.latitude && a.longitude && a.status !== 'resolvido' && a.status !== 'nao_procede')

  return (
    <div className="tema-painel min-h-dvh flex flex-col font-corpo select-none pb-8">
      
      {/* Header painel */}
      <header className="border-b border-borda py-4 px-6 bg-superficie shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="GeoVision Logo" className="h-9 w-9 md:h-10 md:w-10 rounded-lg object-contain p-0.5 bg-white border border-borda/40" />
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">
                GeoVision<span className="text-marca-laranja">.AI</span>
              </h1>
              <p className="text-[10px] md:text-xs text-tinta-suave">Painel de Triagem · Defesa Civil RJ</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
            <span className="text-tinta-suave hidden sm:inline">
              Operador: <strong>{usuario?.nome || 'Defesa Civil'}</strong>
            </span>
            <div className="px-2 py-0.5 rounded text-[10px] bg-marca-laranja text-white uppercase font-bold tracking-wider">
              Comando
            </div>
          </div>
        </div>
      </header>

      {/* Segmented Mobile Switcher (Visible only on mobile/tablet) */}
      <div className="flex border-b border-borda bg-superficie lg:hidden sticky top-0 z-40">
        <button
          onClick={() => setAbaAtiva('fila')}
          className={cn(
            'flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors duration-150',
            abaAtiva === 'fila' ? 'border-marca-laranja text-tinta font-bold' : 'border-transparent text-tinta-suave'
          )}
        >
          Fila de Triagem ({alertas.length})
        </button>
        <button
          onClick={() => setAbaAtiva('mapa')}
          className={cn(
            'flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors duration-150',
            abaAtiva === 'mapa' ? 'border-marca-laranja text-tinta font-bold' : 'border-transparent text-tinta-suave'
          )}
        >
          Mapa & Métricas ({alertasComCoordenadas.length})
        </button>
      </div>

      {/* Main dashboard space */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Metrics & Map */}
        <div className={cn("lg:col-span-8 flex flex-col gap-6", abaAtiva === 'mapa' ? 'flex' : 'hidden lg:flex')}>
          
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Cartao contexto="painel" className="p-3 bg-superficie">
              <p className="text-tinta-suave text-[10px] uppercase font-semibold">Alertas Ativos</p>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-tinta">
                {carregandoMetricas ? '...' : metricas?.alertas_ativos}
              </p>
            </Cartao>
            
            <Cartao contexto="painel" className="p-3 border-l-4 border-l-risco-critico bg-superficie">
              <p className="text-[10px] uppercase font-semibold text-risco-critico">Críticos</p>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-risco-critico">
                {carregandoMetricas ? '...' : metricas?.criticos_ativos}
              </p>
            </Cartao>

            <Cartao contexto="painel" className="p-3 bg-superficie">
              <p className="text-tinta-suave text-[10px] uppercase font-semibold">Recebidos 24h</p>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-tinta">
                {carregandoMetricas ? '...' : metricas?.ultimas_24h}
              </p>
            </Cartao>

            <Cartao contexto="painel" className="p-3 bg-superficie">
              <p className="text-tinta-suave text-[10px] uppercase font-semibold">Tempo Resposta</p>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-marca-laranja">
                {carregandoMetricas ? '...' : `${metricas?.tempo_medio_resposta_horas}h`}
              </p>
            </Cartao>
          </div>

          {/* Leaflet Map container */}
          <Cartao contexto="painel" className="flex-1 min-h-[300px] h-[350px] lg:h-[450px] relative overflow-hidden bg-superficie rounded-painel border border-borda">
            <MapContainer
              center={centroMapa}
              zoom={14}
              className="h-full w-full z-10"
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              <AtualizadorCentroMapa coords={centroMapa} />

              {alertasComCoordenadas.map((alerta) => (
                <Marker
                  key={alerta.id}
                  position={[alerta.latitude!, alerta.longitude!]}
                  eventHandlers={{
                    click: () => {
                      setAlertaSelecionado(alerta)
                      setAbaAtiva('fila') // Switch to show inspector detail
                    }
                  }}
                >
                  <Popup>
                    <div className="text-tinta text-xs max-w-[200px]">
                      <div className="font-bold border-b pb-1 mb-1">
                        {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Estrutura'}
                      </div>
                      <p className="mb-1 text-tinta-suave">{alerta.endereco_manual || 'Coordenadas GPS'}</p>
                      {alerta.nivel_risco && (
                        <div className="mt-1">
                          Risco: <strong>{ROTULO_RISCO[alerta.nivel_risco]}</strong>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </Cartao>
        </div>

        {/* Right Column: Alerts list & Details panel */}
        <div className={cn("lg:col-span-4 flex flex-col gap-6", abaAtiva === 'fila' ? 'flex' : 'hidden lg:flex')}>
          
          {/* Alerts List (Hidden on mobile if looking at details) */}
          <Cartao
            contexto="painel"
            className={cn(
              "bg-superficie p-4 flex flex-col gap-3",
              alertaSelecionado ? "hidden lg:flex h-[250px]" : "flex h-[450px] lg:h-[250px]"
            )}
          >
            <h2 className="text-sm font-semibold border-b border-borda pb-2">Fila de Prioridade</h2>
            
            {carregandoAlertas && <div className="progresso-ia" />}
            
            {!carregandoAlertas && alertas.length === 0 && (
              <p className="text-xs text-tinta-suave text-center py-8">Nenhum alerta recebido.</p>
            )}

            {!carregandoAlertas && alertas.length > 0 && (
              <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
                {alertas.map((alerta) => {
                  const isActive = alertaSelecionado?.id === alerta.id
                  return (
                    <li key={alerta.id}>
                      <button
                        onClick={() => setAlertaSelecionado(alerta)}
                        className={cn(
                          "w-full text-left p-3 border rounded-painel transition duration-150 flex items-center justify-between gap-3 text-xs",
                          isActive 
                            ? "bg-marca-azul-suave border-marca-azul text-marca-azul-escuro font-semibold shadow-sm" 
                            : "bg-superficie border-borda hover:bg-fundo text-tinta"
                        )}
                      >
                        <div className="truncate">
                          <p className="font-semibold truncate">
                            {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Anomalia'}
                          </p>
                          <p className="text-tinta-suave text-[10px] mt-0.5">
                            {FORMATADOR_DATA.format(new Date(alerta.criado_em))} · {ROTULO_STATUS[alerta.status]}
                          </p>
                        </div>
                        {alerta.nivel_risco ? (
                          <SeloRisco nivel={alerta.nivel_risco} tamanho="sm" />
                        ) : (
                          <span className="text-[10px] text-tinta-suave">Sem IA</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Cartao>

          {/* Selected Alert Details & Action pane (Visible on desktop, or mobile if selected) */}
          <Cartao
            contexto="painel"
            className={cn(
              "flex-1 bg-superficie p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto",
              alertaSelecionado ? "flex" : "hidden lg:flex"
            )}
          >
            {alertaSelecionado ? (
              <>
                {/* Back button on mobile */}
                <button
                  onClick={() => setAlertaSelecionado(null)}
                  className="flex items-center gap-1 text-xs text-marca-azul font-semibold pb-1 border-b border-borda/40 lg:hidden"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar para a fila
                </button>

                <h2 className="text-sm font-semibold border-b border-borda pb-2 flex items-center justify-between">
                  <span>Visualizar Alerta</span>
                  {alertaSelecionado.nivel_risco && (
                    <SeloRisco nivel={alertaSelecionado.nivel_risco} variante="solido" confianca={alertaSelecionado.confianca_ia ?? undefined} />
                  )}
                </h2>

                {/* Photo */}
                <div className="relative h-44 rounded-painel border border-borda bg-black/10 overflow-hidden flex items-center justify-center">
                  <img
                    src={urlDaFoto(alertaSelecionado.foto_path)}
                    alt="Foto do Risco"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur">
                    {ROTULO_STATUS[alertaSelecionado.status]}
                  </div>
                </div>

                {/* Details list */}
                <div className="flex flex-col gap-2.5 text-xs">
                  <div>
                    <span className="text-tinta-suave block text-[10px]">Tipo de Anomalia</span>
                    <span className="font-semibold text-tinta">
                      {alertaSelecionado.tipo_anomalia ? ROTULO_ANOMALIA[alertaSelecionado.tipo_anomalia] : 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-tinta-suave block text-[10px]">Local / Endereço</span>
                    <span className="font-medium text-tinta">
                      {alertaSelecionado.endereco_manual || 'Coordenadas GPS capturadas'}
                    </span>
                  </div>
                  {alertaSelecionado.descricao && (
                    <div>
                      <span className="text-tinta-suave block text-[10px]">Observações do Cidadão</span>
                      <p className="bg-fundo p-2.5 rounded-painel italic text-tinta border border-borda/40">
                        "{alertaSelecionado.descricao}"
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-tinta-suave block text-[10px]">Criado em</span>
                    <span className="font-medium text-tinta">
                      {FORMATADOR_DATA.format(new Date(alertaSelecionado.criado_em))}
                    </span>
                  </div>
                </div>

                {/* Action forms */}
                <div className="border-t border-borda pt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="observacao" className="text-tinta text-xs font-semibold">
                      Observação / Notas da Defesa Civil
                    </label>
                    <textarea
                      id="observacao"
                      rows={3}
                      className="w-full text-xs p-2.5 border border-borda rounded-painel bg-superficie placeholder:text-tinta-suave focus:border-marca-azul focus:outline-none"
                      placeholder="Descreva as providências tomadas ou observações para o técnico..."
                      value={observacaoText}
                      onChange={(e) => setObservacaoText(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {alertaSelecionado.status === 'recebido' && (
                      <Botao
                        largura="cheia"
                        variante="secundaria"
                        carregando={atualizarStatusMutacao.isPending}
                        onClick={() => aoSalvarAcao('em_vistoria')}
                      >
                        Iniciar Vistoria
                      </Botao>
                    )}
                    
                    {alertaSelecionado.status !== 'resolvido' && alertaSelecionado.status !== 'nao_procede' && (
                      <div className="flex gap-2">
                        <Botao
                          className="flex-1 text-xs"
                          variante="primaria"
                          carregando={atualizarStatusMutacao.isPending}
                          onClick={() => aoSalvarAcao('resolvido')}
                        >
                          Resolver
                        </Botao>
                        <Botao
                          className="flex-1 text-xs"
                          variante="fantasma"
                          carregando={atualizarStatusMutacao.isPending}
                          onClick={() => aoSalvarAcao('nao_procede')}
                        >
                          Não Procede
                        </Botao>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-tinta-suave text-center py-16">Selecione um alerta para ver os detalhes.</p>
            )}
          </Cartao>

        </div>

      </main>

    </div>
  )
}
