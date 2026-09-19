# Relatório Técnico de Treinamento e Curadoria da IA — GeoVision.AI

**Projeto:** GeoVision.AI — Plataforma Inteligente de Monitoramento e Triagem de Risco Geotécnico e Estrutural  
**Data:** 25 de Agosto de 2026  
**Versão do Documento:** 1.0  
**Status do Módulo de IA:** Em fase de calibração e expansão de dataset  

---

## 1. Sumário Executivo

O presente relatório consolida a arquitetura, metodologia de treinamento, diagnósticos de inconsistência e o plano de ação técnico para elevar a precisão do módulo de Visão Computacional e Classificação de Risco do **GeoVision.AI**.

O sistema opera através de uma arquitetura híbrida:
1. **Detecção de Objetos / Patologias (Roboflow / YOLO):** Identificação e localização espacial de anomalias (`crack`, `corrosion`, `stain`, `mold`, `deterioration`, `moisture`).
2. **Motor Heurístico de Risco Estrutural (Python / FastAPI):** Algoritmo determinístico ponderado que calcula a severidade global (`baixo`, `medio`, `critico`) com base na confiança estatística, tipo de patologia e área percentual afetada na imagem.

---

## 2. Diagnóstico das Inconsistências Atuais

Foram identificados 4 fatores principais que causam oscilações nas predições do modelo em ambiente de homologação:

| Fator | Causa Raiz | Impacto no Sistema |
|---|---|---|
| **Ambiguidade de Classes** | Sobreposição visual entre `stain` (mancha) e `moisture` (umidade), e entre `crack` fino (fissura) e `crack` profundo (rachadura). | Falsos positivos de alta gravidade em elementos meramente estéticos. |
| **Ausência de Escala Métrica** | Fotos tiradas a curta distância ampliam anomalias milimétricas, distorcendo o cálculo de `area`. | Fotos de trincas inofensivas de 1mm ocupando 40% do enquadramento recebem score de risco crítico. |
| **Ruído de Iluminação e Fundo** | Sombras fortes de árvores, texturas rugosas de chapisco e cabos elétricos sendo interpretados como fissuras lineares. | Queda de precisão (*precision*) e geração de alertas falsos. |
| **Desbalanceamento do Dataset** | Maior volume de fotos com defeitos evidentes em relação a estruturas íntegras (classe negativa/controle). | Viés do modelo em forçar predições mesmo em paredes íntegras. |

---

## 3. Metodologia de Coleta e Curadoria de Dados (Dataset)

### 3.1. Requisitos de Aquisição de Imagens
Para garantir a padronização das amostras de treino:
- **Resolução Mínima:** 1080p (1920x1080), formato JPEG ou PNG.
- **Protocolo de 3 Tomadas:**
  1. *Visão Panorâmica (Contexto):* Distância de 3m a 5m, mostrando a estrutura completa.
  2. *Visão Média (Elemento):* Enquadrando o pilar, viga, parede ou talude afetado.
  3. *Visão Detalhe (Patologia com Escala):* Foto aproximada contendo objeto de calibração métrica (moeda de R$ 1, cartão ou régua fissurométrica).

### 3.2. Taxonomia Padronizada de Classes

```
Patologias Estruturais & Ambientais
├── Fissuras e Descontinuidades
│   ├── micro_crack (< 1mm - cosmética)
│   ├── structural_crack (> 3mm - estrutural)
│   └── shear_crack (fissura diagonal / 45°)
├── Corrosão e Degradação
│   ├── exposed_rebar (armadura exposta)
│   └── spalling (desplacamento/desagregação de concreto)
├── Ação da Água
│   ├── surface_stain (mancha superficial seca)
│   └── active_moisture (infiltração ativa/eflorescência)
└── Geotecnia e Encostas
    ├── soil_scarp (degrau de abatimento no solo)
    └── wall_bulge (embarrigamento de muro de arrimo)
```

---

## 4. Pipeline de Treinamento e Data Augmentation

### 4.1. Transformações Aplicadas no Pipeline (Roboflow / PyTorch)
Para tornar o modelo invariante a variações ambientais em campo, o pipeline de pré-processamento inclui:

1. **Variações Fotométricas:**
   - Brilho: ±25%
   - Contraste: ±20%
   - Matiz (Hue): ±15°
   - Simulação de sombras projetadas (Cutout / CoarseDropout)
