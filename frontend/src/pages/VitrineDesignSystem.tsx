import { useState, type ReactNode } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Campo } from '@/components/ui/Campo'
import { SeloRisco } from '@/components/ui/SeloRisco'
import { TerritorioAoDado } from '@/components/marca/TerritorioAoDado'
import { ROTULO_STATUS, type NivelRisco } from '@/types/dominio'

/**
 * Vitrine do design system — entregável do Sprint 0.
 *
 * Rota de desenvolvimento (`/design-system`), fora da navegação principal.
 * Existe para validar visualmente tokens e componentes novos sem depender de
 * dado real ou sessão autenticada — mantida como referência viva para os
 * próximos sprints, em vez de descartada quando o roteador entrou.
 */

const NIVEIS: NivelRisco[] = ['baixo', 'medio', 'critico']

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg">{titulo}</h2>
        <hr className="divisor-territorio" />
      </div>
      {children}
    </section>
  )
}

export function VitrineDesignSystem() {
  const [nome, setNome] = useState('')
  const [processando, setProcessando] = useState(false)

  return (
    <div className="min-h-dvh">
      <header className="bg-superficie border-borda relative overflow-hidden border-b">
        <TerritorioAoDado className="pointer-events-none absolute -top-2 right-0 h-36" />
        <div className="relative mx-auto max-w-3xl px-5 py-8">
          <h1 className="text-2xl">
            GeoVision<span className="text-marca-laranja">.AI</span>
          </h1>
          <p className="text-tinta-suave mt-1 text-sm">
            Design System · Do Território ao Dado
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-5 py-10">
        <Secao titulo="Paleta">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Laranja sinal', 'bg-marca-laranja', '#F2811D'],
              ['Azul profundo', 'bg-marca-azul', '#0E5C82'],
              ['Petróleo', 'bg-marca-petroleo', '#0A3A52'],
              ['Risco baixo', 'bg-risco-baixo', '#2E9E5B'],
              ['Risco médio', 'bg-risco-medio', '#E8A93B'],
              ['Risco crítico', 'bg-risco-critico', '#D9463B'],
            ].map(([nomeCor, classe, hex]) => (
              <Cartao key={hex} className="overflow-hidden">
                <div className={`h-16 ${classe}`} />
                <div className="p-3">
                  <p className="text-sm font-medium">{nomeCor}</p>
                  <p className="metrica text-tinta-suave text-xs">{hex}</p>
                </div>
              </Cartao>
            ))}
          </div>
        </Secao>

        <Secao titulo="Selo de risco">
          <div className="flex flex-wrap items-center gap-3">
            {NIVEIS.map((n) => (
              <SeloRisco key={n} nivel={n} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {NIVEIS.map((n) => (
              <SeloRisco key={n} nivel={n} variante="solido" confianca={0.92} />
            ))}
          </div>
        </Secao>

        <Secao titulo="Botões">
          <div className="flex flex-wrap gap-3">
            <Botao variante="primaria">Enviar alerta</Botao>
            <Botao variante="secundaria">Ver no mapa</Botao>
            <Botao variante="fantasma">Cancelar</Botao>
            <Botao variante="primaria" carregando>
              Enviando
            </Botao>
          </div>
        </Secao>

        <Secao titulo="Formulário">
          <Cartao className="flex flex-col gap-4 p-5">
            <Campo
              rotulo="Nome completo"
              required
              placeholder="Como devemos te chamar"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Campo
              rotulo="Bairro"
              ajuda="Usamos para mostrar os riscos mapeados perto de você."
              placeholder="Engenho de Dentro"
            />
            <Campo
              rotulo="E-mail"
              type="email"
              erro="Digite um e-mail válido."
              defaultValue="esther@"
            />
          </Cartao>
        </Secao>

        <Secao titulo="Estado: IA processando">
          <Cartao className="flex flex-col gap-3 p-5">
            <p className="text-sm font-medium">Analisando sua foto…</p>
            <div className="progresso-ia" />
            <p className="text-tinta-suave text-xs">
              {ROTULO_STATUS.processando} — a Defesa Civil recebe o alerta assim que a
              classificação terminar.
            </p>
            <Botao
              variante="fantasma"
              onClick={() => setProcessando((p) => !p)}
              className="self-start"
            >
              {processando ? 'Ocultar' : 'Mostrar'} resultado
            </Botao>
            {processando && (
              <div className="border-borda flex items-center gap-3 border-t pt-3">
                <SeloRisco nivel="critico" variante="solido" confianca={0.87} />
                <span className="text-tinta-suave text-xs">
                  Encaminhado para vistoria prioritária.
                </span>
              </div>
            )}
          </Cartao>
        </Secao>

        <Secao titulo="Tema do Painel da Defesa Civil">
          <div className="tema-painel rounded-painel flex flex-col gap-4 p-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                ['Alertas ativos', '128'],
                ['Críticos', '12'],
                ['Tempo médio', '4,2h'],
              ].map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <p className="text-tinta-suave text-xs">{rotulo}</p>
                  <p className="metrica text-2xl">{valor}</p>
                </div>
              ))}
            </div>
            <hr className="divisor-territorio" />
            <div className="flex flex-wrap gap-2">
              <Botao contexto="painel" variante="primaria">
                Emitir ordem de vistoria
              </Botao>
              <Botao contexto="painel" variante="fantasma">
                Marcar como resolvido
              </Botao>
            </div>
          </div>
        </Secao>
      </main>
    </div>
  )
}
