import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'

export interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  papel: 'cidadao' | 'defesa_civil' | 'admin'
  bairro_texto?: string | null
  termos_aceitos_em?: string | null
  criado_em: string
}

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
  return 'US'
}

export function AbaUsuarios() {
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState<string>('todos')

  const { data: usuarios = [], isLoading, refetch } = useQuery<UsuarioAdmin[]>({
    queryKey: ['admin-usuarios-lista'],
    queryFn: async () => {
      return await apiJson<UsuarioAdmin[]>('/api/admin/usuarios', {
        mensagemPadrao: 'Falha ao carregar usuários cadastrados',
      })
    },
  })

  const usuariosFiltrados = usuarios.filter((u) => {
    const bateTexto =
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase()) ||
      (u.bairro_texto && u.bairro_texto.toLowerCase().includes(busca.toLowerCase()))
    const batePapel = filtroPapel === 'todos' || u.papel === filtroPapel
    return bateTexto && batePapel
  })

  const contagemCidadaos = usuarios.filter((u) => u.papel === 'cidadao').length
  const contagemDefesaCivil = usuarios.filter((u) => u.papel === 'defesa_civil').length
  const contagemAdmins = usuarios.filter((u) => u.papel === 'admin').length

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 lg:p-6">
      {/* Contadores com Ícones SVG e Alto Contraste */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Contas</p>
            <p className="text-2xl font-extrabold text-white mt-1">{usuarios.length}</p>
          </div>
          <div className="size-10 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cidadãos</p>
            <p className="text-2xl font-extrabold text-slate-100 mt-1">{contagemCidadaos}</p>
          </div>
          <div className="size-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Defesa Civil</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">{contagemDefesaCivil}</p>
          </div>
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Administradores</p>
            <p className="text-2xl font-extrabold text-sky-400 mt-1">{contagemAdmins}</p>
          </div>
          <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou bairro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filtroPapel}
            onChange={(e) => setFiltroPapel(e.target.value)}
            className="text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 cursor-pointer"
          >
            <option value="todos">Todos os Papéis ({usuarios.length})</option>
            <option value="cidadao">Cidadãos ({contagemCidadaos})</option>
            <option value="defesa_civil">Defesa Civil ({contagemDefesaCivil})</option>
            <option value="admin">Administradores ({contagemAdmins})</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Atualizar lista"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabela de Usuários com Alto Contraste */}
      <div className="overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b-2 border-slate-700 text-slate-300 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Nome do Usuário</th>
                <th className="px-5 py-3.5">E-mail</th>
                <th className="px-5 py-3.5">Bairro</th>
                <th className="px-5 py-3.5">Função</th>
                <th className="px-5 py-3.5">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Carregando base de usuários...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Nenhum usuário encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-400/30 text-white font-black flex items-center justify-center text-xs shadow-sm shrink-0">
                        {extrairIniciais(u.nome, u.email)}
                      </div>
                      <span>{u.nome || u.email}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sky-300 font-mono text-xs">{u.email}</td>
                    <td className="px-5 py-3.5 text-slate-300">{u.bairro_texto || 'Não informado'}</td>
                    <td className="px-5 py-3.5">
                      {u.papel === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          <span className="size-1.5 rounded-full bg-sky-400" />
                          Admin
                        </span>
                      ) : u.papel === 'defesa_civil' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          Defesa Civil
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-200 border border-slate-600">
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Cidadão
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">
                      {new Date(u.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
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
