---
type: methodology
area: evaluation
updated: 2026-09-28
---

# Protocolo de juicio

## Escala humana

- **0** — irrelevante o ruido.
- **1** — relación tangencial o insuficiente.
- **2** — relevante para la consulta.
- **3** — altamente relevante o central.

**Relevante = puntuación >= 2**

**Central = puntuación = 3**

## Separación de información

Durante la adjudicación ciega el juez no debe conocer:

- condición A/B;
- ranking de producción;
- ranking Qwen;
- score Qwen;
- score de producción;
- proveedor;
- procedencia de recuperación.

## Diferencia simétrica

Se juzgan únicamente los documentos que entran o salen del Top 10 entre A y B.

**ΔP@10 = P@10(B) − P@10(A)**

Los elementos compartidos se cancelan exactamente. Esto identifica el delta, pero no el P@10 absoluto.

## Regla epistemológica

Qwen no decide qué documento es verdadero ni filosóficamente correcto.

Qwen genera una señal de ranking que posteriormente se somete a juicio humano independiente.

→ [[Evaluation-Lineage]]
