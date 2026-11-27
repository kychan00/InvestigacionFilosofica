// Public bibliographic evidence, not a name-only identity override.
// Sources: https://consc.net/cv/ ; https://uchv.princeton.edu/people/peter-singer
// https://link.springer.com/article/10.1007/s43681-022-00243-8
// https://journals.sagepub.com/doi/10.1177/1468795X231182636
const key=s=>String(s||"").normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const ordered=s=>{const a=String(s||"").split(",");return key(a.length===2?a[1]+" "+a[0]:s)};
const id=s=>String(s||"").replace(/^https?:\/\/orcid\.org\//i,"").trim().toUpperCase();
const data=[
 {qid:"Q211539",names:["Peter Singer","Peter Albert David Singer","Peter A D Singer"],orcid:"0000-0003-3741-4314",dois:["10.1007/s43681-022-00243-8","10.1007/s43681-022-00187-z"],titles:["Animal Liberation","Animal Liberation A New Ethics for Our Treatment of Animals","Practical Ethics","The Expanding Circle","Rethinking Life and Death","The Life You Can Save","Animal Liberation Now","Ethics in the Real World","Democracy and Disobedience","Famine Affluence and Morality","AI Ethics The Case for Including Animals"]},
 {qid:"Q2127389",names:["Rahel Jaeggi","Rahel Jäggi"],orcid:"0000-0003-4713-7031",dois:["10.1177/1468795X231182636"],titles:["Alienation","Critique of Forms of Life","Progress and Regression","Sharing the Universal Resources Remarks on Honneth’s Understanding of Work","Um conceito amplo de economia economia como prática social e a crítica ao capitalismo"]},
 {qid:"Q366123",names:["David Chalmers","David John Chalmers","David J Chalmers","D J Chalmers"],birth:1966,strict:true,titles:["Facing Up to the Problem of Consciousness","The Hard Problem of Consciousness","Naturalistic Dualism","Idealism and the Mind Body Problem","The Extended Mind","The Conscious Mind","The Conscious Mind In Search of a Fundamental Theory","The Puzzle of Conscious Experience","Absent Qualia Fading Qualia Dancing Qualia","On Implementing a Computation","Does a Rock Implement Every Finite State Automaton","Moving Forward on the Problem of Consciousness","On the Search for the Neural Correlate of Consciousness","The Problems of Consciousness","The Content and Epistemology of Phenomenal Belief","The Meta Problem of Consciousness","Structuralism as a Response to Skepticism","The Virtual and the Real","Panpsychism and Panprotopsychism","Strong Necessities and the Mind Body Problem A Reply","Verbal Disputes","Three Puzzles about Spatial Experience","Constructing the World","Metametaphysics New Essays on the Foundations of Ontology"]}
];
export function reviewedAuthorForName(name){
 const n=ordered(name);
 return data.find(a=>a.names.some(x=>key(x)===n))||null;
}
export function reviewedTitle(authority,work){
 const title=key(work?.title).replace(/ \d+$/,"");
 return Boolean(authority?.titles.some(x=>key(x)===title));
}
export function reviewedAuthorEvidence(author,works=[]){
 const a=reviewedAuthorForName(author?.displayName||author?.sourceDisplayName);
 if(!a||reviewedAuthorForName(author?.sourceDisplayName||author?.displayName)!==a||
    (author.wikidataId&&author.wikidataId!==a.qid))return null;
 const o=id(author.orcid||author.orcidId);
 // Do not promote a different ORCID merely because a display name matches.
 if(o&&o!==a.orcid)return null;
 if(o&&author.orcidVerified===true&&o===a.orcid)return a;
 const authored=(works||[]).filter(w=>(!a.birth||!w.year||Number(w.year)>=a.birth)&&
    (w.authors||[]).some(p=>reviewedAuthorForName(p?.name||p?.displayName)===a &&
      (!p.orcid||id(p.orcid)===a.orcid)));
 if(authored.some(w=>a.dois?.includes(String(w.doi||"").replace(/^https?:\/\/doi\.org\//i,"").toLowerCase())))return a;
 const titles=new Set(authored.filter(w=>reviewedTitle(a,w)).map(w=>key(w.title).replace(/ \d+$/,"")));
 return titles.size>=2?a:null;
}
// For the documented Chalmers homonym collision, name-only federated
// results must match the reviewed bibliography. Unknown works remain
// unconfirmed, rather than being assigned to a philosopher by name.
export function filterReviewedAuthorWorks(name,works=[]){
 const a=reviewedAuthorForName(name);
 if(!a?.strict)return works;
 return works.filter(w=>(!w.year||Number(w.year)>=a.birth)&&reviewedTitle(a,w)&&
   (w.authors||[]).some(p=>reviewedAuthorForName(p?.name||p?.displayName)===a));
}
