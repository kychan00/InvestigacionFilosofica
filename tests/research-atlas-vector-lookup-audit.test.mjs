import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = name => join(root, "scripts/research-atlas", name);
const checksum = bytes => createHash("sha256").update(bytes).digest("hex");

function makeFixture() {
  const folder = mkdtempSync(join(tmpdir(), "ra12b2-validator-"));
  const artifactRoot = join(folder, "assets");
  function write(path, data) {
    const file = join(artifactRoot, path);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, data);
    return {path, bytes: data.length, sha256: checksum(data)};
  }
  const groups = [[0,2],[1,3]].map((ids, i) => {
    const buf = Buffer.alloc(ids.length * 4);
    ids.forEach((id, j) => buf.writeUInt32LE(id, j*4));
    return {
      cluster:i, count:ids.length,
      ids:write("clusters/cluster-" + String(i).padStart(3,"0") + ".ids.u32", buf),
      vectors:{bytes:ids.length*4}
    };
  });
  const records = [
    {vector_id:0,openalex_id:"W100",id:"https://openalex.org/W100"},
    {vector_id:1,openalex_id:"W200",id:"https://openalex.org/W200"},
    {vector_id:2,openalex_id:"W100",id:"https://openalex.org/W100"},
    {vector_id:3,openalex_id:null,id:"internal:other"}
  ];
  const pages = [0,1].map(i => {
    const slice = records.slice(i*2,i*2+2);
    const compressed = gzipSync(slice.map(x => JSON.stringify(x)).join("\n") + "\n", {mtime:0});
    return {...write("metadata/page-" + String(i).padStart(4,"0") + ".jsonl.gz", compressed),
      count:2,first_vector_id:i*2,last_vector_id:i*2+1};
  });
  const manifest = {
    schema_version:"qwen3-browser-semantic-static-artifacts-v4",
    document_count:4,dimension:4,routing:{cluster_count:2},
    quantization:{dtype:"int8"},metadata:{page_size:2,pages},clusters:groups,
    source:{faiss_sha256:"test-only",metadata_sqlite_sha256:"test-only"}
  };
  const manifestFile = join(folder,"manifest.json");
  writeFileSync(manifestFile, JSON.stringify(manifest)+"\n");
  return {folder,artifactRoot,manifestFile};
}
function invoke(name,args) {
  return spawnSync("python3", [script(name), ...args], {encoding:"utf8"});
}
test("RA12-B2: source join validator independently checks all synthetic rows", () => {
  const f = makeFixture();
  const dest = join(f.folder,"built");
  let p = invoke("build_ra12_vector_lookup.py", [
    "--manifest", f.manifestFile,"--artifact-root",f.artifactRoot,
    "--synthetic-fixture","--output",dest
  ]);
  assert.equal(p.status,0,p.stderr);
  const reportFile=join(f.folder,"report.json");
  p=invoke("validate_ra12_vector_lookup.py",[
    "--manifest",f.manifestFile,"--artifact-root",f.artifactRoot,
    "--synthetic-fixture","--lookup",dest,"--report",reportFile
  ]);
  assert.equal(p.status,0,p.stderr);
  const result=JSON.parse(readFileSync(reportFile,"utf8"));
  assert.equal(result.status,"pass");
  assert.equal(result.realCorpusRecords,4);
  assert.equal(result.uniqueOpenAlexWorkIds,1);
  assert.equal(result.ambiguousWorkIdsExcluded,1);
  assert.equal(result.publishedToHuggingFace,false);
});

test("RA12-B2: independent validator catches altered partition SHA",()=>{
  const f=makeFixture(),dest=join(f.folder,"built");
  assert.equal(invoke("build_ra12_vector_lookup.py", [
    "--manifest",f.manifestFile,"--artifact-root",f.artifactRoot,
    "--synthetic-fixture","--output",dest
  ]).status,0);
  const manifest=JSON.parse(readFileSync(join(dest,"lookup-manifest.json"),"utf8"));
  const file=join(dest,manifest.lookup.partitions[0].path);
  writeFileSync(file,Buffer.from("forged"));
  const p=invoke("validate_ra12_vector_lookup.py",[
    "--manifest",f.manifestFile,"--artifact-root",f.artifactRoot,
    "--synthetic-fixture","--lookup",dest,"--report",join(f.folder,"report.json")
  ]);
  assert.notEqual(p.status,0);
  assert.match(p.stderr,/size\/hash mismatch/);
});

test("RA12-B2: download inventory excludes all vectors and model weights",()=>{
  const f=makeFixture();
  const inspect = "import json,sys; sys.path.insert(0,sys.argv[1]); from prefetch_ra12_v4_assets import asset_inventory; m=json.load(open(sys.argv[2])); a=asset_inventory(m); b=asset_inventory(m,1); print(json.dumps({'all':len(a),'sample':len(b),'names':[x['path'] for x in a]}))";
  const p=spawnSync("python3",["-c",inspect,join(root,"scripts/research-atlas"),f.manifestFile],{encoding:"utf8"});
  assert.equal(p.status,0,p.stderr);
  const x=JSON.parse(p.stdout);
  assert.equal(x.all,4);
  assert.equal(x.sample,1);
  assert.ok(x.names.every(name=>name.endsWith(".ids.u32")||name.endsWith(".jsonl.gz")));
});
