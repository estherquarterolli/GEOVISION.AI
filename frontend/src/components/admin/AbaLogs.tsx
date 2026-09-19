import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'

export interface LogAuditoria {
  id: string
  usuario_id?: string | null
  usuario_email?: string | null
  acao: string
  detalhes?: string | null
  ip_origem?: string | null
  criado_em: string
}

export function AbaLogs() {
  const [busca, setBusca] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('todas')

  const { data: logs = [], isLoading, refetch } = useQuery<LogAuditoria[]>({
    queryKey: ['admin-logs-lista'],
    queryFn: async () => {
      return await apiJson<LogAuditoria[]>('/api/admin/logs', {
        mensagemPadrao: 'Falha ao carregar logs de auditoria',
      })
    },
  })

  const logsFiltrados = logs.filter((log) => {
    const texto = `${log.acao} ${log.detalhes || ''} ${log.usuario_email || ''}`.toLowerCase()
    const bateTexto = texto.includes(busca.toLowerCase())
    const bateAcao = filtroAcao === 'todas' || log.acao === filtroAcao
    return bateTexto && bateAcao
  })

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 lg:p-6">
      {/* Header e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Trilha de Auditoria</h2>
            <p className="text-[11px] text-slate-400">Registro cronológico de operações no sistema</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <select
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
            className="text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 w-full sm:w-auto cursor-pointer"
          >
            <option value="todas">Todas as Ações</option>
            <option value="CRIAR_USUARIO">Criação de Usuário</option>
            <option value="ALTERAR_PAPEL">Alteração de Função</option>
            <option value="EXCLUIR_USUARIO">Exclusão de Usuário</option>
          </select>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white transition shrink-0 cursor-pointer"
            title="Atualizar logs"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabela de Logs com Alto Contraste */}
      <div className="overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b-2 border-slate-700 text-slate-300 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Data / Hora</th>
                <th className="px-5 py-3.5">Ação Realizada</th>
                <th className="px-5 py-3.5">Autor da Ação</th>
                <th className="px-5 py-3.5">Detalhes do Evento</th>
                <th className="px-5 py-3.5">IP de Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Carregando trilha de auditoria...
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-300 font-mono whitespace-nowrap text-xs">
                      {new Date(log.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-3.5">
                      {log.acao.includes('CRIAR') ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {log.acao}
                        </span>
                      ) : log.acao.includes('EXCLUIR') ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {log.acao}
                        </span>
                      ) : log.acao.includes('ALTERAR') ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {log.acao}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          {log.acao}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sky-300 font-mono text-xs font-semibold">{log.usuario_email || 'Sistema'}</td>
                    <td className="px-5 py-3.5 text-white font-medium">{log.detalhes || 'Sem detalhes adicionais.'}</td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{log.ip_origem || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
