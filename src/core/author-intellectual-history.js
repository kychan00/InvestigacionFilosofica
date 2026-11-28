// Reviewed intellectual-history pilot. Only original Spanish summaries,
// not copied biographies. Identity keys are authority QIDs, not search names.
import { PHASE2_SOURCES, PHASE2_AUTHORS } from './author-intellectual-history-phase2.js?v=20261127-history-evidence-v1';
import { PHASE3_SOURCES, PHASE3_AUTHORS } from './author-intellectual-history-phase3.js?v=20261127-v3';
import { PHASE4_SOURCES, PHASE4_AUTHORS } from './author-intellectual-history-phase4.js?v=20261127-v4';
import { PHASE5_SOURCES, PHASE5_AUTHORS } from './author-intellectual-history-phase5.js?v=20261127-v5';
const SOURCES = {
  ...PHASE5_SOURCES,
  ...PHASE4_SOURCES,
  ...PHASE3_SOURCES,
  ...PHASE2_SOURCES,
  "plato": [
    "Stanford Encyclopedia of Philosophy",
    "https://plato.stanford.edu/entries/plato/"
  ],
  "academy": [
    "Internet Encyclopedia of Philosophy",
    "https://iep.utm.edu/plato-academy/"
  ],
  "aristotle": [
    "Stanford Encyclopedia of Philosophy",
    "https://plato.stanford.edu/entries/aristotle/#AriLif"
  ],
  "kant": [
    "Stanford Encyclopedia of Philosophy",
    "https://plato.stanford.edu/entries/kant/#LifWor"
  ],
  "hegel": [
    "Stanford Encyclopedia of Philosophy",
    "https://plato.stanford.edu/entries/hegel/"
  ],
  "hegelRight": [
    "Cambridge University Press · David James",
    "https://www.cambridge.org/core/books/abs/hegels-elements-of-the-philosophy-of-right/introduction-freedom-and-history-in-hegels-philosophy-of-right/8C0F3B03487083C4B01957A013B4B72A"
  ],
  "dusselTeaching": [
    "Colegio de Filosofía · UNAM",
    "https://colegiodefilosofia.filos.unam.mx/inicio/profesores/profesores-del-colegio-de-filosofia/dr-enrique-dussel/"
  ],
  "sor": [
    "Biblioteca Nacional de España",
    "https://www.bne.es/es/autores/juana-ines-cruz-sor"
  ],
  "sorDates": [
    "Biblioteca Virtual Miguel de Cervantes",
    "https://www.cervantesvirtual.com/obras/autor/juana-ines-de-la-cruz-sor-1651-1695-61"
  ],
  "sorGov": [
    "Secretaría de Gobernación de México",
    "https://www.gob.mx/segob/articulos/conoce-mas-acerca-de-sor-juana-ines-de-la-cruz?idiom=es"
  ],
  "dussel": [
    "Portal de Archivos Españoles",
    "https://pares.cultura.gob.es/ParesBusquedas20/catalogo/autoridad/255594"
  ],
  "dusselUNAM": [
    "UNAM Global",
    "https://unamglobal.unam.mx/global_revista/fallece-el-filosofo-enrique-dussel/"
  ]
};
const AUTHORS = {
  ...PHASE5_AUTHORS,
  ...PHASE4_AUTHORS,
  ...PHASE3_AUTHORS,
  ...PHASE2_AUTHORS,
  "Q859": {
    "names": [
      "Platón",
      "Plato",
      "Plato Plato",
      "Πλάτων"
    ],
    "region": "europe",
    "events": [
      [
        -429,
        "c. 429 a. C.",
        "birth",
        "Nacimiento de Platón",
        "plato"
      ],
      [
        -387,
        "387–383 a. C. (aprox.)",
        "institution",
        "Formación de la Academia ateniense",
        "academy"
      ],
      [
        -347,
        "347 a. C.",
        "death",
        "Fallecimiento",
        "plato"
      ]
    ]
  },
  "Q868": {
    "names": [
      "Aristóteles",
      "Aristotle",
      "Aristotle Aristotle",
      "Ἀριστοτέλης"
    ],
    "region": "europe",
    "events": [
      [
        -384,
        "384 a. C.",
        "birth",
        "Nacimiento de Aristóteles",
        "aristotle"
      ],
      [
        -347,
        "347 a. C.",
        "career",
        "Deja la Academia tras la muerte de Platón",
        "aristotle"
      ],
      [
        -343,
        "343 a. C.",
        "career",
        "Se traslada a Pella como tutor de Alejandro",
        "aristotle"
      ],
      [
        -335,
        "335 a. C.",
        "institution",
        "Establece su escuela en el Liceo de Atenas",
        "aristotle"
      ],
      [
        -322,
        "322 a. C.",
        "death",
        "Fallecimiento en Calcis",
        "aristotle"
      ]
    ]
  },
  "Q9312": {
    "names": [
      "Immanuel Kant",
      "Emmanuel Kant",
      "Kant, Immanuel"
    ],
    "region": "europe",
    "events": [
      [
        1724,
        "1724",
        "birth",
        "Nacimiento en Königsberg",
        "kant"
      ],
      [
        1755,
        "1755",
        "career",
        "Comienza a enseñar en la Universidad de Königsberg",
        "kant"
      ],
      [
        1781,
        "1781",
        "publication",
        "Primera edición de Crítica de la razón pura",
        "kant"
      ],
      [
        1788,
        "1788",
        "publication",
        "Publicación de Crítica de la razón práctica",
        "kant"
      ],
      [
        1790,
        "1790",
        "publication",
        "Publicación de Crítica del juicio",
        "kant"
      ],
      [
        1804,
        "1804",
        "death",
        "Fallecimiento",
        "kant"
      ]
    ]
  },
  "Q9235": {
    "names": [
      "Georg Wilhelm Friedrich Hegel",
      "G. W. F. Hegel",
      "G.W.F. Hegel",
      "Georg Friedrich Wilhelm Hegel",
      "Hegel"
    ],
    "region": "europe",
    "events": [
      [
        1770,
        "1770",
        "birth",
        "Nacimiento de Hegel",
        "hegel"
      ],
      [
        1807,
        "1807",
        "publication",
        "Publicación de Fenomenología del espíritu",
        "hegel"
      ],
      [
        1816,
        "1816",
        "career",
        "Cátedra de filosofía en Heidelberg",
        "hegel"
      ],
      [
        1817,
        "1817",
        "publication",
        "Primera edición de Enciclopedia de las ciencias filosóficas",
        "hegel"
      ],
      [
        1818,
        "1818",
        "career",
        "Cátedra de filosofía en Berlín",
        "hegel"
      ],
      [
        1820,
        "1820 (portada: 1821)",
        "publication",
        "Publicación de Principios de la filosofía del derecho",
        "hegelRight",
        "hegel"
      ],
      [
        1831,
        "1831",
        "death",
        "Fallecimiento",
        "hegel"
      ]
    ]
  },
  "Q183074": {
    "names": [
      "Sor Juana Inés de la Cruz",
      "Juana Inés de la Cruz",
      "Juana Inés de Asuaje",
      "Cruz, Sor Juana Inés de la",
      "Juana Inés de la Cruz, Sor"
    ],
    "region": "latin",
    "events": [
      [
        1648,
        "1648 o 1651 (discutido)",
        "birth",
        "Nacimiento de Sor Juana",
        "sorDates"
      ],
      [
        1689,
        "1689",
        "publication",
        "Publicación de Inundación castálida en España",
        "sor"
      ],
      [
        1690,
        "1690",
        "publication",
        "Carta atenagórica",
        "sorGov"
      ],
      [
        1691,
        "1691",
        "composition",
        "Redacción de Respuesta a Sor Filotea de la Cruz",
        "sorGov"
      ],
      [
        1695,
        "1695",
        "death",
        "Fallecimiento",
        "sor"
      ]
    ]
  },
  "Q473518": {
    "names": [
      "Enrique Dussel",
      "Enrique D. Dussel",
      "Enrique Domingo Dussel Ambrosini",
      "Enrique Dussel Ambrosini",
      "Dussel, Enrique"
    ],
    "region": "latin",
    "events": [
      [
        1934,
        "1934",
        "birth",
        "Nacimiento en La Paz, Mendoza",
        "dusselUNAM"
      ],
      [
        1957,
        "1957",
        "career",
        "Licenciatura en Filosofía en la Universidad Nacional de Cuyo",
        "dussel"
      ],
      [
        1967,
        "1967",
        "career",
        "Doctorado en Historia en la Sorbona",
        "dussel"
      ],
      [
        1975,
        "1975",
        "career",
        "Exilio en México",
        "dussel"
      ],
      [
        1976,
        "1976",
        "career",
        "Docencia de Ética y Filosofía Política en la UNAM",
        "dusselTeaching",
        "dusselUNAM"
      ],
      [
        2023,
        "2023",
        "death",
        "Fallecimiento en Ciudad de México",
        "dusselUNAM"
      ]
    ]
  }
};
// Return fresh values; useful for full-catalogue validation without exposing mutable data.
export function intellectualHistoryAuthorities(){
  return Object.entries(AUTHORS).map(([id,record])=>({id,name:record.names[0],aliases:[...record.names]}));
}
export const BIO_BATCH = 3;
export const BIO_TYPES = Object.freeze({birth:"Nacimiento",death:"Fallecimiento",career:"Trayectoria",institution:"Institución",publication:"Publicación original",composition:"Redacción",posthumous:"Publicación póstuma",award:"Reconocimiento",floruit:"Periodo de actividad",revision:"Edición revisada"});
const norm = value => String(value || "").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
export function intellectualHistory(author) {
  const rawId=String(author?.wikidataId || "").trim();
  // Accept only the canonical authority ID or its exact Wikidata URI.
  const id=rawId.replace(/^https?:\/\/(?:www\.)?wikidata\.org\/(?:wiki|entity)\/(Q\d+)\/?$/,"$1");
  if(!/^Q\d+$/.test(id)||!Object.hasOwn(AUTHORS,id)) return null;
  const record=AUTHORS[id];
  // A QID and corroborating resolved display name are both required.
  // Never join a person or infer an event just from their surname.
  const name=norm(author.displayName || author.name);
  if(!name||!record.names.some(alias=>norm(alias)===name))return null;
  const events=record.events.map(([year,date,type,title,source,...additionalSources],i)=>({
    id:id+"-"+i,year,date,type,title,source:{name:SOURCES[source][0],url:SOURCES[source][1]},
    additionalSources:additionalSources.map(key=>({name:SOURCES[key][0],url:SOURCES[key][1]}))
  })).sort((a,b)=>a.year-b.year);
  return {id,region:record.region,events};
}
