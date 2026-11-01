const AUTHOR_ORCID = "0000-0001-7335-1790";
const AUTHOR_NAME = "Dinora Hernández López";

function author(name = AUTHOR_NAME, orcid = AUTHOR_ORCID) {
  return {
    id: orcid ? `https://orcid.org/${orcid}` : null,
    orcid: orcid ? `https://orcid.org/${orcid}` : null,
    name
  };
}

function record(data) {
  return {
    id: `curated:dinora-hernandez-lopez:${data.slug}`,
    title: data.title,
    year: data.year ?? null,
    type: data.type || "article",
    language: "es",
    authors: data.authors || [author()],
    doi: data.doi || null,
    isbn: data.isbn || [],
    journal: data.journal || null,
    publisher: data.publisher || null,
    abstract: null,
    topics: (data.topics || []).map(name => ({id:null,name,score:null})),
    philosophers: [],
    traditions: [],
    providers: ["Bibliografía verificada"],
    sourceRecords: [{
      provider: "Bibliografía verificada",
      sourceId: data.sourceUrl,
      rank: null,
      query: AUTHOR_NAME,
      queryWeight: 1,
      queryType: "author",
      reviewed: true,
      evidenceLevel: data.evidenceLevel || "primary"
    }],
    matchedQueries: [],
    relevanceScore: 100,
    relevanceLevel: "Autor",
    metadataConfidence: 100,
    openAccess: data.openAccess ?? null,
    urls: {
      canonical: data.sourceUrl,
      doi: data.doi ? `https://doi.org/${data.doi}` : null,
      openAccess: data.openAccessUrl || null
    },
    institutionalLinks: [],
    retrievalMode: "author-curated",
    metadataAuthority: "curated",
    reviewed: true,
    authorIdentity: {
      exact: true,
      evidence: "curated-orcid",
      orcid: AUTHOR_ORCID
    },
    attributionEvidence: "curated-orcid",
    collaborationKind: data.collaborationKind || null,
    collectiveWork: Boolean(data.collectiveWork),
    coauthorCount: Number.isInteger(data.coauthorCount)
      ? data.coauthorCount
      : null,
    bibliographicRole: data.role || "autoría",
    containerTitle: data.containerTitle || null,
    pages: data.pages || null,
    notes: data.notes || null,
    alternativeTitles: data.alternativeTitles || []
  };
}

