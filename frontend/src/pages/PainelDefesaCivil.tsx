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
import { apiJson, urlDaFoto } from '@/lib/api'
import {
  ROTULO_RISCO,
  ROTULO_STATUS,
  ROTULO_ANOMALIA,
  ROTULO_GRAVIDADE,
  ROTULO_TEMPO,
  ROTULO_EVOLUCAO,
  ROTULO_LOCAL,
  type Alerta,
  type MetricasPainel,
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

const CORES_RISCO_BG: Record<string, string> = {
  critico: 'bg-risco-critico',
  medio: 'bg-risco-medio',
  baixo: 'bg-risco-baixo',
}

export function PainelDefesaCivil() {
  const { usuario, sair } = useAuth()
  const queryClient = useQueryClient()
  const [alertaSelecionado, setAlertaSelecionado] = useState<Alerta | null>(null)
  const [observacaoText, setObservacaoText] = useState('')
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-22.8988, -43.2930]) // Default center: Engenho de Dentro
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'mapa'>('fila')
  const [fotoAtivaIndice, setFotoAtivaIndice] = useState(0)

  useEffect(() => {
    setFotoAtivaIndice(0)
  }, [alertaSelecionado])

  // Load alerts
  const { data: alertas = [], isLoading: carregandoAlertas } = useQuery<Alerta[]>({
    queryKey: ['defesa-civil-alertas'],
    queryFn: async () => {
      return await apiJson<Alerta[]>('/api/alertas/defesa-civil/listar', {
        mensagemPadrao: 'Falha ao obter alertas da Defesa Civil',
      })
    }
  })

  // Load metrics
  const { data: metricas, isLoading: carregandoMetricas } = useQuery({
    queryKey: ['defesa-civil-metricas'],
    queryFn: async () => {
      return await apiJson<MetricasPainel>('/api/alertas/defesa-civil/metricas', {
        mensagemPadrao: 'Falha ao obter métricas da Defesa Civil',
      })
    }
  })

  // Mutation to update alert status
  const atualizarStatusMutacao = useMutation({
    mutationFn: async ({ id, status, observacao }: { id: string; status: StatusAlerta; observacao: string }) => {
      return await apiJson<Alerta>(`/api/alertas/${id}/status`, {
        method: 'PUT',
        mensagemPadrao: 'Erro ao atualizar status do alerta',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, observacao_defesa_civil: observacao })
      })
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
      <header className="border-b border-borda py-3 px-6 bg-superficie shadow-sm">
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

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-laranja text-xs font-bold text-white">
                {(usuario?.nome || 'DC').slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold">{usuario?.nome || 'Defesa Civil'}</p>
                <p className="text-marca-laranja text-[10px] font-semibold uppercase tracking-wider">Comando</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void sair()}
              title="Sair"
              aria-label="Sair"
              className="text-tinta-suave hover:bg-marca-azul-suave hover:text-marca-azul flex size-9 items-center justify-center rounded-full transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
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
        
        {/* Situational column: Metrics & Map — glanceable overview, secondary to the triage workflow */}
        <div className={cn("lg:col-span-5 lg:order-2 flex flex-col gap-6", abaAtiva === 'mapa' ? 'flex' : 'hidden lg:flex')}>
          
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Cartao contexto="painel" className="p-3 bg-superficie">
              <div className="flex items-center gap-1.5 text-tinta-suave">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[10px] uppercase font-semibold">Alertas Ativos</p>
              </div>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-tinta">
                {carregandoMetricas ? '...' : metricas?.alertas_ativos}
              </p>
            </Cartao>

            <Cartao
              contexto="painel"
              className={cn(
                'p-3 border-l-4 border-l-risco-critico bg-superficie',
                Boolean(metricas?.criticos_ativos) && 'shadow-[0_0_0_1px_rgba(217,70,59,0.35)]',
              )}
            >
              <div className="flex items-center gap-1.5 text-risco-critico">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[10px] uppercase font-semibold">Críticos</p>
              </div>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-risco-critico">
                {carregandoMetricas ? '...' : metricas?.criticos_ativos}
              </p>
            </Cartao>

            <Cartao contexto="painel" className="p-3 bg-superficie">
              <div className="flex items-center gap-1.5 text-tinta-suave">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] uppercase font-semibold">Recebidos 24h</p>
              </div>
              <p className="metrica text-2xl font-extrabold mt-0.5 text-tinta">
                {carregandoMetricas ? '...' : metricas?.ultimas_24h}
              </p>
            </Cartao>

            <Cartao contexto="painel" className="p-3 bg-superficie">
              <div className="flex items-center gap-1.5 text-tinta-suave">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-[10px] uppercase font-semibold">Tempo Resposta</p>
              </div>
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

        {/* Triage column: queue + details — the actual workflow, given the most room */}
        <div className={cn("lg:col-span-7 lg:order-1 flex flex-col gap-6", abaAtiva === 'fila' ? 'flex' : 'hidden lg:flex')}>
          
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
                          "relative w-full text-left p-3 pl-4 border rounded-painel transition duration-150 flex items-center justify-between gap-3 text-xs overflow-hidden",
                          isActive
                            ? "bg-marca-azul-suave border-marca-azul text-marca-azul-escuro font-semibold shadow-sm"
                            : "bg-superficie border-borda hover:bg-fundo text-tinta"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-y-0 left-0 w-1',
                            alerta.nivel_risco ? CORES_RISCO_BG[alerta.nivel_risco] : 'bg-borda',
                          )}
                        />
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

                {/* Photo Gallery / Carousel */}
                {(() => {
                  const fotosArray = alertaSelecionado.foto_path.split(',')
                  const temMultiplasFotos = fotosArray.length > 1
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="relative h-56 rounded-painel border border-borda bg-black/10 overflow-hidden flex items-center justify-center group">
                        <img
                          src={urlDaFoto(fotosArray[fotoAtivaIndice] || fotosArray[0] || '')}
                          alt={`Foto do Risco - ${fotoAtivaIndice + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur z-20">
                          {ROTULO_STATUS[alertaSelecionado.status]}
                        </div>
                        
                        {temMultiplasFotos && (
                          <>
                            {/* Overlay caption */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-3 py-1 text-center font-medium backdrop-blur">
                              {fotoAtivaIndice === 0 && 'Foto 1: Visão Geral / Contexto'}
                              {fotoAtivaIndice === 1 && 'Foto 2: Detalhe da Anomalia'}
                              {fotoAtivaIndice === 2 && 'Foto 3: Close-up com Escala'}
                            </div>

                            {/* Left/Right buttons */}
                            <button
                              type="button"
                              onClick={() => setFotoAtivaIndice(prev => (prev > 0 ? prev - 1 : fotosArray.length - 1))}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition z-20 cursor-pointer"
                              aria-label="Foto anterior"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotoAtivaIndice(prev => (prev < fotosArray.length - 1 ? prev + 1 : 0))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition z-20 cursor-pointer"
                              aria-label="Próxima foto"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Dots / Selectors */}
                      {temMultiplasFotos && (
                        <div className="flex justify-center gap-1.5 mt-1">
                          {fotosArray.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFotoAtivaIndice(idx)}
                              className={cn(
                                "size-2 rounded-full transition-all cursor-pointer",
                                fotoAtivaIndice === idx ? "bg-marca-laranja w-4" : "bg-borda hover:bg-tinta-suave"
                              )}
                              title={`Ver Foto ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

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

                  {/* Seção de Dados Informados pelo Cidadão */}
                  <div className="border-t border-borda/60 pt-2.5 mt-1">
                    <span className="text-marca-azul font-bold text-[10px] uppercase tracking-wider block mb-2">Triagem do Cidadão</span>
                    <div className="grid grid-cols-2 gap-2 bg-fundo/40 p-2.5 rounded-painel border border-borda/30">
                      <div>
                        <span className="text-tinta-suave block text-[9px]">Localização exata</span>
                        <span className="font-semibold text-tinta text-[11px]">
                          {alertaSelecionado.local_anomalia ? ROTULO_LOCAL[alertaSelecionado.local_anomalia] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-tinta-suave block text-[9px]">Tempo de surgimento</span>
                        <span className="font-semibold text-tinta text-[11px]">
                          {alertaSelecionado.tempo_surgimento ? ROTULO_TEMPO[alertaSelecionado.tempo_surgimento] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-tinta-suave block text-[9px]">Evolução relatada</span>
                        <span className="font-semibold text-tinta text-[11px]">
                          {alertaSelecionado.evolucao ? ROTULO_EVOLUCAO[alertaSelecionado.evolucao] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-tinta-suave block text-[9px]">Gravidade estimada</span>
                        <span className="font-semibold text-tinta text-[11px]">
                          {alertaSelecionado.gravidade_percebida ? ROTULO_GRAVIDADE[alertaSelecionado.gravidade_percebida] : 'Não informado'}
                        </span>
                      </div>
                    </div>
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
