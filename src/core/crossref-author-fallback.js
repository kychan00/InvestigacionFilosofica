import { normalizeAuthorName } from "./remote-author-resolution.js";
import { searchCrossref } from "../sources/crossref.js";
import { searchInternetArchive } from "../sources/internet-archive.js";
import { searchCucshFilosofia } from "../sources/cucsh-filosofia.js";
import {
  normalizeAuthorAliases,
  matchFederatedWork,
  discoveredAuthorVariants
} from "./author-federated-matching.js";

function orcid(value) {
  return /(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})$/i
    .exec(String(value||""))?.[1]?.toUpperCase()||null;
}

function workFingerprint(work) {
  const doi=String(work?.doi||"").replace(/^https?:\/\/doi\.org\//i,"")
    .trim().toLowerCase();
  if(doi)return "doi:"+doi;
  const isbn=(work?.isbn||[]).map(x=>String(x).replace(/[-\s]/g,""))
    .filter(Boolean).sort().join("|");
  if(isbn.length)return "isbn:"+isbn;
  return "title:"+normalizeAuthorName(work?.title)+
    ":"+String(work?.year||"");
}

function mergeMatchedWorks(works) {
  const index=new Map();
  for(const work of works) {
    const key=workFingerprint(work);
    if(!key||key==="title::")continue;
    const existing=index.get(key);
    if(!existing) {index.set(key,work);continue;}
    const better=Number(work?.authors?.length||0) >
      Number(existing?.authors?.length||0) ||
      (!existing.abstract && Boolean(work.abstract));
    const first=better?work:existing,second=better?existing:work;
    index.set(key,{
      ...second,...first,
      providers:[...new Set([...(existing.providers||[]),...(work.providers||[])])],
      collectiveWork:Boolean(work.collectiveWork||existing.collectiveWork),
      coauthorCount:Math.max(Number(work.coauthorCount||0),
        Number(existing.coauthorCount||0)) || first.coauthorCount || null,
      matchedAuthor:first.matchedAuthor||second.matchedAuthor
    });
  }
  return [...index.values()].sort((a,b)=>
    (Number(b.year)||0)-(Number(a.year)||0)||
    String(a.title||"").localeCompare(String(b.title||""),"es"));
}

async function collectFederatedBatch(queries,options,limit) {
  const jobs=[];
  for(const query of queries) {
    const inputs={query,weight:1,type:"author"};
    const config={rows:Math.min(limit,120),signal:options.signal,retries:1};
    if(!options.disableCrossref)jobs.push({
      provider:"Crossref",mode:"author-crossref",
      call:()=> (options.crossrefSearchImpl||searchCrossref)(inputs,config)
    });
    if(!options.disableInternetArchive)jobs.push({
      provider:"Internet Archive",mode:"author-internet-archive",
      call:()=> (options.archiveSearchImpl||searchInternetArchive)(inputs,config)
    });
    if(!options.disableCucsh)jobs.push({
      provider:"CUCSH Filosofía",mode:"author-institutional",
      call:()=> (options.cucshSearchImpl||searchCucshFilosofia)(inputs,config)
    });
  }
  return Promise.all(jobs.map(async job=>{
    try{return {ok:true,provider:job.provider,mode:job.mode,
      works:await job.call()};}
    catch(error){
      if(options.signal?.aborted||error?.name==="AbortError")throw error;
      return {ok:false,provider:job.provider,error:String(error?.message||error)};
    }
  }));
}

export async function resolveFederatedAuthor(name,options={}) {
  const original=String(name||"").trim();
  if(!original)return {status:"none",works:[]};
  const limit=Math.max(1,Math.min(150,Number(options.limit)||50));
  const aliases=normalizeAuthorAliases(original,options.aliases||[]);
  const maxVariants=Math.max(1,Math.min(5,Number(options.maxVariants)||4));
  const used=new Set([normalizeAuthorName(aliases[0])]);
  const first=await collectFederatedBatch([aliases[0]],options,limit);
  let fulfilled=first.filter(entry=>entry.ok);
  const errors=first.filter(entry=>!entry.ok).map(e=>e.provider+": "+e.error);
  let found=first.filter(e=>e.ok).flatMap(entry=>
    (entry.works||[]).map(work=>
      matchFederatedWork(work,original,{
        aliases,expectedOrcid:options.orcid
      })
    ).filter(Boolean).map(work=>({...work,retrievalMode:entry.mode}))
  );
  // Additional queries come from creator fields, not from titles.
  const suggested=[
    ...aliases.slice(1),
    ...discoveredAuthorVariants(found,original,aliases)
  ];
  const additional=[];
  for(const candidate of suggested){
    const norm=normalizeAuthorName(candidate);
    if(!norm||used.has(norm))continue;
    if(additional.length>=maxVariants-1)break;
    used.add(norm);additional.push(candidate);
  }
  if(additional.length) {
    const next=await collectFederatedBatch(additional,options,limit);
    fulfilled.push(...next.filter(e=>e.ok));
    errors.push(...next.filter(e=>!e.ok).map(e=>e.provider+": "+e.error));
    found.push(...next.filter(e=>e.ok).flatMap(entry=>
      (entry.works||[]).map(work=>
        matchFederatedWork(work,original,{
          // Query expansion broadens retrieval, but cannot turn an
          // unverified surname into verified identity evidence.
          aliases,expectedOrcid:options.orcid
        })
      ).filter(Boolean).map(work=>({...work,retrievalMode:entry.mode}))
    ));
  }
  if(!fulfilled.length)return {status:"unavailable",works:[],errors};

  // An incomplete name can refer to people with different second family
  // names. Never merge two distinct extended identities merely because
  // they start with the same given name and first surname.
  const stem=normalizeAuthorName(original);
  const extended=[...new Set(found
    .filter(work=>work.matchedAuthorEvidence==="name-variant")
    .map(work=>normalizeAuthorName(work.matchedAuthor?.name))
    .filter(name=>name.startsWith(stem+" ") &&
      name.split(" ").length<=stem.split(" ").length+2))];
  const observedIds=[...new Set(found
    .map(work=>orcid(work.matchedAuthor?.orcid||work.matchedAuthor?.id))
    .filter(Boolean))];
  if((extended.length>1||observedIds.length>1)&&!orcid(options.orcid)) {
    found=found.filter(work=>work.matchedAuthorEvidence==="exact-name");
    errors.push("Varias identidades compatibles: no se agruparon autores con segundos apellidos u ORCID distintos.");
  }

  const matches=mergeMatchedWorks(found);
  if(!matches.length)return {status:"none",works:[],errors};
  const credible=matches.map(work=>work.matchedAuthor)
    .filter(item=>item?.name && !item.creatorComposite &&
      !/\b(coordinadores?|coordinadoras?|colaboradores?)\b/iu.test(item.name));
  const names=[...new Set(credible.map(item=>item.name))];
  const preferred=names.sort((a,b)=>
    normalizeAuthorName(b).split(" ").length -
      normalizeAuthorName(a).split(" ").length ||
    b.length-a.length)[0]||aliases[0];
  // A coauthor's ORCID must NEVER become the identity of the
  // researcher being viewed.
  const observedOrcids=[...new Set(matches
    .map(work=>orcid(work.matchedAuthor?.orcid||work.matchedAuthor?.id))
    .filter(Boolean))];
  const observed=orcid(options.orcid) ||
    (observedOrcids.length===1?observedOrcids[0]:null);
  const catalogSources=[...new Set(matches.flatMap(work=>work.providers||[]))];
  return {
    status:"resolved",
    resolution:"federated-author",
    author:{
      id:null,
      displayName:preferred,
      sourceDisplayName:preferred,
      aliases:[...new Set([original,...aliases,...names])],
      orcid:observed?"https://orcid.org/"+observed:null,
      wikidataId:null,biography:null,wikipediaUrl:null,
      corpusWorks:matches.length,catalog:"federated",catalogSources
    },
    works:matches.map((work,index)=>{
      const {matchedAuthor,...publicWork}=work;
      const full=normalizeAuthorName(preferred);
      const statement=normalizeAuthorName(publicWork.creatorStatement);
      const authors=publicWork.creatorStatement&&
        statement.startsWith(full+" ")
          ? (publicWork.authors||[]).map(a=>({
              ...a,name:preferred
            }))
          : publicWork.authors;
      return {...publicWork,authors,
        relevanceScore:Math.max(90,100-index*0.2),
        relevanceLevel:"Autor",
        authorIdentity:{
          exact:work.matchedAuthorEvidence==="orcid"||
            work.matchedAuthorEvidence==="exact-name",
          evidence:work.matchedAuthorEvidence,
          orcid:work.matchedAuthorEvidence==="orcid"?observed:null
        }
      };
    }),
    errors
  };
}

export async function resolveCrossrefAuthor(name,options={}) {
  const result=await resolveFederatedAuthor(name,{
    ...options,
    crossrefSearchImpl:options.searchImpl||options.crossrefSearchImpl,
    disableInternetArchive:true,
    disableCucsh:true
  });
  return result.status==="resolved"
    ? {...result,resolution:"crossref-author"}:result;
}
