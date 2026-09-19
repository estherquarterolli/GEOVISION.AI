import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson, api } from '@/lib/api'
import type { UsuarioAdmin } from './AbaUsuarios'

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

export function AbaSuperAdmin() {
  const queryClient = useQueryClient()

  // Formulário para criar novo admin/usuário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState<'admin' | 'defesa_civil' | 'cidadao'>('admin')
  const [bairro, setBairro] = useState('')
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null)
  const [msgErro, setMsgErro] = useState<string | null>(null)

  // Lista de usuários
  const { data: usuarios = [], isLoading } = useQuery<UsuarioAdmin[]>({
    queryKey: ['admin-usuarios-lista'],
    queryFn: async () => {
      return await apiJson<UsuarioAdmin[]>('/api/admin/usuarios', {
        mensagemPadrao: 'Falha ao carregar usuários',
      })
    },
  })

  // Mutação para criar usuário
  const criarUsuarioMutacao = useMutation({
    mutationFn: async (dados: { nome: string; email: string; senha: string; papel: string; bairro_texto?: string }) => {
      return await apiJson<UsuarioAdmin>('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
        mensagemPadrao: 'Erro ao criar novo usuário',
      })
    },
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios-lista'] })
      queryClient.invalidateQueries({ queryKey: ['admin-logs-lista'] })
      setMsgSucesso(`Usuário ${novo.email} criado com a função de ${novo.papel === 'admin' ? 'Administrador' : novo.papel === 'defesa_civil' ? 'Defesa Civil' : 'Cidadão'}.`)
      setMsgErro(null)
      setNome('')
      setEmail('')
      setSenha('')
      setBairro('')
    },
    onError: (err: any) => {
      setMsgErro(err instanceof Error ? err.message : 'Falha ao criar usuário.')
      setMsgSucesso(null)
    },
  })

  // Mutação para alterar papel
  const alterarPapelMutacao = useMutation({
    mutationFn: async ({ id, novoPapel }: { id: string; novoPapel: 'admin' | 'defesa_civil' | 'cidadao' }) => {
      return await apiJson<UsuarioAdmin>(`/api/admin/usuarios/${id}/papel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papel: novoPapel }),
        mensagemPadrao: 'Erro ao alterar papel do usuário',
      })
    },
    onSuccess: (atualizado) => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios-lista'] })
      queryClient.invalidateQueries({ queryKey: ['admin-logs-lista'] })
      setMsgSucesso(`Função de ${atualizado.email} alterada para ${atualizado.papel === 'admin' ? 'Administrador' : atualizado.papel === 'defesa_civil' ? 'Defesa Civil' : 'Cidadão'}.`)
      setMsgErro(null)
    },
    onError: (err: any) => {
      setMsgErro(err instanceof Error ? err.message : 'Falha ao alterar função do usuário.')
      setMsgSucesso(null)
    },
  })

  // Mutação para excluir usuário
  const excluirUsuarioMutacao = useMutation({
    mutationFn: async (id: string) => {
      return await api(`/api/admin/usuarios/${id}`, {
        method: 'DELETE',
        mensagemPadrao: 'Erro ao excluir usuário',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios-lista'] })
      queryClient.invalidateQueries({ queryKey: ['admin-logs-lista'] })
      setMsgSucesso('Usuário removido com sucesso do sistema.')
      setMsgErro(null)
    },
    onError: (err: any) => {
      setMsgErro(err instanceof Error ? err.message : 'Falha ao excluir usuário.')
      setMsgSucesso(null)
    },
  })

  function aoSubmeterCriacao(e: FormEvent) {
    e.preventDefault()
    setMsgSucesso(null)
    setMsgErro(null)
    criarUsuarioMutacao.mutate({
      nome,
      email,
      senha,
      papel,
      bairro_texto: bairro.trim() || undefined,
    })
  }

  function confirmarExclusao(u: UsuarioAdmin) {
    if (u.email.toLowerCase() === 'estherquarterollii@gmail.com') {
      alert('A sua conta principal de Administradora Master não pode ser removida.')
      return
    }
    const confirma = window.confirm(`Deseja remover o acesso de ${u.nome} (${u.email})?`)
    if (confirma) {
      excluirUsuarioMutacao.mutate(u.id)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 lg:p-6">
      {/* Título de Seção Limpo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <svg className="size-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Gestão de Contas & Funções</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastre novos operadores e gerencie as permissões de acesso ao sistema
          </p>
        </div>

        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-sky-950 border border-sky-700 text-sky-300">
          <span className="size-2 rounded-full bg-sky-400 animate-pulse" />
          Acesso Master: estherquarterollii@gmail.com
        </span>
      </div>

      {/* Avisos */}
      {msgSucesso && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-300 flex items-center gap-2.5">
          <svg className="size-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{msgSucesso}</span>
        </div>
      )}
      {msgErro && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-bold text-rose-300 flex items-center gap-2.5">
          <svg className="size-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{msgErro}</span>
        </div>
      )}

      {/* Formulário: Criar Novo Usuário / Admin */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <svg className="size-4.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Criar Novo Usuário no Sistema</h3>
        </div>

        <form onSubmit={aoSubmeterCriacao} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" noValidate>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Nome Completo</label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">E-mail</label>
            <input
              type="email"
              required
              placeholder="carlos@exemplo.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Senha Inicial</label>
            <input
              type="password"
              required
              placeholder="Mínimo 8 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Função no Sistema</label>
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as any)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 cursor-pointer"
            >
              <option value="admin">Administrador (Acesso total)</option>
              <option value="defesa_civil">Defesa Civil (Operador de Triagem)</option>
              <option value="cidadao">Cidadão (Apenas envio)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Bairro / Lotação (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Engenho de Dentro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={criarUsuarioMutacao.isPending || !nome || !email || !senha}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>{criarUsuarioMutacao.isPending ? 'Salvando...' : 'Cadastrar Usuário'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Privilégios com Alto Contraste */}
      <div className="overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="size-4.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Permissões de Usuários</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">{usuarios.length} usuários</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b-2 border-slate-700 text-slate-300 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">E-mail</th>
                <th className="px-5 py-3.5">Função Atual</th>
                <th className="px-5 py-3.5 text-right">Alterar Função</th>
                <th className="px-4 py-3.5 text-center w-16">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Carregando usuários...
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => {
                  const isSuperAdmin = u.email.toLowerCase() === 'estherquarterollii@gmail.com'

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-white flex items-center gap-3">
                        <div className="size-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-400/30 text-white font-black flex items-center justify-center text-xs shadow-sm shrink-0">
                          {extrairIniciais(u.nome, u.email)}
                        </div>
                        <span>{u.nome || u.email}</span>
                        {isSuperAdmin && (
                          <span className="text-[10px] font-extrabold text-sky-300 bg-sky-950 border border-sky-700 px-2 py-0.5 rounded-full">
                            Principal
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sky-300 font-mono text-xs">{u.email}</td>
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

                      {/* Botões para dar e retirar funções */}
                      <td className="px-5 py-3.5 text-right">
                        {isSuperAdmin ? (
                          <span className="text-xs font-semibold text-sky-400">
                            Conta Master
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {u.papel !== 'admin' && (
                              <button
                                type="button"
                                disabled={alterarPapelMutacao.isPending}
                                onClick={() => alterarPapelMutacao.mutate({ id: u.id, novoPapel: 'admin' })}
                                className="px-2.5 py-1.5 rounded-md bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-bold transition cursor-pointer shadow-xs"
                              >
                                Tornar Admin
                              </button>
                            )}

                            {u.papel !== 'defesa_civil' && (
                              <button
                                type="button"
                                disabled={alterarPapelMutacao.isPending}
                                onClick={() => alterarPapelMutacao.mutate({ id: u.id, novoPapel: 'defesa_civil' })}
                                className="px-2.5 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition cursor-pointer shadow-xs"
                              >
                                Tornar Defesa Civil
                              </button>
                            )}

                            {u.papel !== 'cidadao' && (
                              <button
                                type="button"
                                disabled={alterarPapelMutacao.isPending}
                                onClick={() => alterarPapelMutacao.mutate({ id: u.id, novoPapel: 'cidadao' })}
                                className="px-2.5 py-1.5 rounded-md bg-slate-700/70 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition cursor-pointer shadow-xs"
                              >
                                Tornar Cidadão
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Exclusão */}
                      <td className="px-4 py-3.5 text-center">
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => confirmarExclusao(u)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition cursor-pointer"
                            title="Remover usuário"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
