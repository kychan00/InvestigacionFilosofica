import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const overlay = JSON.parse(
  await readFile("src/data/protrepsis-editorial-keywords.json", "utf8")
);

const batch01 = new Map([
  ["10.32870/prot.i30.515", ["Velo","imagen","aparición","Petrarca","Simone Martini","Servio","fantasma"]],
  ["10.32870/prot.i30.514", ["Totalitarismo","México","exterminio","otredad","violencia"]],
  ["10.32870/prot.i30.511", ["Metáfora","mito","estigmatización","biopolítica","crisis sanitaria"]],
  ["10.32870/prot.i30.510", ["Estudiantes indígenas","violencia cultural","discriminación racial","epistemología crítica","educación intercultural","justicia epistémica"]],
  ["10.32870/prot.i30.495", ["Vitalismo","Dicotomía","Doble frenesí","Amor como caridad","Sociedad abierta"]],
  ["10.32870/prot.i29.509", ["Heidegger","tiempo","historia","hermenéutica","medida"]],
  ["10.32870/prot.i29.504", ["Negatividad","no-identidad","crítica inmanente","constelaciones"]],
  ["10.32870/prot.i29.499", ["Movimiento","continuidad","medición","numeración","alma"]],
  ["10.32870/prot.i29.501", ["Plotino","Bergson","Metafísica","Semiótica","Duración"]],
  ["10.32870/prot.i29.477", ["Redes sociales","transparencia","desinformación","Nayib Bukele","influencia digital","ciudadanía informada"]],
  ["10.32870/prot.i29.494", ["Duelo","violencia","nosotros","vulnerabilidad","proximidad","comunidad"]]
]);

const batch02 = new Map([
  ["10.32870/prot.i29.503", ["Animalidad","muerte","tiempo","poesía"]],
  ["10.32870/prot.i29.497", ["Levinas","exclusión","violencia","género","ontología"]],
  ["10.32870/prot.i29.496", ["Hermenéutica","univocismo","equivocismo","analogía","cientificismo","posmodernidad"]],
  ["10.32870/prot.i29.488", ["Tiempo lineal","tiempo del oprimido","trauma","resistencia","memoria","anacronismo"]],
  ["10.32870/prot.i28.489", ["Foucault","cinismo","resistencia","arte"]],
  ["10.32870/prot.i28.483", ["Movimientos sociales","pacientes","derecho a la salud","ética"]],
  ["10.32870/prot.i27.474", ["Análisis","a priori","concepto","intuición","mundos posibles","síntesis"]],
  ["10.32870/prot.i27.469", ["Discernimiento reflexionante","juicio","pedagogía","crítica","finalidad de la naturaleza","ideas estéticas"]],
  ["10.32870/prot.i27.453", ["Capitalismo tardío","funcionalidad civilizatoria","mal del ímpetu","lo absurdo","desprendimiento","habitar este espacio"]],
  ["10.32870/prot.i27.457", ["Deber indirecto-directo","clemencia","libertad","justicia"]]
]);

const batch03 = new Map([
  ["10.32870/prot.i26.449", ["Marxismo crítico","emancipación","materialismo","cultura material"]],
  ["10.32870/prot.i26.447", ["Estética","espíritu","fealdad"]],
  ["10.32870/prot.i26.446", ["Idea","interpretación","obra de arte","fragmento","fenómeno originario"]],
  ["10.32870/prot.i26.442", ["Aura","cine","emancipación","fotografía","marxismo"]],
  ["10.32870/prot.i26.436", ["Escuela de Frankfurt","Instituto de Investigación Social","presente","fascismo","nueva derecha"]],
  ["10.32870/prot.i26.432", ["Concepto","cognición 4-E","habitar","filosofía del lenguaje","discurso"]],
  ["10.32870/prot.i26.425", ["Ibero Gutiérrez","Heidegger","recepción","filosofía en el Uruguay","actualidad"]],
  ["10.32870/prot.i25.422", ["Imagen","filosofía de la imagen","giro hacia la imagen","ciencia de la imagen","praxis negativa"]],
  ["10.32870/prot.i25.418", ["Historia","verdad","saber","máscara","olvido","creación","Chat GPT"]],
  ["10.32870/prot.i25.414", ["Ética","lenguaje","mística","mundo","lo inexpresable","el significado de la vida"]]
]);

const batch04 = new Map([
  ["10.32870/prot.i22.317", ["Cyborg feminismo","epistemología","ontología","logos","metáfora"]],
  ["10.32870/prot.i22.312", ["Epistemologías feministas","metáforas científicas","discurso científico"]],
  ["10.32870/prot.i22.336", ["Creencias generales","pseudoracionalidad","cierre epistémico","falacias narrativas"]],
  ["10.32870/prot.i22.328", ["Filosofía medieval","doctrinas filosóficas","bibliotecas novohispanas"]],
  ["10.32870/prot.i22.359", ["Amor","maldad","mecanicismo","libertad","deseo","egoísmo"]],
  ["10.32870/prot.i22.358", ["Platón","Sócrates","Eros","conocimiento","locura"]],
  ["10.32870/prot.i22.369", ["Platón","Alain Badiou","Slavoj Žižek","Agustín de Hipona","psicoanálisis","amor","verdad","melancolía"]],
  ["10.32870/prot.i22.354", ["Amor","afección","géneros de conocimiento","pasión"]],
  ["10.32870/prot.i22.348", ["Filosofía","sexualidad","seducción","producción","Baudrillard"]],
  ["10.32870/prot.i22.343", ["Bien","belleza","verdad","mujeres filósofas","justicia","equilibrio"]]
]);

