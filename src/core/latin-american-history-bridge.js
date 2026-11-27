// Reviewed crosswalk between the canonical 1,504-person matrix and the
// existing intellectual-history authorities. Not a name-based resolver.
// Each entry was checked against the inventory and the individual dossier.
import { intellectualHistory } from "./author-intellectual-history.js?v=20261127-v5";
const LINKS = [
  [
    19,
    "Q183074",
    "Sor Juana Inés de la Cruz",
    [
      1648,
      1651
    ],
    1695
  ],
  [
    69,
    "Q335544",
    "José Carlos Mariátegui",
    [
      1894
    ],
    1930
  ],
  [
    71,
    "Q365193",
    "Adolfo Sánchez Vázquez",
    [
      1915
    ],
    2011
  ],
  [
    74,
    "Q891708",
    "Bolívar Echeverría",
    [
      1941
    ],
    2010
  ],
  [
    97,
    "Q1091141",
    "José Vasconcelos",
    [
      1882
    ],
    1959
  ],
  [
    98,
    "Q601364",
    "Antonio Caso",
    [
      1883
    ],
    1946
  ],
  [
    99,
    "Q7412445",
    "Samuel Ramos",
    [
      1897
    ],
    1959
  ],
  [
    103,
    "Q1879022",
    "Leopoldo Zea",
    [
      1912
    ],
    2004
  ],
  [
    105,
    "Q2370396",
    "Luis Villoro",
    [
      1922
    ],
    2014
  ],
  [
    110,
    "Q473518",
    "Enrique Dussel",
    [
      1934
    ],
    2023
  ],
  [
    162,
    "Q5711746",
    "Augusto Salazar Bondy",
    [
      1925
    ],
    1974
  ]
];
const byId = new Map(LINKS.map(([id,qid,name,born,died])=>[id,{id,qid,name,born,died}]));
const byQid = new Map([...byId.values()].map(link=>[link.qid,link]));
const norm=value=>String(value||"").normalize("NFC").trim().replace(/\s+/g," ").toLocaleLowerCase("es");
export function latinAmericanHistoryIdentity(record){
  // The ID, canonical name and independently catalogued lifespan must agree.
  // A missing or changed record fails closed, even when another name matches.
  const id=Number(record?.author_id);
  const link=byId.get(id);
  if(!Number.isInteger(id)||!link||norm(record.canonical_name)!==norm(link.name))return null;
  const birth=record.life?.born;
  const years=Number.isInteger(birth?.year)?[birth.year]:
    Array.isArray(birth?.candidates)?[...new Set(birth.candidates)].sort((a,b)=>a-b):[];
  if(years.length!==link.born.length||years.some((year,i)=>year!==link.born[i])||record.life?.died?.year!==link.died)return null;
  const author={wikidataId:link.qid,displayName:link.name};
  return intellectualHistory(author)?.region==="latin"?author:null;
}
export function latinAmericanDossierHref(author){
  const history=intellectualHistory(author);
  const link=history?.region==="latin"?byQid.get(history.id):null;
  return link?"./filosofia-latinoamericana.html#autor-"+String(link.id).padStart(4,"0"):null;
}
export function latinAmericanHistoryLinks(){
  return LINKS.map(([id,qid,name,born,died])=>({id,qid,name,born:[...born],died}));
}
