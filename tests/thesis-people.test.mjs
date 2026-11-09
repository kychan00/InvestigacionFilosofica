import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThesisPeopleIndex,
  cleanThesisPersonName,
  splitThesisPeople,
  thesisPersonArchiveBiography,
  thesisPersonKey,
  thesisPersonProfile,
} from "../src/core/thesis-people.js";

test("separa dos o más directores sólo en fronteras tituladas seguras", () => {
  assert.deepEqual(
    splitThesisPeople("DR ALBERTO CUAUTHÉMOC MAYORGA MADRIGAL Y DR JOSÉ MARÍA NAVA PRECIADO"),
    [
      "ALBERTO CUAUTHÉMOC MAYORGA MADRIGAL",
      "JOSÉ MARÍA NAVA PRECIADO",
    ],
  );

  assert.deepEqual(
    splitThesisPeople("DRA ANA PÉREZ Y DR LUIS GÓMEZ Y MTRA ELENA RUIZ"),
    ["ANA PÉREZ", "LUIS GÓMEZ", "ELENA RUIZ"],
  );
});

test("no parte nombres por una y ordinaria ni por comas de catálogo", () => {
  assert.deepEqual(
    splitThesisPeople("María del Carmen y de la Torre"),
    ["María del Carmen y de la Torre"],
  );
  assert.deepEqual(
    splitThesisPeople("Pérez Armendáriz, Adriana"),
    ["Pérez Armendáriz, Adriana"],
  );
});

test("limpia tratamientos y deduplica variantes acentuadas o tituladas", () => {
  assert.equal(cleanThesisPersonName("DRA. Nalliely Hernández Cornejo"), "Nalliely Hernández Cornejo");
  assert.equal(
    thesisPersonKey("DR. José María Nava Preciado"),
    thesisPersonKey("Jose Maria Nava Preciado"),
  );
  assert.deepEqual(
    splitThesisPeople(["DR José María Nava Preciado", "JOSE MARIA NAVA PRECIADO"]),
    ["José María Nava Preciado"],
  );
});

test("agrupa autoría y dirección sin duplicar la misma tesis entre vistas", () => {
  const thesis = {
    id: "philosophy:reference:abc",
    canonicalWorkId: "thesis:work:0001",
    title: "La definición de la muerte encefálica",
    authors: ["DALILA AYALA CASTILLO"],
    directors: ["DR ALBERTO CUAUTHÉMOC MAYORGA MADRIGAL Y DR JOSÉ MARÍA NAVA PRECIADO"],
    year: 2015,
    program: "Licenciatura en Filosofía",
    degree: "licenciatura",
    unit: "CUCSH",
    sourceUrl: "https://www.biblioteca.cucsh.udg.mx/?q=content/example",
  };

  const index = buildThesisPeopleIndex([
    {
      records: [thesis],
      institution: "Universidad de Guadalajara",
      institutionAcronym: "UdeG",
      scope: "humanities",
    },
    {
      records: [{ ...thesis, philosophyRole: "program-core" }],
      institution: "Universidad de Guadalajara",
      institutionAcronym: "UdeG",
      scope: "philosophy",
    },
  ]);

  const dalila = thesisPersonProfile(index, "Dalila Ayala Castillo");
  const mayorga = thesisPersonProfile(index, "Alberto Cuauhtémoc Mayorga Madrigal");
  const nava = thesisPersonProfile(index, "José María Nava Preciado");

  assert.equal(dalila.authored.length, 1);
  assert.equal(dalila.directed.length, 0);
  assert.equal(mayorga.directed.length, 1);
  assert.equal(nava.directed.length, 1);
  assert.equal(mayorga.directed[0].authors[0], "DALILA AYALA CASTILLO");
});

test("la semblanza del archivo declara sus límites y las relaciones documentadas", () => {
  const index = buildThesisPeopleIndex([
    {
      institution: "Universidad de Guadalajara",
      institutionAcronym: "UdeG",
      records: [
        {
          id: "1",
          title: "Tesis A",
          authors: ["Autora Uno"],
          directors: ["DR Director Ejemplo"],
          year: 2015,
          program: "Licenciatura en Filosofía",
        },
        {
          id: "2",
          title: "Tesis B",
          authors: ["Autora Dos"],
          directors: ["Director Ejemplo"],
          year: 2020,
          program: "Maestría en Estudios Filosóficos",
        },
      ],
    },
  ]);

  const profile = thesisPersonProfile(index, "Director Ejemplo");
  const biography = thesisPersonArchiveBiography(profile);

  assert.equal(profile.directed.length, 2);
  assert.equal(profile.yearFrom, 2015);
  assert.equal(profile.yearTo, 2020);
  assert.match(biography, /2 tesis en cuya dirección participó/);
  assert.match(biography, /2015 y 2020/);
  assert.match(biography, /no pretende sustituir una biografía personal verificada/);
});
