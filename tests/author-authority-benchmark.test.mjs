import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSilverIdentityPartition,
  analyzeNameCollisions,
  buildProfileAuditSample,
  evaluateCuratedGoldCases,
  sourceCoverageCheck,
  buildAuthorityBenchmarkReport
} from "../src/core/author-authority-benchmark.js";

function profile(id,name,{orcid=null,cw=1}={}){
  return {
    id:String(id),
    n:name,
    o:orcid,
    cw,
    names:[name],
    signatures:[],
    kinds:["full"]
  };
}

test("silver acepta IDs distintos unidos por el mismo ORCID",()=>{
  const profiles=[
    profile(1,"Ana Pérez",{orcid:"0000-0001-1111-1111"}),
    profile(2,"Ana María Pérez",{orcid:"0000-0001-1111-1111"})
  ];
  const report=evaluateSilverIdentityPartition({
    profiles,
    authorIdToCandidateRef:{
      "1":"candidate:ana",
      "2":"candidate:ana"
    }
  });

  assert.equal(report.sharedOrcidGroups,1);
  assert.equal(report.falseMergeCount,0);
  assert.equal(report.falseSplitCount,0);
});

test("silver detecta false split cuando un ORCID queda dividido",()=>{
  const profiles=[
    profile(1,"Ana Pérez",{orcid:"0000-0001-1111-1111"}),
    profile(2,"Ana María Pérez",{orcid:"0000-0001-1111-1111"})
  ];
  const report=evaluateSilverIdentityPartition({
    profiles,
    authorIdToCandidateRef:{
      "1":"candidate:one",
      "2":"candidate:two"
    }
  });

  assert.equal(report.falseSplitCount,1);
  assert.equal(report.falseMergeCount,0);
});

test("silver detecta false merge entre anclas deterministas distintas",()=>{
  const profiles=[
    profile(1,"José Martínez",{orcid:"0000-0001-1111-1111"}),
    profile(2,"José Martínez",{orcid:"0000-0002-2222-2222"})
  ];
  const report=evaluateSilverIdentityPartition({
    profiles,
    authorIdToCandidateRef:{
      "1":"candidate:bad-merge",
      "2":"candidate:bad-merge"
    }
  });

  assert.equal(report.falseMergeCount,1);
  assert.equal(report.falseSplitCount,0);
});

test("homónimos sin ancla permanecen en estrato anchorless",()=>{
  const profiles=[
    profile(1,"José Martínez"),
    profile(2,"José Martínez")
  ];
  const analysis=analyzeNameCollisions({
    profiles,
    authorIdToCandidateRef:{
      "1":"candidate:one",
      "2":"candidate:two"
    },
    sampleSize:10,
    seed:42
  });

  assert.equal(analysis.collisionGroups,1);
  assert.equal(analysis.counts["anchorless-homonym"],1);
  assert.equal(
    analysis.sample["anchorless-homonym"][0].profiles.length,
    2
  );
});

test("clasifica colisiones de nombre con ORCID distintos",()=>{
  const profiles=[
    profile(1,"María López",{orcid:"0000-0001-1111-1111"}),
    profile(2,"Maria Lopez",{orcid:"0000-0002-2222-2222"})
  ];
  const analysis=analyzeNameCollisions({
    profiles,
    authorIdToCandidateRef:{
      "1":"candidate:one",
      "2":"candidate:two"
    },
    sampleSize:10,
    seed:42
  });

  assert.equal(
    analysis.counts["distinct-orcid-homonym"],
    1
  );
});

test("muestra de auditoría es determinista y estratificada",()=>{
  const profiles=[
    profile(1,"José Ángel Pérez"),
    profile(2,"A. Martínez"),
    profile(3,"María Elena Ruiz López"),
    profile(4,"John Smith")
  ];
  const candidates=[{
    id:"candidate:multi",
    canonicalName:"Ana Pérez",
    sourceMetadata:{authorIds:["5","6"]},
    externalIdentifiers:[{
      scheme:"orcid",
      normalizedValue:"0000-0001-1111-1111"
    }]
  }];

  const first=buildProfileAuditSample({
    profiles,
    groupedCandidates:candidates,
    sampleSize:10,
    seed:99
  });
  const second=buildProfileAuditSample({
    profiles,
    groupedCandidates:candidates,
    sampleSize:10,
    seed:99
  });

  assert.deepEqual(first,second);
  assert.ok(first.counts.diacritics>=2);
  assert.equal(first.counts.initials,1);
  assert.ok(first.counts.multiTokenNames>=2);
  assert.equal(first.counts.multiOpenAlexIdCandidates,1);
});

test("gold curado evalúa canonical name y ORCID",()=>{
  const cases=[{
    id:"gold-1",
    input:"Alias",
    expected:{
      found:true,
      canonicalName:"Persona Canónica",
      orcid:"0000-0001-1111-1111"
    }
  }];

  const report=evaluateCuratedGoldCases(cases,{
    resolveCuratedIdentity:()=>({
      canonicalName:"Persona Canónica",
      orcid:"https://orcid.org/0000-0001-1111-1111"
    })
  });

  assert.equal(report.failed,0);
  assert.equal(report.passed,1);
});

test("coverage exige reconciliar perfiles agregados con manifest",()=>{
  assert.deepEqual(
    sourceCoverageCheck({
      sourceManifest:{counts:{resolved_authors:10}},
      aggregatedProfiles:9,
      quarantinedOpenAlexIds:1
    }),
    {
      expectedResolvedAuthors:10,
      observedResolvedAuthors:10,
      ratio:1,
      exact:true
    }
  );
});

test("gate falla ante un false merge aunque gold pase",()=>{
  const profiles=[
    profile(1,"José Martínez",{orcid:"0000-0001-1111-1111"}),
    profile(2,"José Martínez",{orcid:"0000-0002-2222-2222"})
  ];
  const report=buildAuthorityBenchmarkReport({
    sourceManifest:{
      schema_version:"remote-author-index-manifest-v1",
      version:"author-index-v2",
      counts:{resolved_authors:2}
    },
    profiles,
    aliasConflicts:[],
    grouped:{
      candidates:[{id:"candidate:bad"}],
      authorIdToCandidateRef:{
        "1":"candidate:bad",
        "2":"candidate:bad"
      }
    },
    gold:{cases:1,passed:1,failed:0,failures:[],results:[]},
    seed:1,
    sampleSize:10
  });

  assert.equal(report.gate.passed,false);
  assert.equal(report.silver.falseMergeCount,1);
  assert.equal(
    report.gate.failures.some(x=>
      x.metric==="silver.falseMergeCount"
    ),
    true
  );
});


test("gate falla si un perfil no recibe candidate group",()=>{
  const profiles=[
    profile(1,"Ana Pérez",{orcid:"0000-0001-1111-1111"})
  ];
  const report=buildAuthorityBenchmarkReport({
    sourceManifest:{
      schema_version:"remote-author-index-manifest-v1",
      version:"author-index-v2",
      counts:{resolved_authors:1}
    },
    profiles,
    aliasConflicts:[],
    grouped:{
      candidates:[],
      authorIdToCandidateRef:{}
    },
    gold:{cases:0,passed:0,failed:0,failures:[],results:[]},
    seed:1,
    sampleSize:10
  });

  assert.equal(report.silver.unmappedProfileCount,1);
  assert.equal(report.gate.passed,false);
  assert.equal(
    report.gate.failures.some(x=>
      x.metric==="silver.unmappedProfileCount"
    ),
    true
  );
});
