import assert from "node:assert/strict";
import {chromium} from "playwright";
const base=process.env.MOBILE_UI_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
 const page=await browser.newPage();
 await page.goto(new URL("assets/territory-kant.jpg",base).href);
 const reports=await page.evaluate(async base=>{
  const {portraitIdentity,resolveAuthorPortrait,downloadPortrait}=await import(new URL("src/core/author-portrait-policy.js",base).href);
  const authors=[{displayName:"Immanuel Kant",wikidataId:"Q9312"},{displayName:"Georg Wilhelm Friedrich Hegel",wikidataId:"Q9235"},{displayName:"Socrates",wikidataId:"Q913"}];
  const results=[];
  for(const author of authors){
   const trace=[];
   const signal=AbortSignal.timeout(15000);
   const fetcher=async(url,options)=>{
    const u=new URL(url);const action=u.searchParams.get("action")||"image";
    try{
     const response=await fetch(url,options);
     const entry={host:u.hostname,action,status:response.status};
     if(action==="wbgetentities"){
      const data=await response.clone().json();
      entry.entities=Object.values(data.entities||{}).map(x=>({id:x.id,orcid:(x.claims?.P496||[]).map(c=>c.mainsnak?.datavalue?.value),openalex:(x.claims?.P10283||[]).map(c=>c.mainsnak?.datavalue?.value),image:(x.claims?.P18||[]).map(c=>({rank:c.rank,file:c.mainsnak?.datavalue?.value}))}));
     }else if(action==="query"){
      const data=await response.clone().json();
      entry.files=Object.values(data.query?.pages||{}).map(x=>({title:x.title,license:x.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value,restrictions:x.imageinfo?.[0]?.extmetadata?.Restrictions?.value,width:x.imageinfo?.[0]?.thumbwidth,height:x.imageinfo?.[0]?.thumbheight,url:x.imageinfo?.[0]?.thumburl}));
     }
     trace.push(entry);return response;
    }catch(error){trace.push({host:u.hostname,action,error:String(error)});throw error;}
   };
   try{
    const meta=await resolveAuthorPortrait(portraitIdentity(author),{fetcher,signal});
    if(!meta){results.push({author:author.displayName,status:"no-portrait",trace});continue;}
    const blob=await downloadPortrait(meta,{fetcher,signal});
    const url=URL.createObjectURL(blob);
    try{
     const img=new Image();img.src=url;await img.decode();
     results.push({author:author.displayName,status:"decoded",bytes:blob.size,width:img.naturalWidth,height:img.naturalHeight,license:meta.license.label,source:meta.source,trace});
    }finally{URL.revokeObjectURL(url);}
   }catch(error){results.push({author:author.displayName,status:"error",error:String(error),trace});}
  }
  return results;
 },base);
 console.log("SIVA_LIVE_REPORT "+JSON.stringify(reports));
 assert.ok(reports.some(x=>x.status==="decoded"&&x.bytes<=262144&&x.width<=480&&x.height<=480),"No live portrait passed the actual browser policy");
}finally{await browser.close();}
