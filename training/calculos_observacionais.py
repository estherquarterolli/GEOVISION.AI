"""Medições auxiliares, sem limiares de ruína ou declaração de estabilidade.

Só utilizar medições obtidas com segurança, instrumento e referência adequados.
Os números não substituem análise estrutural, ensaios ou vistoria.
"""
import math


def numero(valor, nome, minimo=0, estrito=False):
    if isinstance(valor, bool):
        raise ValueError(f"{nome}: booleano não é uma medição")
    valor = float(valor)
    if not math.isfinite(valor) or valor < minimo or (estrito and valor == minimo):
        raise ValueError(f"{nome}: valor finito {'maior que' if estrito else '>='} {minimo} necessário")
    return valor


def abertura_mm(abertura_px, referencia_px, referencia_mm, *, mesmo_plano=False):
    """Conversão local: exige escala coplanar e correção de perspectiva prévia."""
    if mesmo_plano is not True:
        raise ValueError("Sem escala no mesmo plano, não converter pixels para mm")
    return numero(abertura_px, "abertura_px") * numero(referencia_mm, "referencia_mm", estrito=True) / numero(referencia_px, "referencia_px", estrito=True)


def evolucao_mm_dia(inicial_mm, final_mm, intervalo_horas):
    """Mesma fissura e ponto; valor negativo pode ser fechamento/erro térmico."""
    return (numero(final_mm, "final_mm") - numero(inicial_mm, "inicial_mm")) * 24 / numero(intervalo_horas, "intervalo_horas", estrito=True)


def desaprumo_mm_m(deslocamento_mm, altura_m):
    return numero(deslocamento_mm, "deslocamento_mm") / numero(altura_m, "altura_m", estrito=True)


def distorcao_angular(recalque_diferencial_mm, distancia_m):
    """Razão adimensional; não é limite admissível normativo."""
    return numero(recalque_diferencial_mm, "recalque_diferencial_mm") / (1000 * numero(distancia_m, "distancia_m", estrito=True))


def gut_tecnico(gravidade, urgencia, tendencia):
    """Tabela 25–27 do Manual, PDF pp.150–151. Exige notas técnicas explícitas.

    Ausência retorna pendência; nunca preenche a lacuna com nota neutra.
    Não converter softmax em gravidade nem usar o produto como probabilidade.
    """
    notas = (gravidade, urgencia, tendencia)
    if any(n is None for n in notas):
        return {"pontuacao": None, "estado": "incompleto"}
    if any(isinstance(n, bool) or n not in (1, 3, 6, 8, 10) for n in notas):
        raise ValueError("Notas técnicas devem pertencer a 1, 3, 6, 8, 10")
    return {"pontuacao": math.prod(notas), "estado": "calculado"}
