# Metodologia de Priorização da Fila — Método GUT

**Projeto:** GeoVision.AI
**Data:** 17 de Setembro de 2026
**Motivo:** validação técnica com a engenheira civil consultora (16/09/2026),
prevista como próximo passo em `docs/relatorio-treinamento-ia.md` (seção 7.1),
e leitura complementar do check-list de inspeção predial do IBAPE.

---

## 1. Por que este documento existe

A engenheira consultora respondeu a três perguntas sobre o sistema. Duas
delas ("o que é área em pixels" e "o que é confiança da IA") ela mesma
classificou como fora da sua área — são parâmetros do modelo de visão
computacional (Roboflow), não da engenharia estrutural, e continuam como
estão em `ai-service/app/services/risco.py` até uma avaliação técnica de
sistemas (não é o que este documento resolve).

A terceira pergunta, sobre priorização, **é** da área dela, e é o problema
real do produto: com centenas ou milhares de alertas por dia chegando à
Defesa Civil, e uma fração relevante deles classificada como "crítico" pela
IA, **o que decide qual desses críticos é visto primeiro?** Em palavras
dela:

> "Quando trabalhamos com 10 problemas, 3 é crítico é fácil, mas quando
> trabalhamos com 100, 1000, saber o que é crítico em 30 ou 300 é muito
> [...] Por isso no meu laudo uso o SWOT, só que o SWOT não divulgo para os
> meus clientes [...] não sei se a IA conseguiria nesse primeiro momento
> fazer essa análise, recomendo para uma segunda ou terceira etapa pensar
> nisso."

Ela recomendou adiar uma análise multicritério própria (o SWOT que usa em
laudos), por ser privada e pensada para um laudo individual, não para
triagem em massa. Em vez de esperar por uma segunda etapa, este documento
adota um método equivalente em propósito — priorizar dentro de um conjunto
grande de itens já classificados como relevantes — mas **público, citável e
já usado em inspeção predial no Brasil**: o método GUT.

---

## 2. O método GUT (Gravidade × Urgência × Tendência)

Fonte primária: GOMIDE, T. L. F.; PUJADAS, F. Z. A.; FAGUNDES NETO, J. C. P.
*Engenharia diagnóstica em edificações*. São Paulo: Pini, 2009 — adaptação do
método GUT (originalmente da teoria da decisão econômica) para manutenção
predial.

Citado e aplicado em: CARVALHO, E. M.; ALMEIDA, L. S. "Check-list para
inspeções prediais residenciais de múltiplos pavimentos: desenvolvimento e
aplicação". **XIX COBREAP — Congresso Brasileiro de Engenharia de Avaliações
e Perícias**, Foz do Iguaçu, 2017 (o PDF usado como fonte educacional desta
sessão de treinamento da IA).

Cada item recebe uma nota de 1 a 10 em três eixos independentes, e a
pontuação final é o produto dos três:

| Grau | Gravidade | Urgência | Tendência | Peso |
|---|---|---|---|---|
| Total | Perda de vidas, danos ao meio ambiente ou ao edifício | Evento em ocorrência | Evolução imediata | 10 |
| Alta | Ferimentos em pessoas, danos ao meio ambiente ou ao edifício | Evento prestes a ocorrer | Evolução em curto prazo | 8 |
| Média | Desconfortos, deterioração do meio ambiente ou do edifício | Evento prognosticado para breve | Evolução em médio prazo | 6 |
| Baixa | Pequenos incômodos ou prejuízos financeiros | Evento prognosticado para adiante | Evolução em longo prazo | 3 |
| Nenhuma | — | Evento imprevisto | Não vai evoluir | 1 |

> Quanto maior o valor final, maior a criticidade e a prioridade — a
> ordenação fica objetiva, com menos subjetividade no trabalho de quem
> prioriza (Gomide, Pujadas e Fagundes Neto, 2009).

Esse é exatamente o problema que a engenheira descreveu: transformar uma
lista de "N itens críticos" numa ordem única, sem depender de julgamento
caso a caso.

---

## 3. Como o GeoVision.AI adapta o método

Implementado em `ai-service/app/services/priorizacao.py`. Diferença
importante em relação ao uso clássico do GUT (onde G×U×T ordena *todos* os
itens juntos): aqui, **o nível de risco da IA continua sendo o critério
primário** — um alerta médio nunca passa na frente de um crítico só por ter
G×U×T maior. O GUT só desempata *dentro* do mesmo nível. Essa é uma decisão
deliberada: o GeoVision.AI já documenta (README, `relatorio.md`) a garantia
de que "crítico vem primeiro" na fila, e essa garantia de segurança não deve
depender de quão bem o cidadão respondeu ao questionário.

