const progress = document.querySelector("#progress");
const counter = document.querySelector("#counter");
const status = document.querySelector("#status");
const judgePanel = document.querySelector("#judgePanel");
const donePanel = document.querySelector("#donePanel");
const auditId = document.querySelector("#auditId");
const position = document.querySelector("#position");
const query = document.querySelector("#query");
const title = document.querySelector("#title");
const meta = document.querySelector("#meta");
const abstract = document.querySelector("#abstract");
const note = document.querySelector("#note");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const nextUnlabeled = document.querySelector("#nextUnlabeled");
const finalize = document.querySelector("#finalize");
const finalStatus = document.querySelector("#finalStatus");
const labelButtons = [...document.querySelectorAll(".label-button")];

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
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function currentRow() {
  return rows[index] || null;
}

function currentJudgment() {
  const row = currentRow();
  return row ? judgments[row.audit_id] || null : null;
}

function labeledCount() {
  return rows.filter((row) => Number.isInteger(judgments[row.audit_id]?.human_relevance)).length;
}

function metaParts(row) {
  const parts = [];
  if (row.authors?.length) parts.push(row.authors.join(", "));
  if (row.year) parts.push(String(row.year));
  if (row.type) parts.push(row.type);
  if (row.document_language) parts.push(`idioma doc.: ${row.document_language}`);
  if (row.journal) parts.push(row.journal);
  if (row.publisher) parts.push(row.publisher);
  return parts;
}

function renderProgress() {
  const labeled = labeledCount();
  progress.value = labeled;
  progress.max = rows.length || 100;
  counter.textContent = `${labeled}/${rows.length || 100} etiquetados`;
  donePanel.style.display = labeled === rows.length && rows.length ? "block" : "none";
}

function render() {
  const row = currentRow();
  if (!row) return;

  const judgment = currentJudgment();
  judgePanel.hidden = false;

  auditId.textContent = row.audit_id;
  position.textContent = `${index + 1} de ${rows.length}`;
  query.textContent = row.query;
  title.textContent = row.title || "(sin título)";
  meta.textContent = metaParts(row).join(" · ") || "Sin metadatos adicionales";
  abstract.textContent = row.abstract?.trim() || "Abstract no disponible.";
  note.value = judgment?.human_note || "";

  for (const button of labelButtons) {
    const selected = Number(button.dataset.label) === judgment?.human_relevance;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  previous.disabled = index === 0;
  next.disabled = index === rows.length - 1;
  status.textContent = judgment && Number.isInteger(judgment.human_relevance)
    ? `Guardado: relevancia ${judgment.human_relevance}`
    : "Sin juzgar.";

  renderProgress();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function findNextUnlabeled(start = 0) {
  for (let offset = 0; offset < rows.length; offset += 1) {
    const candidate = (start + offset) % rows.length;
    if (!Number.isInteger(judgments[rows[candidate].audit_id]?.human_relevance)) return candidate;
  }
  return null;
}

async function saveCurrent(relevance = undefined, { advance = false } = {}) {
  const row = currentRow();
  if (!row || saving) return;

  const previousJudgment = judgments[row.audit_id] || {
    human_relevance: null,
    human_note: "",
  };
  const nextRelevance = relevance === undefined
    ? previousJudgment.human_relevance
    : relevance;

  saving = true;
  status.textContent = "Guardando…";

  try {
    await requestJson("/__qwen3_holdout_audit/save", {
      method: "POST",
      body: JSON.stringify({
        audit_id: row.audit_id,
        human_relevance: nextRelevance,
        human_note: note.value,
      }),
    });

    judgments[row.audit_id] = {
      human_relevance: nextRelevance,
      human_note: note.value,
    };

    renderProgress();
    status.textContent = Number.isInteger(nextRelevance)
      ? `Guardado: relevancia ${nextRelevance}`
      : "Nota guardada; aún sin etiqueta.";

    if (advance) {
      const nextIndex = findNextUnlabeled(index + 1);
      if (nextIndex !== null) index = nextIndex;
      else if (index < rows.length - 1) index += 1;
    }
    render();
  } catch (error) {
    status.textContent = `Error al guardar: ${error.message}`;
  } finally {
    saving = false;
  }
}

for (const button of labelButtons) {
  button.addEventListener("click", () => {
    saveCurrent(Number(button.dataset.label), { advance: true });
  });
}

previous.addEventListener("click", () => {
  if (index > 0) {
    index -= 1;
    render();
  }
});

next.addEventListener("click", () => {
  if (index < rows.length - 1) {
    index += 1;
    render();
  }
});

nextUnlabeled.addEventListener("click", () => {
  const target = findNextUnlabeled(index + 1);
  if (target === null) {
    status.textContent = "Ya no quedan pares sin juzgar.";
    return;
  }
  index = target;
  render();
});

note.addEventListener("input", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    saveCurrent(undefined, { advance: false });
  }, 650);
});

note.addEventListener("blur", () => {
  clearTimeout(noteTimer);
  saveCurrent(undefined, { advance: false });
});

window.addEventListener("keydown", (event) => {
  if (document.activeElement === note) return;

  if (["0", "1", "2", "3"].includes(event.key)) {
    event.preventDefault();
    saveCurrent(Number(event.key), { advance: true });
    return;
  }
  if (event.key === "ArrowLeft" && index > 0) {
    event.preventDefault();
    index -= 1;
    render();
  }
  if (event.key === "ArrowRight" && index < rows.length - 1) {
    event.preventDefault();
    index += 1;
    render();
  }
});

finalize.addEventListener("click", async () => {
  finalize.disabled = true;
  finalStatus.textContent = "Finalizando…";
  try {
    const result = await requestJson("/__qwen3_holdout_audit/finalize", {
      method: "POST",
      body: "{}",
    });
    finalStatus.textContent = `Holdout humano finalizado: ${result.rows} juicios guardados.`;
    status.textContent = "Adjudicación finalizada correctamente.";
  } catch (error) {
    finalStatus.textContent = `No se pudo finalizar: ${error.message}`;
  } finally {
    finalize.disabled = false;
  }
});

async function initialize() {
  try {
    const state = await requestJson("/__qwen3_holdout_audit/state", { headers: {} });
    rows = state.rows;
    judgments = state.judgments || {};
    const firstUnlabeled = findNextUnlabeled(0);
    index = firstUnlabeled ?? 0;
    render();
    if (state.finalized) {
      finalStatus.textContent = `Esta adjudicación ya fue finalizada${state.finalizedAt ? ` el ${state.finalizedAt}` : ""}.`;
    }
  } catch (error) {
    status.textContent = `No pude cargar la auditoría: ${error.message}`;
  }
}

initialize();
