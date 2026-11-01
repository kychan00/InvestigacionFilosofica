const progress = document.querySelector("#progress");
const counter = document.querySelector("#counter");
const status = document.querySelector("#status");
const judgePanel = document.querySelector("#judgePanel");
const donePanel = document.querySelector("#donePanel");
const auditId = document.querySelector("#auditId");
const position = document.querySelector("#position");
const note = document.querySelector("#note");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const nextUnjudged = document.querySelector("#nextUnjudged");
const finalize = document.querySelector("#finalize");
const finalStatus = document.querySelector("#finalStatus");
const leftProfile = document.querySelector("#leftProfile");
const rightProfile = document.querySelector("#rightProfile");
const labelButtons = [
  ...document.querySelectorAll(".label-button")
];

let rows = [];
let judgments = {};
let index = 0;
let saving = false;
let noteTimer = null;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.error || "HTTP " + response.status
    );
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentRow() {
  return rows[index] || null;
}

function currentJudgment() {
  const row = currentRow();
  return row ? judgments[row.audit_id] || null : null;
}

function judgedCount() {
  return rows.filter(row =>
    ["same-person", "different-person", "unresolved"]
      .includes(judgments[row.audit_id]?.judgment)
  ).length;
}

function yearLabel(profile) {
  const min = profile?.activeYears?.min;
  const max = profile?.activeYears?.max;
  if (min == null && max == null) return "Sin fecha";
  if (min === max) return String(min);
  return [min ?? "?", max ?? "?"].join("–");
}

function workHtml(work) {
  const meta = [
    work.year,
    work.type,
    work.language,
    work.authorPosition
  ].filter(Boolean).join(" · ");

  const coauthors = (work.coauthors || [])
    .map(item => item.name || ("A" + item.authorId))
    .filter(Boolean);

  return `
    <li class="work">
      <div class="work-title">${escapeHtml(
        work.title || "(sin título)"
      )}</div>
      <div class="work-meta">${escapeHtml(meta || "Sin metadatos")}</div>
      <div class="coauthors">
        ${coauthors.length
          ? "Coautores: " + escapeHtml(coauthors.join(", "))
          : "Sin coautores visibles en esta obra."}
      </div>
    </li>
  `;
}

function profileHtml(side, evidence) {
  const profile = evidence || {};
  const names = profile.observedNames?.length
    ? profile.observedNames.join(" · ")
    : side.name || "(sin nombre)";
  const orcids = profile.orcids || [];
  const works = profile.works || [];

  const links = [
    profile.openAlexUrl
      ? `<a class="pill" href="${escapeHtml(
          profile.openAlexUrl
        )}" target="_blank" rel="noreferrer">OpenAlex</a>`
      : "",
    ...orcids.map(orcid =>
      `<a class="pill" href="https://orcid.org/${escapeHtml(
        orcid
      )}" target="_blank" rel="noreferrer">ORCID ${escapeHtml(
        orcid
      )}</a>`
    )
  ].join("");

  return `
    <header class="profile-head">
      <div class="small muted">OpenAlex A${escapeHtml(
        side.authorId
      )}</div>
      <h2>${escapeHtml(side.name || "(sin nombre)")}</h2>
      <div class="small muted">${escapeHtml(names)}</div>
      <div class="profile-links">${links}</div>
    </header>
    <div class="facts">
      <div class="fact">
        <span class="small muted">Periodo observado</span>
        <span class="fact-value">${escapeHtml(
          yearLabel(profile)
        )}</span>
      </div>
      <div class="fact">
        <span class="small muted">Obras observadas</span>
        <span class="fact-value">${escapeHtml(
          profile.workCountObserved ?? 0
        )}</span>
      </div>
      <div class="fact">
        <span class="small muted">ORCID observados</span>
        <span class="fact-value">${escapeHtml(
          orcids.length || 0
        )}</span>
      </div>
    </div>
    ${works.length
      ? `<ol class="works">${works.map(workHtml).join("")}</ol>`
      : `<div class="empty">No hay obras visibles en la ventana de evidencia.</div>`}
  `;
}

function renderProgress() {
  const judged = judgedCount();
  progress.value = judged;
  progress.max = rows.length || 100;
  counter.textContent =
    judged + "/" + (rows.length || 100) + " juzgados";
  donePanel.style.display =
    judged === rows.length && rows.length
      ? "block"
      : "none";
}