export const DINORA_HERNANDEZ_LOPEZ_BIBLIOGRAPHY = [
  record({
    slug: "escuela-frankfurt-metodologia-poder",
    title: "La Escuela de Frankfurt. Un acercamiento a su metodología de investigación y su filosofía del poder",
    year: 2013,
    type: "journal-article",
    journal: "Sincronía",
    pages: "1–20",
    sourceUrl: "https://revistasincronia.cucsh.udg.mx/index.php/sincronia/article/view/990",
    topics: ["Teoría crítica", "Escuela de Frankfurt"],
    alternativeTitles: [
      "La Escuela De Frankfurt Un Acercamiento A Su Filosofía Del Poder, Dinora Hernández"
    ]
  }),
  record({
    slug: "reconocimiento-relaciones-interculturales",
    title: "El reconocimiento en las relaciones interculturales: preámbulos ético-políticos para su debate",
    year: 2016,
    type: "book-chapter",
    containerTitle: "El papel de la filosofía latinoamericana en la actualidad",
    publisher: "Universidad de Guadalajara",
    isbn: ["9786077425564"],
    sourceUrl: "https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/253057/1/2016_978-607-742-556-4.pdf",
    topics: ["Filosofía latinoamericana", "Reconocimiento"]
  }),
  record({
    slug: "reflexiones-educacion-teoria-pedagogia-criticas",
    title: "Algunas reflexiones sobre educación de la teoría y pedagogía críticas",
    year: 2016,
    type: "book-chapter",
    publisher: "Universidad de Guadalajara",
    isbn: ["9786077425823"],
    sourceUrl: "https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/253056/1/2016_978-607-742-582-3.pdf",
    topics: ["Educación", "Teoría crítica", "Pedagogía crítica"]
  }),
  record({
    slug: "estatus-teoria-critica-contemporanea",
    title: "El estatus de la teoría crítica contemporánea. Apuntes para una teoría intransigente",
    year: 2018,
    type: "book-chapter",
    containerTitle: "Constelaciones y campos de fuerza en la Teoría crítica actual",
    pages: "79–106",
    authors: [author(), author("Gergana Petrova", null)],
    sourceUrl: "https://www.researchgate.net/publication/380542629_EL_ESTATUS_DE_LA_TEORIA_CRITICA_CONTEMPORANEA_APUNTES_PARA_UNA_TEORIA_INTRANSIGENTE",
    evidenceLevel: "secondary",
    collaborationKind: "collaboration",
    coauthorCount: 1,
    topics: ["Teoría crítica"]
  }),
  record({
    slug: "pedagogica-emancipacion-individuo",
    title: "De la «Pedagógica» a la emancipación del individuo",
    year: 2019,
    type: "book-chapter",
    containerTitle: "Siete ensayos sobre la Filosofía y Política de la Liberación de Enrique Dussel",
    publisher: "Universidad de Guadalajara",
    isbn: ["9786075474915"],
    authors: [author(), author("Gergana Petrova", null)],
    sourceUrl: "https://enriquedussel.com/txt/Textos_Libros_Sobre_ED/2019.Siete_ensayos-Ledesma_y_Ortiz.pdf",
    collaborationKind: "collaboration",
    coauthorCount: 1,
    topics: ["Enrique Dussel", "Pedagogía crítica", "Emancipación"]
  }),
  record({
    slug: "imagenes-dialecticas-patriarcado",
    title: "Imágenes dialécticas del patriarcado. Para una Teoría Crítica feminista desde la negatividad",
    year: 2020,
    type: "journal-article",
    journal: "Constelaciones. Revista de Teoría Crítica",
    sourceUrl: "https://constelaciones-rtc.net/article/view/3615",
    topics: ["Teoría crítica", "Feminismo", "Patriarcado"]
  }),
  record({
    slug: "teoria-critica-feminismo-juridico",
    title: "Teoría crítica y Feminismo jurídico: Dimensiones antipatriarcales",
    year: 2020,
    type: "journal-article",
    journal: "Religación",
    pages: "72–82",
    doi: "10.46652/rgn.v5i26.751",
    sourceUrl: "https://revista.religacion.com/index.php/religacion/article/view/751",
    topics: ["Teoría crítica", "Feminismo jurídico", "Patriarcado"]
  }),
  record({
    slug: "teoria-critica-racismo-mexico",
    title: "Para una Teoría Crítica del racismo en México: el caso de la caravana migrante",
    year: 2021,
    type: "journal-article",
    journal: "Xipe Totek",
    pages: "159–184",
    doi: "10.31391/sfj1e026",
    sourceUrl: "https://revistas.iteso.mx/index.php/XT/es/article/view/104",
    topics: ["Teoría crítica", "Racismo", "Migración"]
  }),
  record({
    slug: "teoria-critica-praxis-feminista",
    title: "Teoría crítica y praxis feminista. Tensiones entre Theodor W. Adorno y Raya Dunayevskaya",
    year: 2021,
    type: "book-chapter",
    containerTitle: "Ética, hermenéutica y política. Filosofía en el fondo",
    sourceUrl: "https://cucsh.academia.edu/DinoraHern%C3%A1ndez/Papers",
    evidenceLevel: "author-profile",
    topics: ["Teoría crítica", "Feminismo", "Theodor W. Adorno", "Raya Dunayevskaya"]
  }),
  record({
    slug: "elementos-filosofia-moral-negativa",
    title: "Elementos de filosofía moral negativa: violencia, vulnerabilidad y diferencia",
    year: 2022,
    type: "book",
    publisher: "Universidad de Guadalajara, CUCSH",
    isbn: ["9786075718309","9786075718293"],
    sourceUrl: "https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/253135/1/2022_978-607-571-830-9.pdf",
    openAccess: true,
    openAccessUrl: "https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/253135/1/2022_978-607-571-830-9.pdf",
    topics: ["Filosofía moral", "Teoría crítica", "Violencia"]
  }),
  record({
    slug: "educacion-superior-neoliberalismo-patriarcado",
    title: "Educación Superior en México, Neoliberalismo y Patriarcado",
    year: 2022,
    type: "book-chapter",
    containerTitle: "Filosofía, neoliberalismo y educación",
    pages: "39–68",
    isbn: ["9786078702756"],
    sourceUrl: "https://www.researchgate.net/publication/380530651_Educacion_Superior_en_Mexico_Neoliberalismo_y_Patriarcado",
    evidenceLevel: "author-upload",
    topics: ["Educación superior", "Neoliberalismo", "Patriarcado"]
  }),
  record({
    slug: "educacion-paz-pedagogia-negativa",
    title: "Educación para la paz y pedagogía negativa",
    year: 2022,
    type: "book-chapter",
    containerTitle: "Perturbando la Paz. Ensayos sobre educación, política y prácticas pedagógicas",
    pages: "39–62",
    sourceUrl: "https://www.researchgate.net/publication/380530814_Educacion_para_la_paz_y_pedagogia_negativa",
    evidenceLevel: "author-upload",
    topics: ["Educación para la paz", "Pedagogía negativa"]
  }),
  record({
    slug: "adorno-resistencia-briznas",
    title: "Theodor W. Adorno: resistencia y briznas de vida moral",
    year: 2023,
    type: "journal-article",
    journal: "Sincronía",
    pages: "3–22",
    sourceUrl: "https://revistasincronia.cucsh.udg.mx/index.php/sincronia/article/view/242",
    topics: ["Theodor W. Adorno", "Filosofía moral", "Teoría crítica"],
    alternativeTitles: [
      "Dra Dinora Hernández, Theodor W Adorno Resistencia Y Briznas"
    ]
  }),
  record({
    slug: "madres-buscadoras",
    title: "Madres buscadoras. Ante el horror desaparecedor en México",
    year: 2023,
    type: "journal-article",
    journal: "Iglesia Viva",
    pages: "95–100",
    sourceUrl: "https://dialnet.unirioja.es/servlet/autor?codigo=5321903",
    evidenceLevel: "bibliographic-index",
    topics: ["Violencia", "Desaparición", "Madres buscadoras"]
  }),
  record({
    slug: "teoria-critica-planteamientos",
    title: "Teoría crítica. Planteamientos, desplazamientos, tensiones",
    year: 2023,
    type: "book",
    publisher: "Universidad de Guadalajara, CUCSH",
    isbn: ["9786075810690","9786075810881"],
    authors: [author(), author("Hermann Omar Amaya Velasco", null)],
    sourceUrl: "https://publicaciones.udg.mx/gpd-teoria-critica-9786075810690-66bfa1bf3c87f.html",
    collectiveWork: true,
    collaborationKind: "collaboration",
    coauthorCount: 1,
    role: "coordinación",
    topics: ["Teoría crítica", "Escuela de Frankfurt"],
    alternativeTitles: [
      "Dinora Hernández, Hermann Omar Amaya, Y Colaboradores, Teoría Crítica, Plantamientos, Desplazamientos, Tensiones",
      "Dra Dinora Hernández Y Varios, Teoría Crítica, Plantamientos, Desplazamientos, Tensiones"
    ]
  }),
  record({
    slug: "critica-violencia-diferencia-adorno",
    title: "La crítica de la violencia contra la diferencia de Theodor W. Adorno ante los enfoques ético-políticos de «diferencia administrada»",
    year: 2023,
    type: "book-chapter",
    containerTitle: "Teoría crítica. Planteamientos, desplazamientos, tensiones",
    pages: "123–",
    publisher: "Universidad de Guadalajara, CUCSH",
    isbn: ["9786075810881"],
    sourceUrl: "https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/253169/1/2023_978-607-581-088-1.pdf",
    topics: ["Theodor W. Adorno", "Violencia", "Diferencia"]
  }),
  record({
    slug: "feminicidio-economia-politica-feminista",
    title: "Feminicidio: elementos para su comprensión desde la crítica de la economía política feminista",
    year: 2024,
    type: "journal-article",
    journal: "Debate Feminista",
    pages: "3–31",
    doi: "10.22201/cieg.2594066xe.2024.67.2403",
    sourceUrl: "https://debatefeminista.cieg.unam.mx/index.php/debate_feminista/article/view/2403",
    topics: ["Feminicidio", "Economía política feminista", "Teoría crítica"]
  }),
  record({
    slug: "sujeto-subjetividad-adorno",
    title: "Sujeto y subjetividad en la teoría crítica de Th. W. Adorno",
    year: 2024,
    type: "journal-article",
    journal: "Bajo el Volcán",
    pages: "17–46",
    doi: "10.32399/ICSYH.bvbuap.2954-4300.2024.5.10.743",
    sourceUrl: "https://www.rdb.buap.mx/ojs-3311-bajovolcan/index.php/bajovolc/article/view/743",
    topics: ["Theodor W. Adorno", "Sujeto", "Subjetividad"]
  }),
  record({
    slug: "apuntes-patriarcado-violencia-mujeres",
    title: "Apuntes sobre la crítica del patriarcado y la violencia contra las mujeres en la teoría crítica",
    year: 2024,
    type: "journal-article",
    journal: "Constelaciones. Revista de Teoría Crítica",
    sourceUrl: "https://constelaciones-rtc.net/article/view/5540",
    topics: ["Teoría crítica", "Patriarcado", "Violencia contra las mujeres"]
  }),
  record({
    slug: "filosofia-feminista-intervenciones",
    title: "Filosofía feminista: Intervenciones",
    year: 2024,
    type: "book",
    publisher: "Universidad de Guadalajara, CUCSH",
    isbn: ["9786075813516","9786075813523"],
    sourceUrl: "https://riudg.udg.mx/handle/20.500.12104/111605?mode=full",
    role: "coordinación",
    collectiveWork: true,
    topics: ["Filosofía feminista", "Feminismo"]
  }),
  record({
    slug: "juliette-dialectica-ilustracion",
    title: "Juliette en la dialéctica de la Ilustración: sujeto soberano, vulnerabilidad y violencia contra las mujeres",
    year: 2024,
    type: "book-chapter",
    containerTitle: "Crítica de la violencia. Análisis de su materialidad y sus formas en perspectiva filosófica",
    pages: "45–64",
    sourceUrl: "https://constelaciones-rtc.net/article/view/5540",
    evidenceLevel: "bibliographic-reference",
    topics: ["Dialéctica de la Ilustración", "Violencia contra las mujeres"]
  }),
  record({
    slug: "despues-metoo",
    title: "Después del #MeToo. Percepción de los hombres sobre el #MeToo y los movimientos feministas contra el acoso y hostigamiento sexual",
    year: 2025,
    type: "journal-article",
    journal: "Revista de Estudios de Género, La Ventana",
    doi: "10.32870/lv.v0i0.8150",
    sourceUrl: "https://revistalaventana.cucsh.udg.mx/index.php/LV/article/view/8150",
    topics: ["#MeToo", "Masculinidades", "Feminismo", "Acoso sexual"]
  }),
  record({
    slug: "perspectiva-imbricacion",
    title: "La perspectiva de la imbricación: Aportaciones teórico-metodológicas a la crítica de la violencia contra las mujeres",
    year: 2026,
    type: "book-chapter",
    containerTitle: "Violencias de Género. Andamiajes multidisciplinarios para su abordaje",
    publisher: "Universidad de Guadalajara",
    isbn: ["9786075819488"],
    sourceUrl: "https://publicaciones.udg.mx/gpd-violencias-de-genero-9786075819488-6a3c0d1defd6a.html",
    topics: ["Violencia contra las mujeres", "Género"],
    alternativeTitles: [
      "La Perspectiva De La Imbricacion Aportaciones Teórico Metodológicas A La Crítica De La Violencia Contra Las Mujeres, Dinora Hernández"
    ]
  })
];

export const CURATED_AUTHOR_BIBLIOGRAPHIES = {
  "0000-0001-7335-1790": DINORA_HERNANDEZ_LOPEZ_BIBLIOGRAPHY
};
