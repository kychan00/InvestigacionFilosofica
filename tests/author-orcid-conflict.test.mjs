import assert from "node:assert/strict";
import test from "node:test";
import { rejectedAuthorOrcid, sanitizeAuthorOrcid, profileMatchesOrderedAuthor, removeRejectedWorkOrcid } from "../src/core/author-orcid-guard.js";
import { chooseSnapshotAuthorIdentity } from "../src/core/author-identity-lookup.js";
import { discoverAuthorArchive } from "../src/core/author-deep-discovery.js";
import { portraitIdentity, matchesPortraitIdentity } from "../src/core/author-portrait-policy.js";
const wrong="0000-0003-0282-8605";
const philosopher={id:"123",displayName:"Walter Benjamín",sourceDisplayName:"Walter Benjamin",orcid:wrong};
const candidate=(id,n)=>({id,n,o:wrong,cw:5});
const claim=value=>({rank:"normal",mainsnak:{snaktype:"value",datavalue:{value}}});
test("documented false ORCID is removed from the philosopher but not from its real registrant",()=>{
 assert.ok(rejectedAuthorOrcid("Walter Benjamín",wrong));
 assert.ok(rejectedAuthorOrcid("Benjamin, Walter",wrong));
 assert.equal(rejectedAuthorOrcid("Benjamin Walter",wrong),false);
 assert.equal(sanitizeAuthorOrcid(philosopher).orcid,null);
 assert.equal(sanitizeAuthorOrcid({displayName:"Benjamin Walter",orcid:wrong}).orcid,wrong);
 const selected=chooseSnapshotAuthorIdentity("Walter Benjamin",{status:"candidates",candidates:[candidate("123","Walter Benjamin"),candidate("456","Benjamin Walter")]});
 assert.equal(selected.status,"resolved");
 assert.deepEqual(selected.candidate.linkedAuthorIds,["123"]);
 assert.equal(selected.candidate.o,null);
 const identity=portraitIdentity(philosopher);
 assert.equal(identity.qid,"Q61078");
 assert.equal(identity.orcid,null);
 assert.notEqual(portraitIdentity({id:"456",displayName:"Benjamin Walter",orcid:wrong}).qid,"Q61078");
 assert.equal(removeRejectedWorkOrcid({authors:[{name:"Walter Benjamin",orcid:wrong}]},philosopher).authors[0].orcid,null);
});
test("ordered names reject reversed names and accept explicit comma-form names",()=>{
 const person={displayName:"Benjamin Walter",givenName:"Benjamin",familyName:"Walter"};
 assert.equal(profileMatchesOrderedAuthor({displayName:"Walter Benjamin"},person),false);
 assert.equal(profileMatchesOrderedAuthor({displayName:"Walter, Benjamin"},person),true);
 assert.equal(profileMatchesOrderedAuthor({displayName:"Benjamin Walter"},person),true);
});
test("a known conflict never queries ORCID works, profile, or Crossref ORCID",async()=>{
 const forbidden=async()=>{assert.fail("incorrect registry must not be queried");};
 let snapshot;
 const result=await discoverAuthorArchive({author:philosopher,
  snapshotImpl:async args=>{snapshot=args;return {works:[],complete:true}},
  federatedImpl:async(name,args)=>{assert.equal(args.orcid,null);return {status:"none",works:[]}},
  orcidProfileImpl:forbidden,orcidRegistryImpl:forbidden,orcidSearchImpl:forbidden});
 assert.equal(snapshot.orcid,null);
 assert.equal(result.verifiedOrcid,null);
 assert.equal(result.orcidVerification,"conflict");
 assert.equal(result.orcidProfile,null);
});
test("a newly encountered mismatch quarantines all ORCID enrichment",async()=>{
 let workRequests=0;
 const result=await discoverAuthorArchive({author:{id:"123",displayName:"Ana Pérez",orcid:"0000-0002-1825-0097"},
  snapshotImpl:async args=>{assert.equal(args.orcid,null);return {works:[],complete:true}},
  federatedImpl:async(name,args)=>{assert.equal(args.orcid,null);return {status:"none",works:[]}},
  orcidProfileImpl:async()=>({displayName:"Pérez Ana",givenName:"Pérez",familyName:"Ana",hasPublicProfileData:true}),
  orcidRegistryImpl:async()=>{workRequests++;return {works:[]}},
  orcidSearchImpl:async()=>{workRequests++;return {works:[]}}});
 assert.equal(workRequests,0);
 assert.equal(result.orcidVerification,"conflict");
 assert.equal(result.orcidProfile,null);
});
test("a corroborated ORCID and exact OpenAlex can coexist with a portrait when Wikidata lacks P496",()=>{
 const author={id:"123",displayName:"Ana Pérez",orcid:"0000-0002-1825-0097",orcidVerified:true,wikidataId:"Q123"};
 const entity={id:"Q123",claims:{P31:[claim({id:"Q5"})],P10283:[claim("A123")]}};
 assert.equal(matchesPortraitIdentity(entity,portraitIdentity(author)),true);
 assert.equal(matchesPortraitIdentity(entity,portraitIdentity({...author,orcidVerified:false})),false);
 entity.claims.P496=[claim(wrong)];
 assert.equal(matchesPortraitIdentity(entity,portraitIdentity(author)),false);
});