const batch05 = new Map([
  [
    "10.32870/prot.i23.374",
    [
      "mundo común",
      "pareja",
      "fraternidad",
      "compasión",
      "amistad"
    ]
  ],
  [
    "10.32870/prot.i23.404",
    [
      "Cuerpo",
      "labor",
      "acción",
      "pluralidad",
      "política"
    ]
  ],
  [
    "10.32870/prot.i21.316",
    [
      "Subjetivación",
      "género",
      "ideología",
      "tecnologías sociales"
    ]
  ],
  [
    "10.32870/prot.i21.278",
    [
      "Aborto",
      "moralidad",
      "conservadores",
      "liberales",
      "persona"
    ]
  ],
  [
    "10.32870/prot.i20.279",
    [
      "Filosofía para Niños y Jóvenes",
      "pensamiento crítico",
      "confinamiento",
      "pandemia",
      "comunidad de indagación"
    ]
  ],
  [
    "10.32870/prot.i20.290",
    [
      "Pragmatismo",
      "comunidad de indagación filosófica",
      "Filosofía para Niños",
      "asombro",
      "experiencia",
      "significado",
      "Lipman"
    ]
  ],
  [
    "10.32870/prot.i19.242",
    [
      "Verdad",
      "opinión",
      "Badiou",
      "doxa",
      "ética",
      "filosofía clásica"
    ]
  ],
  [
    "10.32870/prot.i19.256",
    [
      "San Agustín",
      "sabiduría",
      "academia",
      "Contra los académicos",
      "crítica filosófica",
      "filosofía medieval"
    ]
  ],
  [
    "10.32870/prot.i18.267",
    [
      "Habermas",
      "Kant",
      "ética discursiva",
      "humanidad",
      "intersubjetividad"
    ]
  ],
  [
    "10.32870/prot.i17.212",
    [
      "Muerte",
      "infinitud",
      "ser occidental",
      "Mismo y Otro",
      "ciencia y tecnología"
    ]
  ]
]);

const batch06 = new Map([
  [
    "10.32870/prot.i14.161",
    [
      "ética",
      "escritura",
      "literatura",
      "filosofía"
    ]
  ],
  [
    "10.32870/prot.i14.164",
    [
      "lectura filosófica",
      "método",
      "signos",
      "filosofía de la novela"
    ]
  ],
  [
    "10.32870/prot.i14.167",
    [
      "Fernando González",
      "Friedrich Nietzsche",
      "literatura",
      "estética"
    ]
  ],
  [
    "10.32870/prot.i14.174",
    [
      "estadio del espejo",
      "Yo-Tú",
      "encuentro",
      "dualismo",
      "introspección"
    ]
  ],
  [
    "10.32870/prot.i14.175",
    [
      "lenguaje",
      "nombre",
      "mito",
      "cosmogonía",
      "origen del lenguaje"
    ]
  ],
  [
    "10.32870/prot.i14.177",
    [
      "Esquemas",
      "nodos",
      "realidades",
      "sistema",
      "relaciones",
      "matemática"
    ]
  ],
  [
    "10.32870/prot.i21.318",
    [
      "Feminidad",
      "complicidad",
      "opresión",
      "formación",
      "internalización"
    ]
  ],
  [
    "10.32870/prot.i21.323",
    [
      "Feminismos",
      "filosofía",
      "crítica",
      "ontología",
      "cuerpo"
    ]
  ],
  [
    "10.32870/prot.i23.398",
    [
      "Tradición",
      "acción",
      "natalidad",
      "narración",
      "historia"
    ]
  ],
  [
    "10.32870/prot.i23.384",
    [
      "Kant",
      "Schopenhauer",
      "Übertragung",
      "teoría del conocimiento"
    ]
  ]
]);

const batch07 = new Map([
  [
    "10.32870/prot.i14.144",
    [
      "historia de la filosofía posmoderna",
      "filosofía de la historia",
      "hermenéutica analógica",
      "condición posmoderna",
      "construcción",
      "deconstrucción"
    ]
  ],
  [
    "10.32870/prot.i14.146",
    [
      "nihilismo",
      "décadence",
      "transparencia",
      "rendimiento",
      "positividad"
    ]
  ],
  [
    "10.32870/prot.i13.145",
    [
      "Epistemología",
      "psicología",
      "existencialismo",
      "metodología",
      "investigación"
    ]
  ],
  [
    "10.32870/prot.i13.148",
    [
      "Educación musical",
      "Fenomenología",
      "Herramientas técnicas de mediación",
      "Lebenswelt",
      "Schütz",
      "Vygotsky"
    ]
  ],
  [
    "10.32870/prot.i13.153",
    [
      "Humanidades",
      "construcción de una tesis",
      "investigación",
      "metodología"
    ]
  ],
  [
    "10.32870/prot.i13.154",
    [
      "Filosofía",
      "pregunta",
      "aprendizaje",
      "educación",
      "docente",
      "alumno"
    ]
  ],
  [
    "10.32870/prot.i9-10.127",
    [
      "Abuso",
      "Analogía",
      "Definición analítica",
      "Discurso científico",
      "Reconocimiento"
    ]
  ],
  [
    "10.32870/prot.i9-10.128",
    [
      "Foucault",
      "Deleuze",
      "Poder",
      "Infancia",
      "Saber pedagógico"
    ]
  ],
  [
    "10.32870/prot.i9-10.130",
    [
      "epistemología",
      "relatividad",
      "física",
      "espacio",
      "tiempo"
    ]
  ],
  [
    "10.32870/prot.i9-10.132",
    [
      "Kant",
      "espacio",
      "tiempo",
      "física newtoniana",
      "relatividad general",
      "“ontología de la experiencia”"
    ]
  ]
]);