function render() {
  const row = currentRow();
  if (!row) return;

  const judgment = currentJudgment();
  judgePanel.hidden = false;

  auditId.textContent = row.audit_id;
  position.textContent =
    String(index + 1) + " de " + rows.length;

  leftProfile.innerHTML = profileHtml(
    row.left,
    row.evidence?.left
  );
  rightProfile.innerHTML = profileHtml(
    row.right,
    row.evidence?.right
  );

  note.value = judgment?.note || "";

  for (const button of labelButtons) {
    const selected =
      button.dataset.label === judgment?.judgment;
    button.classList.toggle("selected", selected);
    button.setAttribute(
      "aria-pressed",
      selected ? "true" : "false"
    );
  }

  previous.disabled = index === 0;
  next.disabled = index === rows.length - 1;
  status.textContent = judgment?.judgment
    ? "Guardado: " + judgment.judgment
    : "Sin juzgar.";

  renderProgress();
  window.scrollTo({top: 0, behavior: "instant"});
}

async function saveCurrent(
  judgment = undefined,
  {advance = false} = {}
) {
  const row = currentRow();
  if (!row || saving) return;

  const previousValue = judgments[row.audit_id] || {
    judgment: null,
    note: ""
  };
  const nextJudgment =
    judgment === undefined
      ? previousValue.judgment
      : judgment;

  saving = true;
  status.textContent = "Guardando…";

  try {
    await requestJson("/__authority-audit/save", {
      method: "POST",
      body: JSON.stringify({
        audit_id: row.audit_id,
        judgment: nextJudgment,
        note: note.value
      })
    });

    judgments[row.audit_id] = {
      judgment: nextJudgment,
      note: note.value
    };

    if (advance) {
      const target = findNextUnjudged(index + 1);
      if (target !== null) {
        index = target;
      } else if (index < rows.length - 1) {
        index++;
      }
    }

    render();
  } catch (error) {
    status.textContent =
      "Error al guardar: " + error.message;
  } finally {
    saving = false;
  }
}

function findNextUnjudged(start = 0) {
  for (let offset = 0; offset < rows.length; offset++) {
    const candidate = (start + offset) % rows.length;
    const value = judgments[rows[candidate].audit_id]?.judgment;
    if (
      !["same-person", "different-person", "unresolved"]
        .includes(value)
    ) {
      return candidate;
    }
  }
  return null;
}

for (const button of labelButtons) {
  button.addEventListener("click", () => {
    saveCurrent(button.dataset.label, {advance: true});
  });
}

previous.addEventListener("click", () => {
  if (index > 0) {
    index--;
    render();
  }
});

next.addEventListener("click", () => {
  if (index < rows.length - 1) {
    index++;
    render();
  }
});

nextUnjudged.addEventListener("click", () => {
  const target = findNextUnjudged(index + 1);
  if (target === null) {
    status.textContent =
      "Ya no quedan pares sin juzgar.";
    return;
  }
  index = target;
  render();
});

note.addEventListener("input", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    saveCurrent(undefined, {advance: false});
  }, 650);
});

note.addEventListener("blur", () => {
  clearTimeout(noteTimer);
  saveCurrent(undefined, {advance: false});
});

window.addEventListener("keydown", event => {
  if (document.activeElement === note) return;

  const shortcuts = {
    s: "same-person",
    d: "different-person",
    u: "unresolved"
  };

  const label = shortcuts[event.key.toLowerCase()];
  if (label) {
    event.preventDefault();
    saveCurrent(label, {advance: true});
    return;
  }

  if (event.key === "ArrowLeft" && index > 0) {
    event.preventDefault();
    index--;
    render();
  }

  if (
    event.key === "ArrowRight" &&
    index < rows.length - 1
  ) {
    event.preventDefault();
    index++;
    render();
  }
});

finalize.addEventListener("click", async () => {
  finalize.disabled = true;
  finalStatus.textContent = "Finalizando…";

  try {
    const result = await requestJson(
      "/__authority-audit/finalize",
      {
        method: "POST",
        body: "{}"
      }
    );

    finalStatus.textContent =
      "Auditoría finalizada: " +
      result.rows +
      " juicios en " +
      result.output;
    status.textContent =
      "Auditoría finalizada correctamente.";
  } catch (error) {
    finalStatus.textContent =
      "No se pudo finalizar: " + error.message;
  } finally {
    finalize.disabled = false;
  }
});

async function initialize() {
  try {
    const state = await requestJson(
      "/__authority-audit/state",
      {headers: {}}
    );

    rows = state.rows || [];
    judgments = state.judgments || {};

    const first = findNextUnjudged(0);
    index = first ?? 0;
    render();

    if (state.finalized) {
      finalStatus.textContent =
        "Esta auditoría ya fue finalizada" +
        (state.finalizedAt
          ? " el " + state.finalizedAt
          : "") +
        ".";
    }
  } catch (error) {
    status.textContent =
      "No pude cargar la auditoría: " + error.message;
  }
}

initialize();
