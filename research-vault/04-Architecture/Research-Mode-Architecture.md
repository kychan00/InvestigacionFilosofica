---
type: architecture
status: draft
updated: 2026-09-27
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

Pendiente de decisión.

Opciones a evaluar:

1. estado local exportable;
2. IndexedDB;
3. archivo de proyecto JSON/Markdown;
4. backend futuro para proyectos sincronizados.

El MVP debe evitar infraestructura permanente innecesaria hasta validar el modelo.

## Exportaciones previstas

- JSON canónico del proyecto;
- Markdown;
- BibTeX/RIS;
- Obsidian;
- informe de estado del arte.

## Relacionado

- [[Research-Mode]]
- [[Epistemological-Model]]