const batch08 = new Map([
  [
    "10.32870/prot.i1.7",
    [
      "Paradigma",
      "Continuidad",
      "Discontinuidad",
      "Externalismo",
      "Internalismo",
      "Ciencia",
      "Alquimia",
      "Química"
    ]
  ],
  [
    "10.32870/prot.i4.50",
    [
      "Racionalismo",
      "substancias",
      "comunicación",
      "Descartes",
      "Spinoza",
      "modos",
      "atributos",
      "Leibniz",
      "armonía preestablecida",
      "Malebranche",
      "ocasionalismo",
      "Deus ex machina"
    ]
  ],
  [
    "10.32870/prot.i5.76",
    [
      "utopía",
      "homogeneidad",
      "distopía",
      "pluralismo"
    ]
  ],
  [
    "10.32870/prot.i5.77",
    [
      "Principio de actuación",
      "escuela de Frankfurt",
      "pensamiento crítico",
      "utopía"
    ]
  ],
  [
    "10.32870/prot.i6.92",
    [
      "Ciencia Cognitiva",
      "psicología cognitiva",
      "paradigma del procesamiento de información",
      "Inteligencia artificial",
      "PDP"
    ]
  ],
  [
    "10.32870/prot.i6.94",
    [
      "libre albedrío",
      "determinismo",
      "mente",
      "dualismo",
      "materialismo",
      "Mario Bunge",
      "Martin Mahner"
    ]
  ],
  [
    "10.32870/prot.i7-8.108",
    [
      "Siglo XVII",
      "anatomía",
      "cuerpo",
      "medicina",
      "fisiología",
      "filosofía natural"
    ]
  ],
  [
    "10.32870/prot.i7-8.109",
    [
      "Cyborg",
      "Biocapitalismo",
      "Ubjetos",
      "Hipersubsunción",
      "Feminismo",
      "Naturaleza Humana",
      "Naturaleza vs. Crianza",
      "Estudios Culturales"
    ]
  ],
  [
    "10.32870/prot.i7-8.111",
    [
      "Contrastación",
      "Poder heurístico",
      "Ciencia planetaria",
      "Sistema",
      "Atmósfera",
      "Equilibrio",
      "Gaia",
      "Teoría sintética"
    ]
  ],
  [
    "10.32870/prot.i9-10.129",
    [
      "Acción comunicativa",
      "Razón instrumental",
      "Modernidad",
      "Ilustración",
      "Racionalidad dramatúrgica",
      "Consenso"
    ]
  ]
]);

const batch09 = new Map([
  [
    "10.32870/prot.i2.23",
    [
      "Límites del lenguaje",
      "Tractatus Logico Philosophicus",
      "Wittgenstein",
      "Kant"
    ]
  ],
  [
    "10.32870/prot.i2.30",
    [
      "Vita beata",
      "vita activa",
      "bien",
      "libertad",
      "comunidad",
      "humanización",
      "acción",
      "discurso"
    ]
  ],
  [
    "10.32870/prot.i2.32",
    [
      "Voluntad",
      "libertad",
      "Kant",
      "síndrome de la mano ajena",
      "bueno",
      "malo"
    ]
  ],
  [
    "10.32870/prot.i4.49",
    [
      "contrato social",
      "libertad",
      "sujeción",
      "orden",
      "subjetividad negada",
      "neutralidad",
      "exclusión",
      "mujeres"
    ]
  ],
  [
    "10.32870/prot.i4.54",
    [
      "Kierkegaard",
      "Autoría",
      "Pseudonimia",
      "Comunicación",
      "Lecturas de Kierkegaard"
    ]
  ],
  [
    "10.32870/prot.i4.55",
    [
      "Kierkegaard",
      "Aristófanes",
      "sexualidad",
      "mito"
    ]
  ],
  [
    "10.32870/prot.i4.56",
    [
      "Delectatio",
      "fruición",
      "pasión",
      "cristianismo",
      "comunión",
      "entrega"
    ]
  ],
  [
    "10.32870/prot.i4.58",
    [
      "Mujer",
      "yo",
      "Absoluto",
      "hombre",
      "infinitud"
    ]
  ],
  [
    "10.32870/prot.i11-12.136",
    [
      "Iusfilosofía",
      "ontología y gnoseología constitucional",
      "centenario de la CPEUM",
      "análisis de cuestiones constitucionales"
    ]
  ],
  [
    "10.32870/prot.i11-12.139",
    [
      "Fenomenología",
      "hermenéutica",
      "encarnación",
      "comprensión",
      "sensibilidad"
    ]
  ]
]);

