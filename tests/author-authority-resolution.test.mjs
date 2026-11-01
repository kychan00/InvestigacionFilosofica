import test from "node:test";
import assert from "node:assert/strict";
import {
  blockAuthorityCandidates,
  evaluateAuthorityMerge,
  evaluateIdentityCandidate,
  resolveAuthorMention
} from "../src/core/author-authority-resolution.js";

const orcid = value => ({scheme:"orcid", value});
const person = (id, canonicalName, options={}) => ({id, canonicalName, ...options});
const mention = (rawValue, options={}) => ({id:`m:${rawValue}`, rawValue, ...options});

test("F01: mismo ORCID confirma una identidad aunque cambie la forma del nombre",()=>{
  const input=mention("M. E. Torres",{embeddedIdentifiers:[orcid("0000-0001-1111-1111")]});
  const result=resolveAuthorMention(input,[person("a:1","María Elena Torres",{
    externalIdentifiers:[orcid("0000-0001-1111-1111")]
  })]);
  assert.equal(result.status,"confirmed");
  assert.equal(result.targetRef,"a:1");
  assert.ok(result.evidence.some(item=>item.ruleId==="orcid-match"));
});

test("F02: ORCID incompatibles vetan el merge aunque el nombre sea idéntico",()=>{
  const result=evaluateAuthorityMerge(
    person("a:1","José Martínez",{externalIdentifiers:[orcid("0000-0001-1111-1111")]}),
    person("a:2","José Martínez",{externalIdentifiers:[orcid("0000-0002-2222-2222")]})
  );
  assert.equal(result.status,"rejected");
  assert.ok(result.vetoes.some(item=>item.ruleId==="orcid-conflict"));
});

test("F03: segundo apellido completo incompatible produce veto",()=>{
  const input=mention("Laura Hernández López",{
    parsedName:{familyNames:["Hernández","López"]}
  });
  const evaluation=evaluateIdentityCandidate(input,person("a:1","Laura Hernández García",{
    parsedName:{familyNames:["Hernández","García"]}
  }));
  assert.equal(evaluation.status,"rejected");
  assert.ok(evaluation.vetoes.some(item=>item.ruleId==="family-name-conflict"));
});

test("F03b: una forma corta compartida conserva la ambigüedad",()=>{
  const input=mention("Laura Hernández");
  const result=resolveAuthorMention(input,[
    person("a:1","Laura Hernández López"),
    person("a:2","Laura Hernández García")
  ]);
  assert.equal(result.status,"ambiguous");
  assert.equal(result.targetRef,null);
});

test("F04: la cantidad de obras no demuestra identidad",()=>{
  const input=mention("José Martínez");
  const result=resolveAuthorMention(input,[
    person("a:80","José Martínez",{corpusWorks:80}),
    person("a:6","José Martínez",{corpusWorks:6})
  ]);
  assert.equal(result.status,"ambiguous");
  assert.equal(result.targetRef,null);
});

test("F05: evidencia bibliográfica fuerte separa un candidato de homónimos nominales",()=>{
  const input=mention("Elena Ruiz",{
    affiliations:["Universidad de Guadalajara"],
    coauthors:["Ana Pérez","Carlos Mora"]
  });
  const result=resolveAuthorMention(input,[
    person("a:udg","Elena Ruiz",{
      affiliations:["Universidad de Guadalajara"],
      coauthors:["Ana Pérez","Carlos Mora"]
    }),
    person("a:other","Elena Ruiz",{
      affiliations:["Universidad Complutense de Madrid"]
    })
  ]);
  assert.equal(result.status,"probable");
  assert.equal(result.targetRef,"a:udg");
});

test("F06: diacríticos generan candidato pero el nombre solo no confirma identidad",()=>{
  const input=mention("Angeles Erana");
  const result=resolveAuthorMention(input,[person("a:1","Ángeles Eraña")]);
  assert.equal(result.status,"unresolved");
  assert.equal(result.explanationCode,"name-or-context-only");
});

test("F07: orden nombre/apellido es señal nominal, no prueba suficiente",()=>{
  const input=mention("Hernández López, Dinora");
  const result=resolveAuthorMention(input,[person("a:1","Dinora Hernández López")]);
  assert.equal(result.status,"unresolved");
  assert.ok(result.candidates[0].evidence.some(item=>item.ruleId==="name-signature"));
});

test("F08: iniciales compatibles no eligen entre homónimos",()=>{
  const input=mention("J. Pérez");
  const result=resolveAuthorMention(input,[
    person("a:1","Juan Pérez"),
    person("a:2","Jorge Pérez"),
    person("a:3","Julia Pérez")
  ]);
  assert.equal(result.status,"ambiguous");
  assert.equal(result.candidates.length,3);
});

test("un ORCID compartido por dos autoridades exige merge, no elección arbitraria",()=>{
  const input=mention("María Torres",{embeddedIdentifiers:[orcid("0000-0001-9999-9999")]});
  const result=resolveAuthorMention(input,[
    person("a:1","María Torres",{externalIdentifiers:[orcid("0000-0001-9999-9999")]}),
    person("a:2","M. Torres",{externalIdentifiers:[orcid("0000-0001-9999-9999")]}),
  ]);
  assert.equal(result.status,"ambiguous");
  assert.deepEqual(result.mergeCandidateRefs,["a:1","a:2"]);
});

test("candidate blocking acepta evidencia fuerte aunque el nombre haya cambiado",()=>{
  const input=mention("Nombre Editorial",{embeddedIdentifiers:[orcid("0000-0001-2222-3333")]});
  const candidates=blockAuthorityCandidates(input,[
    person("a:1","Nombre Canónico",{externalIdentifiers:[orcid("0000-0001-2222-3333")]}),
    person("a:2","Otra Persona")
  ]);
  assert.deepEqual(candidates.map(item=>item.id),["a:1"]);
});

test("evidencias débiles acumuladas no anulan un veto",()=>{
  const input=mention("José Martínez",{
    embeddedIdentifiers:[orcid("0000-0001-1111-1111")],
    affiliations:["Universidad X"],
    coauthors:["A Uno","B Dos"]
  });
  const evaluation=evaluateIdentityCandidate(input,person("a:2","José Martínez",{
    externalIdentifiers:[orcid("0000-0002-2222-2222")],
    affiliations:["Universidad X"],
    coauthors:["A Uno","B Dos"]
  }));
  assert.equal(evaluation.status,"rejected");
  assert.equal(evaluation.evidenceProfile.support.B>=1,true);
  assert.ok(evaluation.vetoes.length>0);
});

test("una autora conocida usa exactamente el mismo camino genérico",()=>{
  const input=mention("Dra. Dinora Hernández",{
    embeddedIdentifiers:[orcid("0000-0001-7335-1790")]
  });
  const result=resolveAuthorMention(input,[person("authority:example","Dinora Hernández López",{
    externalIdentifiers:[orcid("0000-0001-7335-1790")]
  })]);
  assert.equal(result.status,"confirmed");
  assert.equal(result.targetRef,"authority:example");
});
