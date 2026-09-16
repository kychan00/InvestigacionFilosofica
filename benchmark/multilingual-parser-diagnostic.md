# Multilingual parser diagnostic

Measures parser coverage plus safe complete-constraint English expansion. It is not a ranking-quality evaluation.

## Summary

- benchmark queries: 50
- language detected correctly: 41/50 (82.0%)
- interdisciplinary queries: 10
- interdisciplinary explicit philosophical area recognized: 10/10
- interdisciplinary academic domain recognized: 10/10
- interdisciplinary queries with a safe complete-English retrieval path: 10/10
- interdisciplinary queries with only the original expansion: 2/10

## Language detection

| language | correct | total | rate |
|---|---:|---:|---:|
| es | 6 | 10 | 60.0% |
| en | 7 | 10 | 70.0% |
| de | 10 | 10 | 100.0% |
| fr | 9 | 10 | 90.0% |
| pt | 9 | 10 | 90.0% |

## Interdisciplinary multilingual coverage

| language | area | domain | safe English path | total |
|---|---:|---:|---:|---:|
| es | 2 | 2 | 2 | 2 |
| en | 2 | 2 | 2 | 2 |
| de | 2 | 2 | 2 | 2 |
| fr | 2 | 2 | 2 | 2 |
| pt | 2 | 2 | 2 | 2 |

## Interdisciplinary queries

| id | query | detected lang | explicit areas | domains | residual semantic tokens | expansions |
|---|---|---|---|---|---|---|
| es-09 | fenomenología en enfermería | es | PHEN | nursing | — | original:fenomenología en enfermería · translation:phenomenology in nursing |
| en-09 | phenomenology in nursing | en | PHEN | nursing | — | original:phenomenology in nursing |
| de-09 | Phänomenologie in der Pflege | de | PHEN | nursing | — | original:Phänomenologie in der Pflege · translation:phenomenology in nursing |
| fr-09 | phénoménologie en soins infirmiers | fr | PHEN | nursing | — | original:phénoménologie en soins infirmiers · translation:phenomenology in nursing |
| pt-09 | fenomenologia na enfermagem | pt | PHEN | nursing | — | original:fenomenologia na enfermagem · translation:phenomenology in nursing |
| es-10 | ontología en informática | es | MET | computer_science | — | original:ontología en informática · translation:ontology in computer science |
| en-10 | ontology in computer science | en | MET | computer_science | — | original:ontology in computer science |
| de-10 | Ontologie in der Informatik | de | MET | computer_science | — | original:Ontologie in der Informatik · translation:ontology in computer science |
| fr-10 | ontologie en informatique | fr | MET | computer_science | — | original:ontologie en informatique · translation:ontology in computer science |
| pt-10 | ontologia em ciência da computação | pt | MET | computer_science | — | original:ontologia em ciência da computação · translation:ontology in computer science |

## All benchmark queries

| id | expected | detected | philosophers | concepts | works | explicit areas | domains | residual tokens |
|---|---|---|---|---|---|---|---|---|
| es-01 | es | es | kant | freedom | — | — | — | — |
| en-01 | en | en | kant | freedom | — | — | — | — |
| de-01 | de | de | kant | — | — | — | — | freiheit |
| fr-01 | fr | fr | kant | — | — | — | — | liberte, chez |
| pt-01 | pt | pt | kant | — | — | — | — | liberdade |
| es-02 | es | es | heidegger | being | heidegger_bt | — | — | — |
| en-02 | en | en | heidegger | being | heidegger_bt | — | — | — |
| de-02 | de | de | heidegger | — | heidegger_bt | — | — | — |
| fr-02 | fr | fr | heidegger | — | — | — | — | etre, temps |
| pt-02 | pt | es | heidegger | being | — | — | — | tempo |
| es-03 | es | es | aristotle | virtue | — | ETH | — | — |
| en-03 | en | en | aristotle | virtue | — | ETH | — | — |
| de-03 | de | de | aristotle | — | — | — | — | tugendethik |
| fr-03 | fr | fr | — | — | — | ETH | — | vertu, aristote |
| pt-03 | pt | pt | aristotle | — | — | ETH | — | virtude |
| es-04 | es | unknown | husserl | — | — | — | — | intencionalidad |
| en-04 | en | unknown | husserl | — | — | — | — | intentionality |
| de-04 | de | de | husserl | — | — | — | — | intentionalitat |
| fr-04 | fr | fr | husserl | — | — | — | — | intentionnalite, chez |
| pt-04 | pt | pt | husserl | — | — | — | — | intencionalidade |
| es-05 | es | unknown | — | — | — | — | — | alteridad, levinas |
| en-05 | en | unknown | — | — | — | — | — | alterity, levinas |
| de-05 | de | de | — | — | — | — | — | alteritat, levinas |
| fr-05 | fr | fr | — | — | — | — | — | alterite, chez, levinas |
| pt-05 | pt | pt | — | — | — | — | — | alteridade, levinas |
| es-06 | es | unknown | — | — | — | — | — | sustancia, spinoza |
| en-06 | en | unknown | — | — | — | — | — | substance, spinoza |
| de-06 | de | de | — | — | — | — | — | substanz, spinoza |
| fr-06 | fr | fr | — | — | — | — | — | substance, chez, spinoza |
| pt-06 | pt | pt | — | — | — | — | — | substancia, spinoza |
| es-07 | es | unknown | — | — | — | — | — | filosofia, liberacion, dussel |
| en-07 | en | en | — | — | — | — | — | philosophy, liberation, dussel |
| de-07 | de | de | — | — | — | — | — | philosophie, befreiung, dussel |
| fr-07 | fr | unknown | — | — | — | — | — | philosophie, liberation, dussel |
| pt-07 | pt | pt | — | — | — | — | — | filosofia, libertacao, dussel |
| es-08 | es | es | hegel | — | — | PHEN | — | espiritu |
| en-08 | en | en | hegel | — | — | PHEN | — | spirit |
| de-08 | de | de | hegel | — | — | PHEN | — | geistes |
| fr-08 | fr | fr | hegel | — | — | PHEN | — | l, esprit |
| pt-08 | pt | pt | hegel | — | — | PHEN | — | espirito |
| es-09 | es | es | — | — | — | PHEN | nursing | — |
| en-09 | en | en | — | — | — | PHEN | nursing | — |
| de-09 | de | de | — | — | — | PHEN | nursing | — |
| fr-09 | fr | fr | — | — | — | PHEN | nursing | — |
| pt-09 | pt | pt | — | — | — | PHEN | nursing | — |
| es-10 | es | es | — | — | — | MET | computer_science | — |
| en-10 | en | en | — | — | — | MET | computer_science | — |
| de-10 | de | de | — | — | — | MET | computer_science | — |
| fr-10 | fr | fr | — | — | — | MET | computer_science | — |
| pt-10 | pt | pt | — | — | — | MET | computer_science | — |

## Interpretation boundary

This diagnostic measures parser and expansion coverage only. Retrieval relevance still requires a real provider run and a fresh human evaluation.