const batch10 = new Map([
  [
    "10.32870/prot.i24.413",
    [
      "Presuposición",
      "trasfondo",
      "argumento trascendental",
      "constructivismo social",
      "idealismo fenomenalista"
    ]
  ],
  [
    "10.32870/prot.i24.408",
    [
      "Neoliberalismo",
      "subjetividad",
      "interculturalidad"
    ]
  ],
  [
    "10.32870/prot.i24.353",
    [
      "Hermenéutica",
      "opinión",
      "confianza",
      "atestación"
    ]
  ],
  [
    "10.32870/prot.i24.375",
    [
      "Modernidad",
      "universalidad",
      "racionalidad",
      "autodeterminación",
      "autonomía",
      "emancipación civil"
    ]
  ],
  [
    "10.32870/prot.i15.201",
    [
      "Univocidad",
      "Bondad",
      "Libertad",
      "Vacuidad",
      "Nada"
    ]
  ],
  [
    "10.32870/prot.i15.170",
    [
      "monarquía",
      "universal",
      "política",
      "utopía"
    ]
  ],
  [
    "10.32870/prot.i15.185",
    [
      "praxis",
      "marxismo",
      "práctica",
      "teórica"
    ]
  ],
  [
    "10.32870/prot.i15.172",
    [
      "Marx",
      "marxismo",
      "teoría crítica",
      "sociología política",
      "espacio teórico",
      "Althusser",
      "materialismo",
      "acumulación originaria"
    ]
  ],
  [
    "10.32870/prot.i15.197",
    [
      "teoría del valor",
      "interpretación holista",
      "axioma",
      "ley de acumulación del capital"
    ]
  ],
  [
    "10.32870/prot.i15.173",
    [
      "Marxismo",
      "Postmodernidad",
      "historia",
      "Historia",
      "proceso",
      "progreso"
    ]
  ]
]);

const batch11 = new Map([
  [
    "10.32870/prot.i1.3",
    [
      "justicia",
      "juventud dorada",
      "persona",
      "placer",
      "poder",
      "política",
      "universidad",
      "valores"
    ]
  ],
  [
    "10.32870/prot.i1.4",
    [
      "pensar",
      "rumiar",
      "traspasar",
      "sustraerse"
    ]
  ],
  [
    "10.32870/prot.i1.5",
    [
      "autopoiesis",
      "libertad",
      "educación",
      "democracia"
    ]
  ],
  [
    "10.32870/prot.i1.6",
    [
      "Kant",
      "Martin Buber",
      "hombre",
      "antropología filosófica",
      "cosmos",
      "destino",
      "razón",
      "congéneres",
      "mundo",
      "existencia",
      "muerte"
    ]
  ],
  [
    "10.32870/prot.i1.10",
    [
      "mente",
      "inteligencia artificial",
      "Turing",
      "computación",
      "procesos",
      "cerebro"
    ]
  ],
  [
    "10.32870/prot.i1.11",
    [
      "inducción",
      "ley",
      "principio",
      "necesidad",
      "vínculo causal",
      "ciencia",
      "causalidad"
    ]
  ],
  [
    "10.32870/prot.i1.12",
    [
      "estado",
      "desmantelamiento",
      "Montemayor",
      "psicosocial",
      "política",
      "Martín-Baró",
      "narcotráfico"
    ]
  ],
  [
    "10.32870/prot.i3.38",
    [
      "comunidad biótica",
      "eco-feminismo",
      "matrilineal",
      "patriarcado",
      "crisis ecológica",
      "sobrepoblación"
    ]
  ],
  [
    "10.32870/prot.i3.35",
    [
      "Karl Popper",
      "inductivismo",
      "problema de la inducción",
      "corroboración",
      "falsación",
      "justificacionismo",
      "falibilismo"
    ]
  ],
  [
    "10.32870/prot.i3.41",
    [
      "conocimiento",
      "pensamiento",
      "inteligencia",
      "modelo",
      "claridad",
      "diseño"
    ]
  ]
]);

const batch12 = new Map([
  [
    "10.32870/prot.i16.190",
    [
      "explotación animal",
      "sintientes",
      "vulnerabilidad",
      "especismo",
      "consideración moral"
    ]
  ],
  [
    "10.32870/prot.i16.194",
    [
      "hermenéutica",
      "dialéctica",
      "entendimiento",
      "fenomenología",
      "logos"
    ]
  ],
  [
    "10.32870/prot.i16.220",
    [
      "real",
      "problemática",
      "filosofía",
      "ethos",
      "materialismo"
    ]
  ],
  [
    "10.32870/prot.i16.221",
    [
      "muerte",
      "violencia",
      "literatura y filosofía",
      "García Márquez",
      "Heidegger"
    ]
  ],
  [
    "10.32870/prot.i17.229",
    [
      "Axiomatización",
      "reducción",
      "revolución científica",
      "relaciones interteóricas"
    ]
  ],
  [
    "10.32870/prot.i17.243",
    [
      "Pensamiento crítico",
      "pensamiento concreto",
      "política",
      "poder"
    ]
  ],
  [
    "10.32870/prot.i18.261",
    [
      "filosofía",
      "vida",
      "problema",
      "replanteamiento"
    ]
  ],
  [
    "10.32870/prot.i18.263",
    [
      "Tolerancia",
      "mal",
      "deísmo",
      "providencia",
      "libertad",
      "bien",
      "optimismo",
      "desdicha"
    ]
  ],
  [
    "10.32870/prot.i18.265",
    [
      "Novela filosófica",
      "proyecto de la Ilustración",
      "ironía"
    ]
  ],
  [
    "10.32870/prot.i19.275",
    [
      "Inferencia",
      "deducción",
      "inducción",
      "abducción",
      "pragmatismo",
      "realismo",
      "investigación"
    ]
  ]
]);

