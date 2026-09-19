import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { Cartao } from '@/components/ui/Cartao'
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
  ROTULO_RUIDO,
  type Alerta,
  type MetricasPainel,
  type StatusAlerta
} from '@/types/dominio'

import { AbaUsuarios } from '@/components/admin/AbaUsuarios'
import { AbaLogs } from '@/components/admin/AbaLogs'
import { AbaSuperAdmin } from '@/components/admin/AbaSuperAdmin'

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

function extrairIniciais(nome?: string | null, email?: string | null): string {
  if (nome && nome.trim()) {
    const partes = nome.trim().split(/\s+/).filter(Boolean)
    const p0 = partes[0]
    const p1 = partes[1]
    if (p0 && p1) {
      return (p0.charAt(0) + p1.charAt(0)).toUpperCase()
    }
    if (p0) {
      return p0.slice(0, 2).toUpperCase()
    }
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase()
  }
  return 'EQ'
}

// Custom helper to dynamically move map center
function AtualizadorCentroMapa({ coords }: { coords: [number, number] }) {
  const mapa = useMap()
  useEffect(() => {
    mapa.setView(coords, 14)
  }, [coords, mapa])
  return null
}

export function PainelDefesaCivil() {
  const { usuario, sair } = useAuth()
  const queryClient = useQueryClient()
  const [abaPrincipal, setAbaPrincipal] = useState<'alertas' | 'usuarios' | 'logs' | 'superadmin'>('alertas')
  const [alertaSelecionado, setAlertaSelecionado] = useState<Alerta | null>(null)
  const [observacaoText, setObservacaoText] = useState('')
  const [centroMapa, setCentroMapa] = useState<[number, number]>([-22.8988, -43.2930]) // Default center: Engenho de Dentro
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'mapa'>('fila')
  const [fotoAtivaIndice, setFotoAtivaIndice] = useState(0)

  const isSuperAdmin = usuario?.email?.trim().toLowerCase() === 'estherquarterollii@gmail.com'

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
    <div className="tema-painel min-h-dvh flex flex-col font-corpo select-none pb-8 bg-fundo">
      
      {/* Header painel estruturado em 2 níveis */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur shadow-sm sticky top-0 z-50">
        {/* Linha Superior: Branding + Usuário & Ações */}
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-2.5 flex items-center justify-between gap-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="GeoVision Logo" className="size-8 rounded-lg object-contain p-0.5 bg-slate-950 border border-slate-700 shadow-xs" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-white">
                  GeoVision<span className="text-sky-400 font-extrabold">.AI</span>
                </h1>
                <span className="text-[10px] font-bold text-sky-300 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/80">
                  Painel Oficial
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Defesa Civil & Monitoramento Estrutural</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-400/40 text-white text-xs font-black flex items-center justify-center shadow-sm shrink-0">
                {extrairIniciais(usuario?.nome, usuario?.email)}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-white tracking-wide">
                  {usuario?.nome || (usuario?.email ? usuario.email.split('@')[0] : 'Operador')}
                </p>
                <p className="text-[10px] text-sky-400 font-semibold">
                  {isSuperAdmin ? 'Administradora Master' : usuario?.papel === 'admin' ? 'Administrador' : 'Agente Defesa Civil'}
                </p>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-700" />

            <button
              type="button"
              onClick={() => void sair()}
              title="Encerrar Sessão"
              className="text-xs text-slate-300 hover:text-rose-400 flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-slate-800/60 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 transition-colors cursor-pointer"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline text-xs font-medium">Sair</span>
            </button>
          </div>
        </div>

        {/* Linha Inferior: Sub-barra de Abas com Alto Contraste */}
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none" aria-label="Navegação do Painel">
            <button
              type="button"
              onClick={() => setAbaPrincipal('alertas')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border',
                abaPrincipal === 'alertas'
                  ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800 hover:border-slate-700 font-medium'
              )}
            >
              <svg className="size-4 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Triagem de Alertas</span>
              {alertas.length > 0 && (
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-black',
                  abaPrincipal === 'alertas' ? 'bg-white text-blue-900 shadow-xs' : 'bg-slate-800 text-slate-200 border border-slate-700'
                )}>
                  {alertas.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAbaPrincipal('usuarios')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border',
                abaPrincipal === 'usuarios'
                  ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800 hover:border-slate-700 font-medium'
              )}
            >
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Usuários</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaPrincipal('logs')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border',
                abaPrincipal === 'logs'
                  ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800 hover:border-slate-700 font-medium'
              )}
            >
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Trilha de Auditoria</span>
            </button>

            {/* Aba Exclusiva Super Admin */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setAbaPrincipal('superadmin')}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border',
                  abaPrincipal === 'superadmin'
                    ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md shadow-blue-600/30'
                    : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800 hover:border-slate-700 font-medium'
                )}
              >
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Gestão de Acessos</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Renderização Condicional de Abas */}
      {abaPrincipal === 'usuarios' ? (
        <AbaUsuarios />
      ) : abaPrincipal === 'logs' ? (
        <AbaLogs />
      ) : abaPrincipal === 'superadmin' && isSuperAdmin ? (
        <AbaSuperAdmin />
      ) : (
        <>
          {/* Segmented Mobile Switcher (Visible only on mobile/tablet for alert queue vs map) */}
          <div className="flex border-b border-slate-800 bg-slate-900 lg:hidden sticky top-[61px] z-40">
            <button
              onClick={() => setAbaAtiva('fila')}
              className={cn(
                'flex-1 py-3 text-center text-xs font-bold border-b-2 transition-colors duration-150',
                abaAtiva === 'fila' ? 'border-sky-400 text-white bg-slate-800/50' : 'border-transparent text-slate-400'
              )}
            >
              Fila de Triagem ({alertas.length})
            </button>
            <button
              onClick={() => setAbaAtiva('mapa')}
              className={cn(
                'flex-1 py-3 text-center text-xs font-bold border-b-2 transition-colors duration-150',
                abaAtiva === 'mapa' ? 'border-sky-400 text-white bg-slate-800/50' : 'border-transparent text-slate-400'
              )}
            >
              Mapa & Métricas ({alertasComCoordenadas.length})
            </button>
          </div>

      {/* Main dashboard space */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Situational column: Metrics & Map */}
        <div className={cn("lg:col-span-5 lg:order-2 flex flex-col gap-6", abaAtiva === 'mapa' ? 'flex' : 'hidden lg:flex')}>
          
          {/* Metrics Grid Espaçoso 2x2 com Alto Contraste */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 text-sky-400">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[11px] uppercase font-bold tracking-wider">Alertas Ativos</p>
              </div>
              <p className="metrica text-3xl font-black mt-2 text-white">
                {carregandoMetricas ? '...' : metricas?.alertas_ativos}
              </p>
            </div>

            <div className={cn(
              "p-4 bg-slate-900 border border-slate-800 border-l-4 border-l-rose-500 rounded-xl flex flex-col justify-between shadow-xs",
              Boolean(metricas?.criticos_ativos) && 'shadow-[0_0_12px_rgba(244,63,94,0.25)]'
            )}>
              <div className="flex items-center gap-2 text-rose-400">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[11px] uppercase font-bold tracking-wider">Críticos</p>
              </div>
              <p className="metrica text-3xl font-black mt-2 text-rose-400">
                {carregandoMetricas ? '...' : metricas?.criticos_ativos}
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 text-sky-400">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] uppercase font-bold tracking-wider">Recebidos 24h</p>
              </div>
              <p className="metrica text-3xl font-black mt-2 text-sky-400">
                {carregandoMetricas ? '...' : metricas?.ultimas_24h}
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center gap-2 text-amber-400">
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-[11px] uppercase font-bold tracking-wider">Tempo Resposta</p>
              </div>
              <p className="metrica text-3xl font-black mt-2 text-amber-400">
                {carregandoMetricas ? '...' : `${metricas?.tempo_medio_resposta_horas ?? 0}h`}
              </p>
            </div>
          </div>

          {/* Leaflet Map Card */}
          <Cartao contexto="painel" className="h-[350px] lg:h-[480px] p-0 overflow-hidden border border-slate-800 bg-slate-900 relative flex flex-col">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Mapa de Alertas Ativos</h2>
              <span className="text-[10px] bg-slate-800 text-sky-400 font-semibold px-2 py-0.5 rounded border border-slate-700">
                {alertasComCoordenadas.length} com GPS
              </span>
            </div>

            <MapContainer
              center={centroMapa}
              zoom={13}
              className="flex-1 w-full z-0"
              attributionControl={false}
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
                    <div className="text-slate-900 text-xs max-w-[200px]">
                      <div className="font-bold border-b pb-1 mb-1">
                        {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Estrutura'}
                      </div>
                      <p className="mb-1 text-slate-600">{alerta.endereco_manual || 'Coordenadas GPS'}</p>
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
              "bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3",
              alertaSelecionado ? "hidden lg:flex h-[260px]" : "flex h-[450px] lg:h-[260px]"
            )}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2.5 flex items-center justify-between">
              <span>Fila de Prioridade</span>
              <span className="text-[11px] font-semibold text-slate-400 font-mono">{alertas.length} alertas</span>
            </h2>
            
            {carregandoAlertas && <div className="progresso-ia" />}
            
            {!carregandoAlertas && alertas.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">Nenhum alerta recebido.</p>
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
                          "relative w-full text-left p-3 pl-4 border rounded-lg transition duration-150 flex items-center justify-between gap-3 text-xs overflow-hidden cursor-pointer",
                          isActive
                            ? "bg-slate-800 border-2 border-sky-400 text-white font-semibold shadow-md shadow-sky-950/60"
                            : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-y-0 left-0 w-1.5',
                            alerta.nivel_risco === 'critico' ? 'bg-rose-500' : alerta.nivel_risco === 'medio' ? 'bg-amber-400' : 'bg-emerald-400'
                          )}
                        />
                        <div className="truncate">
                          <p className="font-bold text-white text-xs truncate">
                            {alerta.tipo_anomalia ? ROTULO_ANOMALIA[alerta.tipo_anomalia] : 'Anomalia'}
                          </p>
                          <p className="text-slate-400 text-[10px] mt-0.5 font-medium">
                            {FORMATADOR_DATA.format(new Date(alerta.criado_em))} · {ROTULO_STATUS[alerta.status]}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {alerta.pontuacao_gut != null && (
                            <span
                              className="metrica text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 rounded px-2 py-0.5"
                              title="Prioridade GUT dentro do nível de risco"
                            >
                              GUT {alerta.pontuacao_gut}
                            </span>
                          )}
                          {alerta.nivel_risco ? (
                            <SeloRisco nivel={alerta.nivel_risco} tamanho="sm" />
                          ) : (
                            <span className="text-[10px] text-slate-400">Sem IA</span>
                          )}
                        </div>
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
              "flex-1 bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto",
              alertaSelecionado ? "flex" : "hidden lg:flex"
            )}
          >
            {alertaSelecionado ? (
              <>
                {/* Back button on mobile */}
                <button
                  onClick={() => setAlertaSelecionado(null)}
                  className="flex items-center gap-1.5 text-xs text-sky-400 font-bold pb-2 border-b border-slate-800 lg:hidden cursor-pointer"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar para a fila
                </button>

                <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2.5 flex items-center justify-between">
                  <span>Visualização do Alerta</span>
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
                      <div className="relative h-56 rounded-lg border border-slate-700 bg-black/40 overflow-hidden flex items-center justify-center group">
                        <img
                          src={urlDaFoto(fotosArray[fotoAtivaIndice] || fotosArray[0] || '')}
                          alt={`Foto do Risco - ${fotoAtivaIndice + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 right-2 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 text-white backdrop-blur border border-white/10 z-20">
                          {ROTULO_STATUS[alertaSelecionado.status]}
                        </div>
                        
                        {temMultiplasFotos && (
                          <>
                            {/* Overlay caption */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-3 py-1.5 text-center font-bold backdrop-blur border-t border-white/10">
                              {fotoAtivaIndice === 0 && 'Foto 1: Visão Geral / Contexto'}
                              {fotoAtivaIndice === 1 && 'Foto 2: Detalhe da Anomalia'}
                              {fotoAtivaIndice === 2 && 'Foto 3: Outro Ângulo'}
                            </div>

                            {/* Left/Right buttons */}
                            <button
                              type="button"
                              onClick={() => setFotoAtivaIndice(prev => (prev > 0 ? prev - 1 : fotosArray.length - 1))}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-20 cursor-pointer border border-white/20"
                              aria-label="Foto anterior"
                            >
                              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotoAtivaIndice(prev => (prev < fotosArray.length - 1 ? prev + 1 : 0))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-20 cursor-pointer border border-white/20"
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
                                fotoAtivaIndice === idx ? "bg-sky-400 w-5" : "bg-slate-700 hover:bg-slate-500"
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
                <div className="flex flex-col gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Tipo de Anomalia</span>
                    <span className="font-bold text-white text-sm">
                      {alertaSelecionado.tipo_anomalia ? ROTULO_ANOMALIA[alertaSelecionado.tipo_anomalia] : 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Local / Endereço</span>
                    <span className="font-semibold text-slate-200">
                      {alertaSelecionado.endereco_manual || 'Coordenadas GPS capturadas'}
                    </span>
                  </div>

                  {/* Seção de Dados Informados pelo Cidadão com Alto Contraste */}
                  <div className="border-t border-slate-800 pt-3 mt-1">
                    <div className="flex items-center gap-1.5 text-sky-400 font-extrabold text-xs uppercase tracking-wider mb-2.5">
                      <svg className="size-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Triagem do Cidadão</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Localização exata</span>
                        <span className="font-bold text-white text-xs mt-0.5 block">
                          {alertaSelecionado.local_anomalia ? ROTULO_LOCAL[alertaSelecionado.local_anomalia] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Tempo de surgimento</span>
                        <span className="font-bold text-white text-xs mt-0.5 block">
                          {alertaSelecionado.tempo_surgimento ? ROTULO_TEMPO[alertaSelecionado.tempo_surgimento] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Evolução relatada</span>
                        <span className="font-bold text-white text-xs mt-0.5 block">
                          {alertaSelecionado.evolucao ? ROTULO_EVOLUCAO[alertaSelecionado.evolucao] : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Gravidade estimada</span>
                        <span className="font-bold text-white text-xs mt-0.5 block">
                          {alertaSelecionado.gravidade_percebida ? ROTULO_GRAVIDADE[alertaSelecionado.gravidade_percebida] : 'Não informado'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px] font-medium">Barulho / vibração</span>
                        <span className="font-bold text-white text-xs mt-0.5 block">
                          {alertaSelecionado.ruido_percebido ? ROTULO_RUIDO[alertaSelecionado.ruido_percebido] : 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prioridade GUT — desempate dentro do mesmo nível de risco.
                      Ver app/services/priorizacao.py e docs/metodologia-priorizacao-gut.md. */}
                  {alertaSelecionado.pontuacao_gut != null && (
                    <div className="border-t border-slate-800 pt-3 mt-1">
                      <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs uppercase tracking-wider mb-2.5">
                        <svg className="size-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Prioridade no Risco (Matriz GUT)</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 bg-slate-950 border border-amber-500/30 p-3.5 rounded-lg">
                        <div className="flex gap-4 text-xs font-mono font-bold text-slate-300">
                          <span>G={alertaSelecionado.gut_gravidade}</span>
                          <span>U={alertaSelecionado.gut_urgencia}</span>
                          <span>T={alertaSelecionado.gut_tendencia}</span>
                        </div>
                        <span className="metrica font-extrabold text-amber-400 text-base" title="Gravidade × Urgência × Tendência (Gomide, Pujadas e Fagundes Neto, 2009)">
                          Score: {alertaSelecionado.pontuacao_gut}
                        </span>
                      </div>
                    </div>
                  )}

                  {alertaSelecionado.descricao && (
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider mb-1">Observações do Cidadão</span>
                      <p className="bg-slate-950 p-3 rounded-lg italic text-slate-200 border border-slate-800 text-xs">
                        "{alertaSelecionado.descricao}"
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Criado em</span>
                    <span className="font-semibold text-slate-200 font-mono text-xs">
                      {FORMATADOR_DATA.format(new Date(alertaSelecionado.criado_em))}
                    </span>
                  </div>
                </div>

                {/* Action forms */}
                <div className="border-t border-slate-800 pt-3.5 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="observacao" className="text-slate-200 text-xs font-bold uppercase tracking-wider">
                      Observação / Notas da Defesa Civil
                    </label>
                    <textarea
                      id="observacao"
                      rows={3}
                      className="w-full text-xs p-3 border border-slate-700 rounded-lg bg-slate-950 text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-none"
                      placeholder="Descreva as providências tomadas ou observações para o técnico..."
                      value={observacaoText}
                      onChange={(e) => setObservacaoText(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {alertaSelecionado.status === 'recebido' && (
                      <button
                        type="button"
                        disabled={atualizarStatusMutacao.isPending}
                        onClick={() => aoSalvarAcao('em_vistoria')}
                        className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{atualizarStatusMutacao.isPending ? 'Salvando...' : 'Iniciar Vistoria'}</span>
                      </button>
                    )}
                    
                    {alertaSelecionado.status !== 'resolvido' && alertaSelecionado.status !== 'nao_procede' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={atualizarStatusMutacao.isPending}
                          onClick={() => aoSalvarAcao('resolvido')}
                          className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{atualizarStatusMutacao.isPending ? 'Salvando...' : 'Resolver'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={atualizarStatusMutacao.isPending}
                          onClick={() => aoSalvarAcao('nao_procede')}
                          className="flex-1 py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Não Procede</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-16">Selecione um alerta para ver os detalhes.</p>
            )}
          </Cartao>

        </div>

      </main>
        </>
      )}

    </div>
  )
}
