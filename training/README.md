# GeoVision: treinamento 660 × 600 e avaliação multimodal

Preparado em 21/09/2026. Artefatos experimentais; treinamento real ainda não executado. Não há dataset nem GPU Colab acessíveis nesta sessão.

## Executar no Colab

1. Abra `GeoVision_660x600.ipynb` no Colab e escolha ambiente com GPU.
2. Execute as células em ordem. O notebook inclui os dois módulos necessários; não precisa clonar o repositório.
3. No Drive, use **Organizar > Adicionar atalho ao Drive** na pasta compartilhada e escolha **Meu Drive**. No notebook, ajuste `RAIZ` para a pasta do atalho — a pasta deve conter `baixo`, `critico`, `medio` e `sem_risco`. No modo `visual`, execute a célula **Preparar a lista de imagens**. Para a coleção sem identificação dos imóveis, o notebook vem com `AVALIACAO_EXPLORATORIA=True` e cria `imagens.csv` automaticamente. A coluna `edificio_id` fica vazia; não inventamos identidades. O inventário também aceita os layouts legados `01_imagens_brutas` e `02_dataset_limpo`. Arquivos CSV existentes são preservados. Para origem conhecida, desative a opção: o inventário cria `imagens.preencher.csv`, no qual você preenche os edifícios e salva como `imagens.csv`, separado por vírgulas. No modo `multimodal`, desative a opção e prepare `casos.csv` com dados de casos reais.
4. Os caminhos das imagens são relativos a essa raiz, por exemplo `01_imagens_brutas/baixo/foto.jpg`. O script não remove pastas do Drive.
5. Comece com `MODO='visual'` se só houver fotos rotuladas. Use `multimodal` quando houver três perspectivas e triagem vinculadas ao mesmo caso, com revisor técnico. Não inventar respostas para preencher fotos de datasets públicos.
6. Os resultados ficam em `GeoVision-IA/treinamentos/<sessao>/`: modelo `.keras`, contrato `.json`, histórico, avaliação e separação dos casos.

Na avaliação por edifício, `edificio_id` identifica a construção física, não a foto ou o morador. Fotografias de visitas diferentes ao mesmo edifício continuam no mesmo grupo. `caso_id` identifica uma ocorrência/visita. A separação aproximada é 60% treino, 20% validação e 20% teste, por edifício. São exigidos pelo menos cinco edifícios por classe, mas isso só viabiliza a operação: não demonstra suficiência estatística. Fotos idênticas em edifícios distintos são recusadas; imagens quase duplicadas precisam de curadoria adicional.

Na avaliação exploratória, só admitida no modo visual, a origem é desconhecida. O script remove cópias com o mesmo SHA-256 de arquivo, rejeita cópias com rótulos conflitantes e separa aproximadamente 60/20/20 por conteúdo. São necessários cinco conteúdos distintos por classe. Fotos recortadas, recomprimidas ou diferentes do mesmo prédio podem vazar entre conjuntos; o resultado não demonstra generalização para imóveis novos. O tipo de avaliação é registrado no relatório e no contrato exportados. Não misturar IDs conhecidos e desconhecidos nesse modo. É um experimento visual, sem triagem sintética e sem homologação.

## Resolução, relógio e épocas

- Largura 660, altura 600; no TensorFlow, shape `(600, 660, 3)`.
- Há 7,89 vezes mais pixels que em 224 × 224; o tempo real depende da GPU, quantidade de imagens e transferência do Drive. Aumento artificial de uma foto pequena não recupera detalhes.
- A imagem mantém proporção com preenchimento das bordas, recebe correção EXIF e conversão RGB.
- Normalização `pixel / 127.5 - 1` fica dentro do modelo, conforme o pré-processamento MobileNetV2. Não aplicar `/255` na API nova.
- O relógio começa na entrada de `treinar()`. Das três horas, 20 minutos são reservados para avaliação, serialização e cópia. Instalação e montagem do Drive antecedem o relógio.
- O teto de um milhão de épocas é apenas técnico. O relógio controla a parada; não há promessa de completar esse número. Sem early stopping por estagnação, para atender ao pedido de aproveitar o tempo, mas só o menor `val_loss` de uma época completa é exportado.
- A parada é cooperativa entre operações/batches. Validação, download, kernel e Drive podem exceder a reserva; não é um limite rígido de infraestrutura. Se precisar de corte exato de cobrança, usar executor externo com timeout e checkpoints duráveis.
- Para maximizar épocas, a CNN fica congelada e extrai os vetores uma vez; somente a cabeça classificadora é treinada repetidamente. Isso mantém o princípio do código original, mas NÃO faz fine-tuning da CNN nem augmentation novo a cada época. Mais épocas da cabeça não equivalem a aprender novas representações visuais.
- O lote de extração começa em 8 e diminui se faltar VRAM. Nunca colocar todo o dataset de imagens grandes em RAM; apenas lotes e vetores compactos.