const batch13 = new Map([
  [
    "10.32870/prot.i4.37",
    [
      "Love",
      "suffering",
      "human nature",
      "Eros",
      "despair",
      "sacrifice",
      "resurrection"
    ]
  ],
  [
    "10.32870/prot.i4.53",
    [
      "amor",
      "sufrimiento",
      "naturaleza humana",
      "Eros",
      "desesperación",
      "sacrificio",
      "resurrección"
    ]
  ],
  [
    "10.32870/prot.i5.74",
    [
      "Kierkergaad",
      "God",
      "religious",
      "human being",
      "christianity",
      "existentialism"
    ]
  ],
  [
    "10.32870/prot.i5.75",
    [
      "Kierkergaard",
      "Dios",
      "religión",
      "ser humano",
      "cristianismo",
      "existencialismo"
    ]
  ],
  [
    "10.32870/prot.i5.80",
    [
      "literatura",
      "filosofía",
      "responsabilidad",
      "suerte moral",
      "arrepentimiento"
    ]
  ],
  [
    "10.32870/prot.i6.90",
    [
      "Romanticismo",
      "Sturm und Drang",
      "Idealismo Trascendental",
      "cosa en sí",
      "Neokantismo",
      "Schopenhauer"
    ]
  ],
  [
    "10.32870/prot.i20.274",
    [
      "Filosofía",
      "fantasía",
      "infancia",
      "creatividad",
      "diálogo",
      "pensamiento crítico"
    ]
  ],
  [
    "10.32870/prot.i21.322",
    [
      "Educación",
      "guerra",
      "réplica",
      "vivencia"
    ]
  ],
  [
    "10.32870/prot.i21.313",
    [
      "Patriarcado",
      "historia androcéntrica",
      "narración dominante",
      "olas del feminismo",
      "injusticia epistémica"
    ]
  ],
  [
    "10.32870/prot.i19.258",
    [
      "Crítica del juicio",
      "signo",
      "Kant",
      "semiótica"
    ]
  ]
]);

const batch14Partial = new Map([
  [
    "10.32870/prot.i23.333",
    [
      "Videojuegos",
      "colonialidad",
      "poder",
      "lengua",
      "cultura"
    ]
  ],
  [
    "10.32870/prot.i23.399",
    [
      "Arendt",
      "violencia",
      "necroemprendimientos",
      "subjetividad",
      "cadáver",
      "neoliberalismo"
    ]
  ],
  [
    "10.32870/prot.i23.389",
    [
      "Política",
      "ontología",
      "sociedad de masas",
      "cotidianidad",
      "habladuría",
      "aislamiento"
    ]
  ],
  [
    "10.32870/prot.i26.431",
    [
      "Intuición",
      "duración",
      "libertad",
      "multiplicidad",
      "vitalismo"
    ]
  ],
  [
    "10.32870/prot.i27.460",
    [
      "Arte",
      "Fisk",
      "fotorrealismo",
      "museo",
      "vintage"
    ]
  ]
]);

const batch15 = new Map([
  [
    "10.32870/prot.i26.444",
    [
      "Razón instrumental",
      "Antropoceno",
      "tecnoceno",
      "crisis ecológica",
      "progreso",
      "Prometeo"
    ]
  ],
  [
    "10.32870/prot.i22.341",
    [
      "Estado",
      "racionalidad",
      "cultura",
      "ideología",
      "violencia física legítima"
    ]
  ],
  [
    "10.32870/prot.i20.307",
    [
      "Praxis",
      "contexto",
      "recontextualización",
      "significado",
      "actividad"
    ]
  ],
  [
    "10.32870/prot.i21.311",
    [
      "Masculinidad",
      "subjetivación",
      "sexaje",
      "falocracia",
      "violencia"
    ]
  ],
  [
    "10.32870/prot.i21.324",
    [
      "Escucha",
      "fenomenología",
      "objeto cultural",
      "sonoridad"
    ]
  ],
  [
    "10.32870/prot.i20.280",
    [
      "Antropología filosófica",
      "persona",
      "desarrollo",
      "corazón",
      "ser",
      "semiótica"
    ]
  ],
  [
    "10.32870/prot.i19.281",
    [
      "Teleología",
      "determinismo",
      "libertad social y política"
    ]
  ],
  [
    "10.32870/prot.i20.289",
    [
      "Comunidad de investigación",
      "lógica",
      "argumentación",
      "pensamiento multidimensional"
    ]
  ],
  [
    "10.32870/prot.i20.332",
    [
      "Pregunta",
      "preguntar",
      "filosofía",
      "práctica filosófica",
      "filosofía con niños",
      "filosofía para niños",
      "tríada del buen preguntador"
    ]
  ],
  [
    "10.32870/prot.i20.286",
    [
      "Diferencia",
      "duración",
      "memoria",
      "tiempo",
      "repetición"
    ]
  ]
]);

test("capa curada de Protrepsis conserva el lote 01 verificado DOI por DOI", () => {
  assert.equal(overlay.schemaVersion, 1);
  assert.equal(overlay.journal, "Protrepsis");
  assert.match(overlay.policy, /No se infieren/i);

  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 147);

  const seen = new Set();
  for (const record of records) {
    assert.match(record.doi, /^10\.32870\/prot\./);
    assert.ok(Array.isArray(record.keywords) && record.keywords.length > 0);
    assert.match(record.evidence, /^https?:\/\//);
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(seen.has(record.doi), false, "DOI duplicado: " + record.doi);
    seen.add(record.doi);
  }

  for (const [doi, expectedKeywords] of batch01) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 01: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
  }
});