| Eixo GUT | De onde vem no GeoVision.AI | Por quê |
|---|---|---|
| **G — Gravidade** | `nivel_risco` (classificação da IA via Roboflow) | Já é o resultado de peso da patologia × confiança × área — decisão de visão computacional, fora do escopo desta mudança |
| **U — Urgência** | `evolucao` (pergunta do formulário: estável / aumentando devagar / aumentando rápido) | É o dado mais próximo, no questionário, do "evento em ocorrência" da tabela original |
| **T — Tendência** | `gravidade_percebida` (pergunta do formulário: percepção do próprio morador) | A engenheira apontou que a leitura sensorial do morador (visão, tato, olfato, audição) capta risco que uma foto sozinha não capta — ver seção 4 |

A pontuação e os três componentes (G, U, T) são calculados a cada consulta
da fila (não gravados no banco, para nunca ficarem dessincronizados de uma
reclassificação) e exibidos no Painel da Defesa Civil, junto com o alerta
selecionado — transparência é parte do motivo de trocar uma fórmula fechada
por um método citável.

---

## 4. A pergunta sobre ruído e vibração

Também em resposta direta à engenheira:

> "[...] tem uma visão 3D de todo o contexto que faz chegarmos à conclusão
> de que é risco [...] a nossa inteligência é baseada em cheiro, visão,
> tato (quando pisamos e sentimos o piso vibrar ou tocamos na parede),
> ouvimos barulhos, e isso tudo se transforma em dados de risco."

Uma foto não captura vibração, som ou cheiro. Em vez de tentar simular isso
computacionalmente (fora de alcance para este projeto), o formulário de Novo
Alerta passou a perguntar diretamente ao morador — o novo campo
`ruido_percebido` (`frontend/src/pages/NovoAlerta.tsx`, opções: nenhum /
estalos ou rangidos / vibração ao pisar / outro). É um proxy simples, mas
transforma em dado estruturado exatamente o tipo de sinal que a engenheira
descreveu como insubstituível por imagem.

---

## 5. Categorias de anomalia ampliadas

O formulário tinha quatro opções (`rachadura`, `inclinacao_muro`,
`infiltracao`, `outro`). Usando o check-list de Carvalho & Almeida (2017,
Apêndice C) e a Norma de Inspeção Predial do IBAPE/NA como referência,
somaram-se três categorias que um morador consegue observar a olho nu e que
o check-list trata como sistemas distintos, com implicações de gravidade
diferentes:

| Nova categoria | Item correspondente no check-list IBAPE | Por que é distinta |
|---|---|---|
| `desplacamento` | 4. Revestimento (parede/fachada) — "Destacamento / desagregação / desplacamento" | Reboco ou concreto se soltando é um risco de queda imediato, diferente de uma rachadura estática |
| `armadura_exposta` | 1. Estruturas — "Armadura exposta", "Corrosão" | A Norma trata ferragem exposta como achado estrutural, não estético — prioridade distinta de infiltração |
| `afundamento_recalque` | 2. Fundação — "Recalque diferencial" | Sintoma de fundação, não de vedação — categoria que o check-list separa deliberadamente das demais |

Essas três categorias **não** alteram a classificação de risco da IA (que
continua vindo do Roboflow); são uma melhoria na taxonomia que o morador usa
para descrever o que está vendo, alinhada à mesma fonte que orienta a
inspeção profissional.

---

## 6. O que este documento **não** decide

- Não altera `PESO_POR_CLASSE`, o fator de escala por área em pixels, nem o
  limiar de confiança em `risco.py`/`classificador_roboflow.py` — a
  engenheira foi clara que isso é avaliação de sistemas, não de engenharia,
  e seguem pendentes de uma avaliação técnica dedicada
  (`docs/relatorio-treinamento-ia.md`, seção 7).
- Não implementa o SWOT dela — permanece uma ferramenta privada de laudo
  individual, como a própria engenheira recomendou.
- Não substitui vistoria técnica nem a decisão final da Defesa Civil — como
  o resto do GeoVision.AI, é apoio à priorização da fila.

## 7. Próximos passos sugeridos

1. Validar com a engenheira se os pesos G/U/T atribuídos a cada resposta do
   formulário (`priorizacao.py`) fazem sentido do ponto de vista dela —
   hoje são uma primeira aproximação documentada, não uma calibração
   validada.
2. Quando o dataset justificar, considerar se `armadura_exposta` e
   `afundamento_recalque` também deveriam virar classes de detecção no
   Roboflow (ver o prompt de curadoria do dataset), em vez de só categorias
   autodeclaradas pelo cidadão.
