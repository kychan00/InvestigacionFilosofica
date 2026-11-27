import { portraitIdentity, resolveAuthorPortrait, downloadPortrait, PORTRAIT_TIMEOUT_MS, PORTRAIT_MAX_SIDE } from "../src/core/author-portrait-policy.js?v=6";

/**
 * Exactly one transient portrait session per open author dossier. Repeated
 * renderAuthorPage calls reuse that session; navigating away destroys it.
 * No persistent storage, third-party HTML, or direct remote <img> hotlinks.
 */
export function createAuthorPortraitSession({
  resolve=resolveAuthorPortrait, download=downloadPortrait,
  createURL=blob=>URL.createObjectURL(blob), revokeURL=url=>URL.revokeObjectURL(url),
  decode=async url=>{const img=new Image(); img.src=url; try { await img.decode(); return {width:img.naturalWidth,height:img.naturalHeight}; } finally { img.removeAttribute("src"); }},
  timeoutMs=PORTRAIT_TIMEOUT_MS
}={}) {
  let session=null;
  function resetSlot(slot) {
    if(!slot) return;
    slot.removeAttribute("data-siva-ready");
    const figure=slot.querySelector(".siva-portrait");
    if(figure){figure.hidden=true; figure.replaceChildren();}
    const seal=slot.querySelector(".author-page-seal");
    if(seal)seal.hidden=false;
  }
  function releasePending(s) {
    if(s.pendingURL){const url=s.pendingURL;s.pendingURL=null;revokeURL(url);}
  }
  function close() {
    const old=session; session=null;
    if(!old)return;
    clearTimeout(old.timer);
    old.controller.abort();
    resetSlot(old.slot);
    releasePending(old);
    if(old.url)revokeURL(old.url);
    old.url=null;old.meta=null;old.slot=null;
  }
  function paint(s) {
    if(session!==s || !s.url || !s.meta || !s.slot?.isConnected) return;
    const figure=s.slot.querySelector(".siva-portrait");
    if(!figure || s.slot.hasAttribute("data-siva-ready")) return;
    const doc=figure.ownerDocument;
    const img=doc.createElement("img");
    img.src=s.url;img.alt="Retrato de "+s.name;img.decoding="async";
    img.width=s.meta.width;img.height=s.meta.height;
    const caption=doc.createElement("figcaption");
    const label=doc.createElement("strong");label.textContent="Retrato documental";
    const credit=doc.createElement("div");credit.textContent=s.meta.credit;
    const links=doc.createElement("div");links.className="siva-portrait-links";
    for(const [title,href] of [["Fuente original",s.meta.source],[s.meta.license.label,s.meta.license.url],["Identidad",s.meta.identity]]) {
      const a=doc.createElement("a");a.href=href;a.textContent=title;a.target="_blank";a.rel="noopener noreferrer";
      links.append(a);
    }
    caption.append(label,credit,links);figure.replaceChildren(img,caption);
    const seal=s.slot.querySelector(".author-page-seal");if(seal)seal.hidden=true;
    figure.hidden=false;s.slot.setAttribute("data-siva-ready","");
  }
  async function load(s,identity) {
    try {
      const meta=await resolve(identity,{signal:s.controller.signal});
      if(!meta || session!==s || s.controller.signal.aborted)return;
      const blob=await download(meta,{signal:s.controller.signal});
      if(session!==s || s.controller.signal.aborted)return;
      s.pendingURL=createURL(blob);
      const size=await decode(s.pendingURL);
      if(session!==s || s.controller.signal.aborted || !(size.width>0 && size.height>0 && size.width<=PORTRAIT_MAX_SIDE && size.height<=PORTRAIT_MAX_SIDE))return;
      s.meta={...meta,width:size.width,height:size.height};s.url=s.pendingURL;s.pendingURL=null;paint(s);
    } catch { /* missing, unsafe, blocked, slow: retain initials, no error UI */ }
    finally {
      clearTimeout(s.timer);
      releasePending(s);
    }
  }
  function open(author,slot,works=[]) {
    const identity=portraitIdentity(author,works);
    if(!identity || !slot){close();return Promise.resolve();}
    if(session?.key===identity.key){
      if(session.slot!==slot){resetSlot(session.slot);session.slot=slot;}
      session.name=String(author.displayName||"");paint(session);return session.task;
    }
    close();
    const s={key:identity.key,slot,name:String(author.displayName||""),controller:new AbortController(),url:null,pendingURL:null,meta:null};
    session=s;
    s.timer=setTimeout(()=>{
      if(session===s&&!s.url){
        s.controller.abort();releasePending(s);resetSlot(s.slot);
      }
    },timeoutMs);
    s.task=load(s,identity);return s.task;
  }
  return {open,close};
}