test("capa curada de Protrepsis conserva el lote 02 verificado DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch02.size, 10);
  for (const [doi, expectedKeywords] of batch02) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 02: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 03 verificado DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch03.size, 10);
  for (const [doi, expectedKeywords] of batch03) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 03: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("el artículo de marketing usa exactamente las palabras clave publicadas", () => {
  const record = overlay.records.find(
    item => item.doi === "10.32870/prot.i29.477"
  );
  assert.deepEqual(record.keywords, [
    "Redes sociales",
    "transparencia",
    "desinformación",
    "Nayib Bukele",
    "influencia digital",
    "ciudadanía informada"
  ]);
  for (const invented of ["Poder","Política","Ontología","Tecnología"]) {
    assert.equal(record.keywords.includes(invented), false);
  }
});

test("capa curada de Protrepsis conserva el lote 04 (número 22) DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch04.size, 10);
  assert.ok(records.length >= 147);
  for (const [doi, expectedKeywords] of batch04) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 04: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 05 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch05.size, 10);
  assert.ok(records.length >= 147);
  for (const [doi, expectedKeywords] of batch05) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 05: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 06 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch06.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch06) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 06: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 07 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch07.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch07) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 07: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 08 histórico DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch08.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch08) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 08: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 09 DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch09.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch09) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 09: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.ok(record.evidence.startsWith("https://"));
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva el lote 10 DOI por DOI y su evidencia", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch10.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch10) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 10: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
  // El artículo i15.173 distingue deliberadamente historia de Historia.
  assert.deepEqual(
    records.find(item => item.doi === "10.32870/prot.i15.173").keywords.slice(2,4),
    ["historia", "Historia"]
  );
});

test("la UI de Protrepsis conserva palabras clave que difieren sólo en mayúsculas", async () => {
  const source = await readFile("js/journal-page.js", "utf8");
  const page = await readFile("revistas/udg/protrepsis.html", "utf8");
  assert.match(source, /function uniqueStrings\(values, preserveCase = false\)/);
  assert.match(source, /const key = preserveCase \? clean : clean\.toLocaleLowerCase\("es"\)/);
  assert.match(source, /uniqueStrings\(entry\.keywords \|\| \[\], true\)/);
  assert.match(source, /uniqueStrings\(record\?\.editorialKeywords \|\| \[\], true\)/);
  assert.match(page, /journal-page\.js\?v=20261114-editorial-keywords-v4-queue/);
  const original = overlay.records.find(record => record.doi === "10.32870/prot.i15.173");
  assert.deepEqual(original.keywords.slice(2,4), ["historia", "Historia"]);
});

test("capa curada de Protrepsis conserva el lote 11: número 1 y 3, DOI por DOI", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch11.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, keywords] of batch11) {
    const record = records.find(entry => entry.doi === doi);
    assert.ok(record, "Falta DOI del lote 11: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.ok(record.evidence.startsWith("https://es.scribd.com/document/"));
    assert.equal(record.verifiedAt, "2026-11-14");
  }
  assert.deepEqual(
    records.find(x => x.doi === "10.32870/prot.i1.10").keywords,
    ["mente","inteligencia artificial","Turing","computación","procesos","cerebro"]
  );
});

test("capa curada de Protrepsis conserva lote 12: números 16 a 19", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch12.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, keywords] of batch12) {
    const record = records.find(entry => entry.doi === doi);
    assert.ok(record, "Falta DOI del lote 12: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("capa curada de Protrepsis conserva lote 13 DOI por DOI y sin palabras clave inferidas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch13.size, 10);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, keywords] of batch13) {
    const record = records.find(entry => entry.doi === doi);
    assert.ok(record, "Falta DOI del lote 13: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
  assert.deepEqual(
    records.find(record => record.doi === "10.32870/prot.i5.74").keywords,
    ["Kierkergaad","God","religious","human being","christianity","existentialism"]
  );
  assert.deepEqual(
    records.find(record => record.doi === "10.32870/prot.i5.75").keywords,
    ["Kierkergaard","Dios","religión","ser humano","cristianismo","existencialismo"]
  );
});

test("Protrepsis lote 14 parcial: cinco DOI con palabras clave documentadas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch14Partial.size, 5);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(entry => entry.doi)).size, records.length);
  for (const [doi, expectedKeywords] of batch14Partial) {
    const record = records.find(entry => entry.doi === doi);
    assert.ok(record, "Falta DOI del lote 14 parcial: " + doi);
    assert.deepEqual(record.keywords, expectedKeywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});

test("Protrepsis lote 15: diez palabras clave editoriales documentadas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(batch15.size, 10);
  assert.equal(batch14Partial.size, 5);
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  for (const [doi, keywords] of batch15) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del lote 15: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
  // Se copian las palabras clave impresas en el artículo, no las
  // palabras clave alternativas del repositorio institucional.
  const construction = records.find(item => item.doi === "10.32870/prot.i21.311");
  assert.deepEqual(construction.keywords,
    ["Masculinidad", "subjetivación", "sexaje", "falocracia", "violencia"]);
  assert.ok(!construction.keywords.includes("falopoder"));
});

test("lote 16 parcial: i23.395 conserva las cinco Palabras clave españolas impresas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  const original = records.find(record => record.doi === "10.32870/prot.i23.395");
  assert.ok(original, "Falta DOI 10.32870/prot.i23.395");
  assert.deepEqual(original.keywords,
    ["Hannah Arendt", "relato", "empatía", "testigo", "sentido común"]);
  assert.equal(original.verifiedAt, "2026-11-14");
  assert.match(original.evidence, /^https:\/\/www\.researchgate\.net\/publication\/365792032_/);
});

