export const UDEG_LOGIN_URL =
  "https://wdg.biblio.udg.mx/index.php/paginaacceso";


export const institutionalSources = [
  {
    id: "udeg-summon",
    name: "wdg.búsqueda · UdeG",
    mode: "institutional",
    enabled: true,

    searchUrl:
      "https://bibliotecaudg-summon-serialssolutions-com.wdg.biblio.udg.mx:8443/#!/search?ho=t&l=es-ES&q={query}",

    queryMode:
      "title-author"
  },

  {
    id: "britannica-udeg",
    name: "Britannica UdeG",
    mode: "institutional",
    enabled: false,
    searchUrl: null
  },

  {
    id: "aula",
    name: "Aula",
    mode: "institutional",
    enabled: false,
    searchUrl: null
  },

  {
    id: "ebook-central",
    name: "Ebook Central",
    mode: "institutional",
    enabled: true,
    searchUrl:
      "https://ebookcentral-proquest-com.wdg.biblio.udg.mx:8443/ebc/lib/wdgbiblio/#/search?query={query}",
    queryMode: "title-author"
  },

  {
    id: "udeg-catalog",
    name: "Catálogo UdeG",
    mode: "institutional",
    enabled: false,
    searchUrl: null
  }
];
