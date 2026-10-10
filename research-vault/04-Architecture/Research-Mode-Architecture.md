---
type: architecture
status: draft
updated: 2026-10-10
---

# Research Mode Architecture

## Arquitectura actual

```text
consulta
→ parser
→ expansión
→ fuentes
→ normalización
→ deduplicación
→ ranking
```

## Extensión propuesta

```text
ResearchProject
      ↓
Constructor metodológico
      ↓
Consulta estructurada
      ↓
Motor federado actual
      ↓
Selección de corpus
      ↓
Enriquecimiento bibliográfico
      ↓
Extracción de claims/problemas
      ↓
Relaciones argumentativas
      ↓
Cronología y genealogía
      ↓
Estado del arte
      ↓
Hipótesis del investigador
      ↓
Prueba adversarial
      ↓
Reformulación
```

## Regla de compatibilidad

El modo `Buscar` debe seguir funcionando de manera independiente.

El nuevo modo `Investigar` reutiliza el motor actual pero no debe introducir dependencias que degraden la búsqueda básica.

## Persistencia

Decisión V1 aceptada:

1. JSON canónico portable como contrato de intercambio;
2. IndexedDB como estado de trabajo local;
3. Markdown y Obsidian como vistas derivadas;
4. backend sincronizado sólo después de validar el modelo.

El MVP debe evitar infraestructura permanente innecesaria. IDs, revisiones,
provenance e historial deben sobrevivir un round-trip exportar/importar.

El contrato aceptado está en [[ResearchProject-Data-Contract-V1]] y la máquina
de estados en [[Research-Mode-Flow-V1]]. La implementación debe comenzar con
fixtures, JSON Schema y pruebas de invariantes en una rama aislada.

## Exportaciones previstas

- JSON canónico del proyecto;
- Markdown;
- BibTeX/RIS;
- Obsidian;
- informe de estado del arte.

## Relacionado

- [[Research-Mode]]
- [[Epistemological-Model]]
- [[ResearchProject-Data-Contract-V1]]
- [[Research-Mode-Flow-V1]]