test("lote 16 parcial: i3.39 conserva las cinco palabras clave editoriales impresas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 147);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);
  const record = records.find(item => item.doi === "10.32870/prot.i3.39");
  assert.ok(record, "Falta DOI i3.39");
  assert.deepEqual(record.keywords, [
    "Trasplante renal", "justicia distributiva", "asignación de órganos",
    "inmunosupresión", "selección de donador y receptor"
  ]);
  assert.match(record.evidence, /^https:\/\/es\.scribd\.com\/document\/144936061\//);
  assert.equal(record.verifiedAt, "2026-11-14");
});


test("lote 16 parcial: i11-12.137 e i13.152 conservan palabras clave editoriales verificadas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.ok(records.length >= 149);
  assert.equal(new Set(records.map(record => record.doi)).size, records.length);

  const constitution = records.find(record => record.doi === "10.32870/prot.i11-12.137");
  assert.ok(constitution, "Falta DOI i11-12.137");
  assert.deepEqual(constitution.keywords, [
    "Iusphilosophy",
    "ontology and gnoseology constitutional",
    "centenary of the CPEUM",
    "analysis of constitutional issues"
  ]);
  assert.match(constitution.evidence, /^https:\/\/www\.academia\.edu\/79610401\//);
  assert.equal(constitution.verifiedAt, "2026-11-14");

  const method = records.find(record => record.doi === "10.32870/prot.i13.152");
  assert.ok(method, "Falta DOI i13.152");
  assert.deepEqual(method.keywords, ["Filosofía", "método", "formación"]);
  assert.match(method.evidence, /^https:\/\/www\.researchgate\.net\/publication\/352780765_/);
  assert.equal(method.verifiedAt, "2026-11-14");
});


test("lote 16 completo: seis DOI finales conservan palabras clave editoriales verificadas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  assert.equal(records.length, 172);
  assert.equal(new Set(records.map(record => record.doi)).size, 172);

  const expected = new Map([
    ["10.32870/prot.i21.321", ["Jürgen Habermas", "movimientos feministas", "teoría de la esfera pública", "Jean Cohen y Andrew Arato"]],
    ["10.32870/prot.i22.350", ["Plotino", "Eros", "metafísica", "naturaleza", "asombro"]],
    ["10.32870/prot.i23.385", ["Hannah Arendt", "feminismo", "esfera social", "labor", "mujer"]],
    ["10.32870/prot.i23.392", ["Apátrida", "pariah", "activismo", "condición judía", "refugiados", "ciudadanía"]],
    ["10.32870/prot.i23.405", ["Arendt", "shlemihl", "Rahel Varnhagen", "refugiados", "paria"]],
    ["10.32870/prot.i21.325", ["Unidad de la ciencia", "pluralismo", "Rickert", "zonas intermedias"]]
  ]);

  for (const [doi, keywords] of expected) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI final del lote 16: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});


test("lote 17: Ruletistul conserva las cuatro palabras clave impresas del PDF", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const record = records.find(item => item.doi === "10.32870/prot.i15.200");
  assert.ok(record, "Falta el DOI i15.200 de Jesús Ruiz Pozo");
  assert.deepEqual(record.keywords, ["Cărtărescu", "filosofía", "Deleuze", "literatura"]);
  assert.equal(record.evidence,
    "https://www.researchgate.net/publication/352724640_Ruletistul_Un_ejercicio_empirico_ensayo");
  assert.equal(record.verifiedAt, "2026-11-14");
});

test("lote 17: i27.435 conserva las cuatro palabras clave editoriales impresas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const record = records.find(item => item.doi === "10.32870/prot.i27.435");
  assert.ok(record, "Falta el DOI i27.435 de Brooks Asencio y Zuniga Mejía");
  assert.deepEqual(record.keywords, [
    "Universidad Central",
    "positivismo",
    "pedagogía emancipatoria",
    "filosofía intercultural"
  ]);
  assert.equal(record.evidence,
    "https://www.academia.edu/170293736/Ram%C3%B3n_Rosa_Freire_y_Fornet_Betancourt_discurso_de_la_Universidad_Central_de_Honduras_entre_la_pedagog%C3%ADa_emancipatoria_y_la_filosof%C3%ADa_intercultural");
  assert.equal(record.verifiedAt, "2026-11-14");
});


test("lote 17: i21.314 conserva las palabras clave impresas del facsímil de Protrepsis", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const record = records.find(item => item.doi === "10.32870/prot.i21.314");
  assert.ok(record, "Falta el DOI i21.314 de Laura Alicia Soto Rangel");
  assert.deepEqual(record.keywords, [
    "Feminismo",
    "Graciela Hierro",
    "novohispanas",
    "Sor Juana Inés de la Cruz"
  ]);
  assert.equal(record.evidence,
    "https://www.academia.edu/144649960/El_feminismo_como_una_%C3%A9tica_para_s%C3%AD_Aplicaci%C3%B3n_del_m%C3%A9todo_feminista_de_Graciela_Hierro_en_la_resignificaci%C3%B3n_de_las_mujeres_en_la_Nueva_Espa%C3%B1a");
  assert.equal(record.verifiedAt, "2026-11-14");
});


