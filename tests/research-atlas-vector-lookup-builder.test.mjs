import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const builder = fileURLToPath(new URL('../scripts/research-atlas/build_ra12_vector_lookup.py', import.meta.url));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const record = (path, data, extra = {}) => ({path, bytes: data.length, sha256: sha256(data), ...extra});

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ra12b-builder-test-'));
  const source = join(dir, 'source');
  const write = (path, bytes) => {
    const destination = join(source, path);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, bytes);
    return record(path, bytes);
  };
  const clusters = [[0, 2, 4], [1, 3, 5]].map((ids, i) => {
    const encoded = Buffer.alloc(ids.length * 4);
    ids.forEach((id, j) => encoded.writeUInt32LE(id, 4 * j));
    const meta = write('clusters/cluster-'+String(i).padStart(3,'0')+'.ids.u32', encoded);
    return {cluster:i, count:ids.length, ids:meta,
      vectors: {path:'clusters/cluster-'+String(i).padStart(3,'0')+'.vectors.i8',bytes:ids.length*4,sha256:'synthetic-vector-not-needed'}};
  });
  const docs = [
    {vector_id:0, id:'https://openalex.org/W100', openalex_id:'W100'},
    {vector_id:1, id:'https://openalex.org/W200', openalex_id:null},
    {vector_id:2, id:'other:missing'},
    {vector_id:3, id:'other:invalid', openalex_id:'not-an-id'},
    {vector_id:4, id:'https://openalex.org/W100', openalex_id:'W100'},
    {vector_id:5, id:'https://openalex.org/W501', openalex_id:'https://openalex.org/W500'}
  ];
  const pages=[];
  for(let p=0;p<3;p++){
    const rows=docs.slice(p*2,p*2+2);
    const bytes=gzipSync(rows.map(x=>JSON.stringify(x)).join('\n')+'\n',{mtime:0});
    const meta=write('metadata/page-'+String(p).padStart(4,'0')+'.jsonl.gz',bytes);
    pages.push({...meta,count:2,first_vector_id:p*2,last_vector_id:p*2+1});
  }
  const manifest={schema_version:'qwen3-browser-semantic-static-artifacts-v4',document_count:6,dimension:4,quantization:{dtype:'int8',normalization:'l2',scale:127},routing:{cluster_count:2},metadata:{page_size:2,pages},clusters,source:{faiss_sha256:'synthetic-faiss',metadata_sqlite_sha256:'synthetic-sqlite'}};
  const manifestPath=join(dir,'manifest.json');
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  return {dir,source,manifestPath};
}

function run(fixture,...args){
  return spawnSync('python3',[builder,'--manifest',fixture.manifestPath,'--artifact-root',fixture.source,'--synthetic-fixture',...args],{encoding:'utf8'});
}

function readManifest(path) { return JSON.parse(readFileSync(join(path,'lookup-manifest.json'),'utf8')); }

test('RA12-B: fixture explicitly marked synthetic, joins are fail-closed and collisions excluded',()=>{
  const f=createFixture();
  const dest=join(f.dir,'out');
  const proc=run(f,'--output',dest);
  assert.equal(proc.status,0,proc.stderr);
  const out=readManifest(dest);
  assert.equal(out.status,'generated-unpublished-synthetic');
  assert.equal(out.coverage.documents,6);
  assert.equal(out.coverage.explicitOpenAlexIds,2);
  assert.equal(out.coverage.idAliasOnly,1);
  assert.equal(out.coverage.noOpenAlexId,1);
  assert.equal(out.coverage.invalidExplicit,1);
  assert.equal(out.coverage.conflictingFields,1);
  assert.equal(out.coverage.duplicateWorkIdRecords,1);
  assert.equal(out.lookup.entryCount,1);
  assert.equal(out.lookup.ambiguousWorkIdsExcluded,1);
  assert.equal(out.productionEnabled,false);
  const part=out.lookup.partitions[0];
  assert.ok(part.path.match(/^lookup\/part-\d{3}\.jsonl\.gz$/));
  const bytes=readFileSync(join(dest,part.path));
  assert.equal(sha256(bytes),part.sha256);
  assert.deepEqual(JSON.parse(gunzipSync(bytes).toString('utf8').trim()),['W200',1,1,0]);
});

test('RA12-B: identical source metadata produces byte-identical lookup outputs',()=>{
  const f=createFixture();
  const left=join(f.dir,'left'), right=join(f.dir,'right');
  assert.equal(run(f,'--output',left).status,0);
  assert.equal(run(f,'--output',right).status,0);
  assert.deepEqual(readFileSync(join(left,'lookup-manifest.json')),readFileSync(join(right,'lookup-manifest.json')));
  for (const part of readManifest(left).lookup.partitions){
    assert.deepEqual(readFileSync(join(left,part.path)),readFileSync(join(right,part.path)));
  }
});

test('RA12-B: inspect-only sample never claims corpus-wide SearchResponse coverage',()=>{
  const f=createFixture();
  const proc=run(f,'--sample-pages','1');
  assert.equal(proc.status,0,proc.stderr);
  const report=JSON.parse(proc.stdout);
  assert.equal(report.sampledPages,1);
  assert.equal(report.sampledRecords,2);
  assert.match(report.coverageScope,/not query or full corpus coverage/);
});

test('RA12-B: invalid checksum stops build without a published directory',()=>{
  const f=createFixture();
  const page=join(f.source,'metadata/page-0001.jsonl.gz');
  writeFileSync(page,Buffer.from('corrupted'));
  const dest=join(f.dir,'out');
  const proc=run(f,'--output',dest);
  assert.notEqual(proc.status,0);
  assert.match(proc.stderr,/size\/hash mismatch/);
  assert.equal(readdirSync(f.dir).includes('out'),false);
});

test('RA12-B: non-pinned reduced synthetic fixture rejected without explicit opt-in',()=>{
  const f=createFixture();
  const proc=spawnSync('python3',[builder,'--manifest',f.manifestPath,'--artifact-root',f.source,'--output',join(f.dir,'out')],{encoding:'utf8'});
  assert.notEqual(proc.status,0);
  assert.match(proc.stderr,/Source manifest SHA mismatch/);
});