2. **Variações Geométricas:**
   - Rotação aleatória: -15° a +15°
   - Espelhamento horizontal (Horizontal Flip)
   - Zoom e corte aleatório (Random Crop): 0% a 20%
3. **Imagens Negativas de Controle:**
   - 15% do dataset composto por superfícies íntegras (paredes pintadas, concreto liso, solo estável) sem nenhuma anotação (bounding box vazia).

---

## 5. Arquitetura do Motor de Risco e Calibração

O cálculo de risco no arquivo `app/services/risco.py` opera pela fórmula ponderada:

$$\text{Score} = \sum_{i=1}^{n} \left( \text{Peso}_{\text{classe}_i} \times \text{Confiança}_i \times \text{Fator de Escala}_i \right)$$

### 5.1. Tabela de Ponderação Calibrada

| Classe | Peso Base ($P_i$) | Condição de Severidade Imediata |
|---|---|---|
| `shear_crack` / `crack` severo | 4 | Se área > 15.000 px² $\rightarrow$ Risco Crítico |
| `exposed_rebar` (Armadura) | 4 | Se detectado em pilar/viga $\rightarrow$ Risco Crítico |
| `deterioration` / `spalling` | 3 | Desagregação com perda de seção $\rightarrow$ Risco Médio/Crítico |
| `active_moisture` (Umidade ativa) | 2 | Presença de gotejamento/infiltração $\rightarrow$ Risco Médio |
| `surface_stain` / `mold` | 1 | Manchas superficiais sem deformação $\rightarrow$ Risco Baixo |

### 5.2. Limiares de Decisão (Thresholds)
- **Score $\ge$ 6.0:** Risco Crítico (Acionamento prioritário da Defesa Civil)
- **3.0 $\le$ Score $<$ 6.0:** Risco Médio (Vistoria programada)
- **Score $<$ 3.0:** Risco Baixo (Monitoramento preventivo)
- **Confiança $<$ 0.50:** Marcado como `incerto = True` para triagem humana obrigatória.

---

## 6. Métricas de Validação e Metas de Qualidade

Para homologação do modelo em produção:

| Métrica | Situação Atual (Estimada) | Meta de Homologação (v1.0) |
|---|---|---|
| **mAP@50 (Mean Average Precision)** | 62.4% | $\ge$ 85.0% |
| **Recall em Classes Críticas** | 71.0% | $\ge$ 92.0% (Zero falsos negativos em risco crítico) |
| **Taxa de Falsos Positivos (Imagens Neutras)** | 18.5% | $\le$ 4.0% |
| **Tempo Médio de Inferência** | 450 ms | $\le$ 300 ms |

---

## 7. Próximos Passos de Execução

1. **Validação Técnica com Especialista:** ✅ **Concluída em 16/09/2026.** A
   engenheira civil consultora avaliou as perguntas enviadas. Sobre peso ×
   confiança × área em pixels (itens abaixo), ela apontou que são parâmetros
   de sistema, fora da área dela, e recomendou avaliação por alguém de
   sistemas — portanto **seguem inalterados** nesta rodada:
   - Peso por classe de defeito, confiança mínima e o fator de escala por
     área na foto continuam como estão (`risco.py`,
     `classificador_roboflow.py`) até essa avaliação técnica de sistemas.
   - Sobre priorização de alertas críticos em massa — pergunta que **é** da
     área dela —, ela descreveu usar SWOT em laudos individuais, mas não o
     divulga por ser privado, e recomendou postergar uma análise própria
     para uma segunda/terceira etapa. Em vez de esperar, adotou-se um método
     equivalente em propósito, porém público e citável: o método GUT. Ver
     `docs/metodologia-priorizacao-gut.md` para a implementação completa,
     incluindo a nova pergunta de ruído/vibração percebida e a ampliação das
     categorias de anomalia com base no checklist IBAPE.
2. **Re-anotação de Dataset (Active Learning):** Utilizar as imagens capturadas em testes de campo com anotação semi-automática assistida e revisão humana.
3. **Deploy de Nova Versão:** Publicação dos pesos atualizados no Roboflow e atualização dos serviços FastAPI (`classificador_roboflow.py` e `risco.py`).