test("lote 17: i22.366 conserva las palabras clave impresas del facsímil de Protrepsis", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const record = records.find(item => item.doi === "10.32870/prot.i22.366");
  assert.ok(record, "Falta el DOI i22.366 de Juan Manuel García Garduño");
  assert.deepEqual(record.keywords, ["Amar", "querer", "bipolaridad", "etimologías"]);
  assert.equal(record.evidence,
    "https://www.academia.edu/121753198/Estudio_introductorio_a_las_bipolaridades_del_amor_en_el_pensamiento_occidental_premoderno_y_moderno");
  assert.equal(record.verifiedAt, "2026-11-14");
});


test("lote 17: i18.262 e i20.276 conservan palabras clave impresas", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const cases = [
    ["10.32870/prot.i18.262", ["Cristianismo", "Ilustración", "tolerancia"]],
    ["10.32870/prot.i20.276", ["Enseñanza", "pedagogía", "alfabetización", "escuela"]]
  ];
  for (const [doi, keywords] of cases) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI verificado: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});


test("número 28 completo: diez artículos conservan palabras clave editoriales literales", () => {
  const records = Array.isArray(overlay.records) ? overlay.records : [];
  const expected = new Map([
    ["10.32870/prot.i28.490", ["Moral","arqueología","genealogía","el intelectual","ciencias sociales"]],
    ["10.32870/prot.i28.484", ["Capitalismo neoliberal","sujeto automático","vigilancia algorítmica","control y normalización","arte y resistencia","cuidado de sí"]],
    ["10.32870/prot.i28.480", ["Tecnologías","genealogía","gubernamentalidad","seguridad","resistencia","desproletarización"]],
    ["10.32870/prot.i28.486", ["Deseo","confesión","dispositivo","sujeto","manuscrito"]],
    ["10.32870/prot.i28.481", ["Iusnaturalismo","sujeto","cuerpo","biopolítica","estética de la existencia"]],
    ["10.32870/prot.i28.487", ["Sujeto","existencia","ser","subjetividad","moral capitalista"]],
    ["10.32870/prot.i28.491", ["Foucault","Deleuze","Esposito","subjetividad","biopolítica"]],
    ["10.32870/prot.i28.485", ["Archivo","historia","genealogía","arte","prácticas","sentido","discontinuidades"]],
    ["10.32870/prot.i28.489", ["Foucault","cinismo","resistencia","arte"]],
    ["10.32870/prot.i28.483", ["Movimientos sociales","pacientes","derecho a la salud","ética"]]
  ]);
  assert.equal(records.length, 172);
  assert.equal(new Set(records.map(record => record.doi)).size, 172);
  for (const [doi, keywords] of expected) {
    const record = records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del número 28: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.match(record.evidence, /^https?:\/\//);
    assert.equal(record.verifiedAt, "2026-11-14");
  }
});


test("número 29 completo: diez artículos conservan palabras clave editoriales literales", () => {
  const issueUrl = "http://protrepsis.cucsh.udg.mx/index.php/prot/issue/view/27/N%C3%BAmero29";
  const expected = new Map([["10.32870/prot.i29.499",["Movimiento","continuidad","medición","numeración","alma"]],["10.32870/prot.i29.509",["Heidegger","tiempo","historia","hermenéutica","medida"]],["10.32870/prot.i29.501",["Plotino","Bergson","Metafísica","Semiótica","Duración"]],["10.32870/prot.i29.477",["Redes sociales","transparencia","desinformación","Nayib Bukele","influencia digital","ciudadanía informada"]],["10.32870/prot.i29.497",["Levinas","exclusión","violencia","género","ontología"]],["10.32870/prot.i29.496",["Hermenéutica","univocismo","equivocismo","analogía","cientificismo","posmodernidad"]],["10.32870/prot.i29.504",["Negatividad","no-identidad","crítica inmanente","constelaciones"]],["10.32870/prot.i29.488",["Tiempo lineal","tiempo del oprimido","trauma","resistencia","memoria","anacronismo"]],["10.32870/prot.i29.503",["Animalidad","muerte","tiempo","poesía"]],["10.32870/prot.i29.494",["Duelo","violencia","nosotros","vulnerabilidad","proximidad","comunidad"]]]);
  for (const [doi, keywords] of expected) {
    const record = overlay.records.find(item => item.doi === doi);
    assert.ok(record, "Falta DOI del número 29: " + doi);
    assert.deepEqual(record.keywords, keywords);
    assert.equal(record.evidence, issueUrl);
  }
  assert.equal(overlay.records.length, 172);
  assert.equal(new Set(overlay.records.map(record => record.doi)).size, 172);
});


test("i27.452 conserva las palabras clave literales del PDF oficial", () => {
  const record = overlay.records.find(item => item.doi === "10.32870/prot.i27.452");
  assert.ok(record);
  assert.deepEqual(record.keywords, ["Crítica","metafísica","teología"]);
  assert.equal(record.evidence, "http://protrepsis.cucsh.udg.mx/index.php/prot/article/view/452/640");
  assert.equal(overlay.records.length, 172);
});


test("i27.461 conserva las palabras clave literales de la página oficial", () => {
  const record = overlay.records.find(item => item.doi === "10.32870/prot.i27.461");
  assert.ok(record);
  assert.deepEqual(record.keywords, ["Modernidad","naturaleza","Estado","Ilustración","psicoanálisis"]);
  assert.equal(record.evidence, "http://protrepsis.cucsh.udg.mx/index.php/prot/article/view/461");
  assert.equal(overlay.records.length, 172);
});