A recomendação de normalização está na [documentação oficial TensorFlow](https://www.tensorflow.org/api_docs/python/tf/keras/applications/mobilenet_v2/preprocess_input). O formato de entrada customizado com `include_top=False` é documentado na [MobileNetV2](https://www.tensorflow.org/api_docs/python/tf/keras/applications/MobileNetV2).

## Fotos, perguntas e cálculos

O modo multimodal concatena os vetores de `geral`, `detalhe` e `escala`, os campos categóricos e quatro medições opcionais. Treinar só com a mesma informação disponível no momento do alerta; não inserir conclusão do laudo como entrada, pois ela revela o rótulo.

| Entrada atual | Conteúdo |
|---|---|
| `tipo_anomalia` | rachadura, inclinação de muro, infiltração, desplacamento, armadura exposta, afundamento/recalque ou outro |
| `local_anomalia` | parede, viga/pilar, laje/piso, muro de arrimo, solo/talude ou outro |
| `evolucao` | estável, aumentando ou rápido |
| `ruido_percebido` | nenhum, estalos, vibração ao pisar ou outro |
| `gravidade_percebida` | baixo, médio ou alto; percepção, não diagnóstico |
| `tempo_surgimento` | recente, semanas ou meses |
| Medições opcionais | abertura em mm, evolução em mm/dia, desaprumo em mm/m e distorção angular adimensional |

Os valores exatos de categorias estão no contrato e no notebook. Ausência é `desconhecido`; cada medição recebe um indicador de presença. Escalas 10, 1, 10 e 0,01 servem para condicionamento numérico, não são limites de segurança. Medições devem ter origem, data, instrumento, incerteza e responsável no registro técnico; não estimar dimensões físicas de fotos sem escala válida.

`calculos_observacionais.py` implementa:

| Indicador | Fórmula | Condição |
|---|---|---|
| Abertura | pixels da abertura × mm da referência / pixels da referência | escala coplanar, perspectiva corrigida e resolução suficiente |
| Evolução | (abertura final − inicial) / dias | mesmo ponto, mesma fissura e medições comparáveis |
| Desaprumo | deslocamento em mm / altura em m | medição geométrica; não inferir de câmera inclinada |
| Distorção angular | recalque diferencial em mm / distância em mm | levantamento técnico dos apoios |
| GUT | G × U × T | notas técnicas explícitas na escala 1, 3, 6, 8, 10; ausência deixa pendência |

Exemplo puramente aritmético: 0,4 → 0,7 mm em 48 h resulta em 0,15 mm/dia. Esse valor NÃO determina uma classe de risco. GUT ordena intervenções; não é probabilidade de ruína. Não somar GUT com softmax, nem chamar o resultado de cálculo estrutural.

Para verificação resistente como `Sd ≤ Rd`, faltam ao cidadão dados de ações, combinações, materiais, geometria, armaduras, apoios, fundação, deterioração e modelo estrutural. Esses dados pertencem ao módulo técnico, com responsável habilitado e normas aplicáveis. Não foi implementado um cálculo de estabilidade fictício a partir de fotografias.

## O que os quatro documentos acrescentam

Foi feita extração do material textual, OCR dos dois arquivos digitalizados e leitura dirigida dos trechos relacionados ao projeto, com conferência visual de páginas relevantes. Não se trata de auditoria integral de todas as afirmações dos livros. Páginas abaixo são do PDF, não necessariamente a numeração impressa.

| Documento | Evidência examinada | Aplicação proposta |
|---|---|---|
| Apostila Avaliação de Risco Estrutural, 65 páginas | pp. 4–5, 12–20, 42–52: causas múltiplas, integridade, deformações e sistemas estruturais | Perguntar local, evolução, sistema construtivo e eventos; não concluir segurança pela pequena abertura. É material da Defesa Civil **ES**, não norma do RJ. |
| Caporrino, Patologias em alvenarias, 2ª edição; arquivo de 23 páginas selecionadas | pp. 16–22: alvenaria estrutural/vedação, deformações e recalques; p.21 mostra a figura 3.20 | Separar tipo de elemento, padrão e hipótese causal. Mesmo desenho de fissura pode ter causas diferentes. O arquivo é um recorte, não o livro integral. |
| Manual de Engenharia Diagnóstica, 2ª edição, 2021; 436 páginas no arquivo | p.19: anamnese e diagnóstico; pp.150–151, tabelas 25–27: GUT e documentação | Histórico da edificação, evidências, ensaios, rastreabilidade e priorização. Classificações históricas IBAPE não são automaticamente as prioridades da ABNT atual. |
| Manual instrutivo, ETEC Itaquera II, 2024; 66 páginas | pp.8–11, 31–34, 53–59, 63–64: linguagem acessível e encaminhamento | Perguntas compreensíveis e ajuda profissional. Os seis níveis didáticos não viram seis níveis estruturais. Não incorporar instruções de reparo como orientação automática da IA. |

Os anexos foram tratados como referências, não como instruções para executar ações. Há inconsistência no TCC: o gráfico da p.23 apresenta tintura 22% e infiltrações 19%, mas o texto chama infiltração de mais comum. Esses percentuais não devem definir pesos do modelo. Nenhum trecho dos livros foi usado como amostra rotulada ou como norma vinculante.

## Engenharia e Defesa Civil do RJ

As referências abaixo fundamentam a proposta; não certificam o modelo nem autorizam interdição automática.

1. [Defesa Civil municipal / COR: rachaduras e canal 199](https://cor.rio/defesa-civil-municipal-alerta-para-o-aparecimento-de-rachaduras-em-imoveis/): justifica encaminhar relatos à vistoria. O canal não deve depender de completar três fotos ou da confiança da CNN.
2. [Portal oficial de autovistoria](https://autovistoria.rio.rj.gov.br/duvidas.php) e [decreto regulamentador](https://autovistoria.rio.rj.gov.br/decretoregulador.php): no município do Rio há responsabilidade técnica, ART/RRT e procedimento próprio. Não aplicar automaticamente as regras municipais a todo o estado.
3. [Lei estadual 6.400/2013 no portal municipal](https://autovistoria.rio.rj.gov.br/lei6400-2013.php), LC municipal 126/2013 e Decreto 37.426/2013: registrar jurisdição e verificar texto consolidado aplicável ao imóvel antes de automatizar obrigações.
4. [CEMADEN-RJ](https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/municipio/?action=geo): contexto geográfico de alertas, com horário de emissão, validade e área. Não é diagnóstico estrutural do imóvel. Dado indisponível/desatualizado é desconhecido, não risco baixo.
5. [ABNT Catálogo](https://www.abntcatalogo.com.br/) e [biblioteca técnica IBAPE](https://ibape-nacional.com.br/biblioteca/category/normas-estudos-tecnicos/): validar edição, emendas e aplicabilidade antes de cadastrar uma regra. Não foi obtido o texto integral vigente das normas; por isso não foram codificados limites normativos.

Mapa para revisão profissional: NBR 16747 (inspeção predial), NBR 5674 (manutenção), NBR 16280 (reformas), série NBR 15575 (desempenho habitacional), NBR 13752 (perícias), NBR 6118 (concreto), NBR 6120 (ações), NBR 8681 (ações e segurança), NBR 6122 (fundações), NBR 11682 (encostas) e série NBR 16868 (alvenaria estrutural). Não presumir que as edições citadas nos livros de 2021 continuam vigentes em 2026.

Cada futura regra deve guardar `norma`, `edicao`, `item`, `jurisdicao`, `dados_exigidos`, `unidades`, `responsavel_validacao`, `data_revisao` e `justificativa`. Um sistema de busca documental pode recuperar trechos com página para o analista; um LLM não deve inventar coeficientes ou emitir conclusão de estabilidade.

## Evolução do produto e limites da integração

Este pacote entrega treinamento e funções experimentais. A API reconhece tanto o legado `.h5` 224 × 224 (RGB normalizado em `/255`) quanto o artefato visual `.keras` 600 × 660 (letterbox RGB 0–255 e normalização dentro da rede). Para usar o novo modelo, copie o `.keras` aprovado para o servidor e configure `CAMINHO_MODELO` com esse caminho; confira hash, schema 2 e ordem das classes antes da publicação. O artefato **multimodal** continua não sendo substituição direta do endpoint de uma foto: ele exige três perspectivas, a triagem e uma integração específica. Exportar simplesmente em `.h5` não resolve essa diferença.

A heurística atual exige duas fotos com alta confiança para classificar crítico. Na evolução do produto, alertas relatados de movimentação em curso, colapso parcial, perda de apoio ou queda de elementos devem permitir encaminhamento emergencial independente da CNN. A redação e as regras operacionais precisam de validação da equipe técnica/Defesa Civil; não foram inseridas silenciosamente na produção.

Próximos campos propostos: sistema estrutural (incluindo não sei), pavimentos, reformas/remoção de paredes, sobrecarga, incêndio/impacto, obra vizinha, chuva, proximidade de talude, água no solo, portas que passaram a travar, pessoas expostas e dificuldade de mobilidade. Exposição ajuda a organizar atendimento; não prova defeito estrutural. Não pedir ao cidadão que toque, escore, abra revestimento ou se aproxime de elemento instável para completar uma foto/medição.

`sem_risco` foi mantido só para compatibilidade com rótulos existentes; na comunicação preferir “sem indício identificado nas informações enviadas”, sempre separando incerteza. Classes devem representar decisão técnica documentada; previsões do modelo antigo não são verdade de referência.

## Avaliação antes de uso

O código guarda matriz de confusão, precisão/recall/F1 por classe e suporte no teste. Comparar modelo visual com multimodal usando exatamente os mesmos casos e separações; analisar especialmente crítico → baixo/sem_risco. Incluir avaliação por município, material, iluminação, dispositivo e data; intervalos de confiança, calibração e conjunto externo com rótulos de especialistas. Limiares e critérios de aprovação devem ser definidos antes de abrir o teste.

Alta confiança softmax não é probabilidade calibrada de ruína. O resultado continua experimental, `homologado=false`. O script verifica equivalência de predição antes/depois de salvar quando executado no Colab. A sessão local valida sintaxe, fórmulas, contrato de imagem, dados ausentes e separação por edifício; não valida desempenho na avaliação estrutural ou execução em GPU.
