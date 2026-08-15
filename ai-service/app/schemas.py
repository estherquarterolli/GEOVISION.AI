"""Contratos de entrada e saída da API.

Os valores de NivelRisco espelham o enum nivel_risco do PostgreSQL
(supabase/migrations/0001_esquema_inicial.sql). Divergir aqui quebra a
gravação no banco.
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class NivelRisco(StrEnum):
    BAIXO = "baixo"
    MEDIO = "medio"
    CRITICO = "critico"


class RespostaClassificacao(BaseModel):
    """Resultado da classificação de uma imagem."""

    risco: NivelRisco | None = Field(
        description="Nível de risco previsto. Nulo quando a confiança fica abaixo "
        "do limiar — nesse caso o alerta vai para triagem humana sem sugestão."
    )
    confianca: float = Field(ge=0.0, le=1.0, description="Confiança da predição (0–1).")
    incerto: bool = Field(
        description="True quando a confiança ficou abaixo do limiar configurado."
    )
    versao_modelo: str = Field(description="Versão do modelo que gerou a predição.")
    probabilidades: dict[str, float] = Field(
        default_factory=dict,
        description="Probabilidade por classe. Usado para depuração e para a "
        "matriz de confusão na avaliação do modelo.",
    )


class EntradaWebhookAlerta(BaseModel):
    """Corpo enviado pelo Database Webhook do Supabase."""

    alerta_id: str
    nivel_risco: NivelRisco | None = None
    status: str | None = None


class RespostaSaude(BaseModel):
    status: str
    ambiente: str
    modelo_carregado: bool
    versao_modelo: str
