import { authorSaveKey, authorSaveKeys, findSavedAuthor } from "./author-save-identity.js";

/**
 * Project picker for public authors. Firebase is injected through the lazy
 * account runtime: this module never imports the Firebase SDK itself.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function projectHtml(project, collections, assignment) {
  const id = escapeHtml(project.id);
  const active = Boolean(assignment);
  const subprojectId = assignment?.subprojectId || "";
  const color = /^#[0-9a-f]{6}$/i.test(project.color || "")
    ? project.color : "#0f62fe";
  const collectionOptions = [
    '<option value="">Proyecto principal</option>',
    ...collections.map(item =>
      '<option value="' + escapeHtml(item.id) + '"' +
      (subprojectId === item.id ? " selected" : "") + '>' +
      escapeHtml(item.title || "Colección sin título") + "</option>"
    )
  ].join("");

  return '<div class="work-picker-project">' +
    '<label class="work-picker-project-choice">' +
      '<input type="checkbox" data-work-picker-project value="' + id + '"' +
        (active ? " checked" : "") + '>' +
      '<span class="work-picker-project-color" style="--project-color:' + color + '"></span>' +
      '<span class="work-picker-project-copy">' +
        '<strong>' + escapeHtml(project.title || "Proyecto sin título") + '</strong>' +
        (project.description
          ? '<small>' + escapeHtml(String(project.description).slice(0, 170)) + '</small>'
          : "") +
        (project.status === "archived" ? '<small>Proyecto archivado</small>' : "") +
      '</span>' +
    '</label>' +
    (collections.length
      ? '<label class="work-picker-subproject">Colección dentro del proyecto' +
        '<select data-work-picker-subproject="' + id + '"' +
          (active ? "" : " disabled") + '>' + collectionOptions + '</select></label>'
      : "") +
  '</div>';
}

export function createAuthorSaveManager({
  getWorkspace,
  onSignInRequired,
  setSavingState,
  setSavedState,
  restoreButton,
  showToast
}) {
  let library = [];
  let libraryUid = "";
  let unsubscribe = null;
  let picker = null;
  let pickerState = null;
  let observer = null;

  function syncButtons() {
    if (!libraryUid) return;
    const saved = new Set(library.flatMap(authorSaveKeys));
    for (const button of document.querySelectorAll(
      ".author-save-button[data-save-author-key]"
    )) {
      if (button.classList.contains("is-saving")) continue;
      if (saved.has(button.dataset.saveAuthorKey)) {
        setSavedState(button, "Guardado", true);
      } else {
        restoreButton(button, "Guardar autor en mi archivo");
      }
    }
  }

  function subscribeToLibrary(runtime, user) {
    if (libraryUid === user.uid) return;
    unsubscribe?.();
    library = [];
    libraryUid = user.uid;
    unsubscribe = runtime.subscribeSavedAuthors(user.uid, items => {
      if (libraryUid !== user.uid) return;
      library = items;
      syncButtons();
    });
  }

  async function verifiedWorkspace() {
    const { runtime, user } = await getWorkspace();
    if (user) subscribeToLibrary(runtime, user);
    return { runtime, user };
  }

  function start(hasVerifiedHint) {
    if (!hasVerifiedHint) return;
    // Never load a private library for anonymous visitors.
    void verifiedWorkspace().catch(error => {
      console.warn("No se pudo sincronizar la archivo personal.", error);
    });
    if (typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(records => {
      if (!libraryUid) return;
      if (records.some(record => [...record.addedNodes].some(node =>
        node.nodeType === 1 && (
          node.matches?.(".author-save-button[data-save-author-key]") ||
          node.querySelector?.(".author-save-button[data-save-author-key]")
        )
      ))) syncButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function feedback(message, error = false) {
    if (!picker) return;
    const element = picker.querySelector("[data-work-picker-feedback]");
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  function setBusy(busy) {
    if (!pickerState) return;
    pickerState.busy = busy;
    for (const input of picker.querySelectorAll("input, button, select")) {
      input.disabled = busy;
    }
    if (!busy) {
      for (const select of picker.querySelectorAll("[data-work-picker-subproject]")) {
        const project = picker.querySelector(
          '[data-work-picker-project][value="' +
            CSS.escape(select.dataset.workPickerSubproject) + '"]'
        );
        select.disabled = !project?.checked;
      }
    }
  }

  function ensureDialog() {
    if (picker) return picker;
    const dialog = document.createElement("dialog");
    dialog.className = "work-save-dialog";
    dialog.setAttribute("aria-labelledby", "author-save-dialog-title");
    dialog.innerHTML = [
      '<form class="work-save-form">',
      '<header class="work-save-heading">',
      '<span class="work-save-eyebrow">ARCHIVO PERSONAL · MI INVESTIGACIÓN</span>',
      '<h2 id="author-save-dialog-title">Guardar autor</h2>',
      '<p data-work-picker-title class="work-save-subtitle"></p>',
      '</header>',
      '<p class="work-save-explanation">Seleccione uno o varios proyectos. ' +
        'Sin seleccionarlos, se guarda únicamente en el archivo.</p>',
      '<div class="work-save-projects" data-work-picker-projects></div>',
      '<p class="work-save-feedback" role="status" aria-live="polite" data-work-picker-feedback></p>',
      '<footer class="work-save-actions">',
      '<button type="button" data-work-picker-cancel class="work-save-cancel">Cancelar</button>',
      '<button type="button" data-work-picker-remove class="work-save-remove" hidden>' +
        'Quitar de guardados</button>',
      '<button type="submit" data-work-picker-commit class="work-save-commit">Guardar autor</button>',
      '</footer>',
      '</form>'
    ].join("");
    document.body.append(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog || event.target.closest("[data-work-picker-cancel]")) {
        if (!pickerState?.busy) dialog.close();
      }
      if (event.target.closest("[data-work-picker-remove]")) {
        void removeCurrentAuthor();
      }
    });
    dialog.addEventListener("cancel", event => {
      if (pickerState?.busy) event.preventDefault();
    });
    dialog.addEventListener("change", event => {
      const checkbox = event.target.closest("[data-work-picker-project]");
      if (!checkbox) return;
      const select = dialog.querySelector(
        '[data-work-picker-subproject="' + CSS.escape(checkbox.value) + '"]'
      );
      if (select) select.disabled = !checkbox.checked;
    });
    dialog.addEventListener("submit", event => {
      event.preventDefault();
      void saveCurrentAuthor();
    });
    dialog.addEventListener("close", () => {
      const trigger = pickerState?.trigger;
      pickerState = null;
      if (trigger?.isConnected) {
        restoreButton(trigger, "Guardar autor en mi archivo");
        syncButtons();
        trigger.focus({ preventScroll: true });
      }
    });
    picker = dialog;
    return picker;
  }

  async function openPicker(runtime, user, author, trigger) {
    const dialog = ensureDialog();
    const normalized = runtime.normalizeSavedAuthor(author);
    const state = {
      runtime, user, author, trigger, normalized, stored: null,
      projects: [], collections: new Map(), assignments: new Map(),
      busy: false
    };
    pickerState = state;
    // The dialog is reused: saving disabled every control on the previous
    // opening. Restore them before loading a different or previously saved author.
    setBusy(false);
    dialog.querySelector("#author-save-dialog-title").textContent = "Guardar autor";
    dialog.querySelector("[data-work-picker-title]").textContent =
      author.displayName || author.name || "Autor sin nombre";
    dialog.querySelector("[data-work-picker-projects]").innerHTML =
      '<p class="work-save-loading">Cargando sus proyectos…</p>';
    dialog.querySelector("[data-work-picker-remove]").hidden = true;
    dialog.querySelector("[data-work-picker-commit]").disabled = true;
    feedback("");
    dialog.showModal();

    try {
      const [projects, stored] = await Promise.all([
        runtime.listUserProjects(user.uid),
        Promise.resolve(findSavedAuthor(author, library))
          .then(found => found || runtime.getSavedAuthor(user.uid, normalized.id))
      ]);
      if (pickerState !== state) return;
      state.projects = projects;
      state.stored = stored;
      state.normalized = stored || normalized;

      const [assignments, collectionEntries] = await Promise.all([
        runtime.getProjectAuthorAssignments(user.uid, state.normalized.id, projects),
        Promise.all(projects.map(async project => {
          try {
            return [project.id, await runtime.listProjectSubprojects(user.uid, project.id)];
          } catch (error) {
            console.warn("No se pudieron leer las colecciones del proyecto.", error);
            return [project.id, []];
          }
        }))
      ]);
      if (pickerState !== state) return;
      state.assignments = assignments;
      state.collections = new Map(collectionEntries);

      dialog.querySelector("#author-save-dialog-title").textContent =
        stored || assignments.size ? "Administrar autor guardado" : "Guardar autor";
      dialog.querySelector("[data-work-picker-projects]").innerHTML = projects.length
        ? projects.map(project =>
            projectHtml(project, state.collections.get(project.id) || [],
              assignments.get(project.id))
          ).join("")
        : '<p class="work-save-empty">No tiene proyectos todavía. Puede guardar ' +
          'el autor en su archivo y crear proyectos desde <a href="' +
          new URL("perfil.html#proyectos", import.meta.url.replace(/js\/[^/]+$/, "")).href +
          '">Mi investigación</a>.</p>';

      dialog.querySelector("[data-work-picker-commit]").textContent =
        stored || assignments.size ? "Guardar cambios" : "Guardar autor";
      dialog.querySelector("[data-work-picker-commit]").disabled = false;
      dialog.querySelector("[data-work-picker-remove]").hidden =
        !(stored || assignments.size);

      if (stored && !library.some(item => item.id === stored.id)) {
        library = [stored, ...library];
      }
      if (trigger) {
        if (stored) setSavedState(trigger, "Guardado", true);
        else restoreButton(trigger, "Guardar autor en mi archivo");
      }
      dialog.querySelector("[data-work-picker-commit]").focus();
    } catch (error) {
      console.error("No se pudieron recuperar los proyectos.", error);
      if (pickerState !== state) return;
      dialog.querySelector("[data-work-picker-projects]").innerHTML = "";
      feedback("No se pudo recuperar el archivo y los proyectos. Inténtelo de nuevo.", true);
      if (trigger) restoreButton(trigger, "Guardar autor en mi archivo");
    }
  }

  async function saveCurrentAuthor() {
    const state = pickerState;
    if (!state || state.busy) return;
    const chosen = [...picker.querySelectorAll("[data-work-picker-project]:checked")]
      .map(input => ({
        id: input.value,
        subprojectId: picker.querySelector(
          '[data-work-picker-subproject="' + CSS.escape(input.value) + '"]'
        )?.value || ""
      }));
    setBusy(true);
    feedback("Guardando en su archivo y proyectos…");
    try {
      // A single canonical saved-author record, even when assigned to many projects.
      const savedId = await state.runtime.saveAuthor(
        state.user.uid, state.normalized
      );
      const saved = { ...state.normalized, id: savedId };
      const selectedIds = new Set(chosen.map(item => item.id));
      for (const projectId of state.assignments.keys()) {
        if (!selectedIds.has(projectId)) {
          await state.runtime.detachAuthorFromProject(state.user.uid, projectId, saved.id);
        }
      }
      for (const project of chosen) {
        const previous = state.assignments.get(project.id);
        if (!previous || (previous.subprojectId || "") !== project.subprojectId) {
          await state.runtime.attachAuthorToProject(
            state.user.uid, project.id, saved, { subprojectId: project.subprojectId }
          );
        }
      }
      library = [saved, ...library.filter(item => item.id !== saved.id)];
      syncButtons();
      picker.close();
      showToast(chosen.length
        ? "Autor guardado en su archivo y " + chosen.length + " proyecto(s)."
        : "Autor guardado en su archivo.");
    } catch (error) {
      console.error("No se pudo guardar el autor en los proyectos.", error);
      feedback("No se completó el guardado. Revise la conexión y vuelva a intentar.", true);
      setBusy(false);
    }
  }

  async function removeCurrentAuthor() {
    const state = pickerState;
    if (!state || state.busy) return;
    const count = state.assignments.size;
    if (count && !window.confirm(
      "¿Quitar este autor de su archivo y de " + count +
      " proyecto(s)? También se retirarán sus fichas de esos proyectos."
    )) return;

    setBusy(true);
    feedback("Quitando el autor de guardados…");
    try {
      for (const projectId of state.assignments.keys()) {
        await state.runtime.detachAuthorFromProject(
          state.user.uid, projectId, state.normalized.id
        );
      }
      if (state.stored) {
        await state.runtime.deleteSavedAuthor(state.user.uid, state.stored.id);
      }
      library = library.filter(item => item.id !== state.normalized.id);
      syncButtons();
      picker.close();
      showToast(count
        ? "Autor quitado de su archivo y " + count + " proyecto(s)."
        : "Autor quitado de su archivo.");
    } catch (error) {
      console.error("No se pudo quitar el autor.", error);
      feedback("No se pudo retirar de todos los destinos. Puede reintentar.", true);
      setBusy(false);
    }
  }

  async function handle({ author, trigger } = {}) {
    if (!author) return;
    if (trigger?.classList.contains("is-saving")) return;
    if (picker?.open) return;
    if (trigger) {
      trigger.dataset.saveAuthorKey = authorSaveKey(author);
      setSavingState(trigger, "Abriendo guardados…");
    }
    try {
      const { runtime, user } = await verifiedWorkspace();
      if (!user) {
        restoreButton(trigger, "Guardar");
        onSignInRequired(author);
        return;
      }
      await openPicker(runtime, user, author, trigger);
    } catch (error) {
      console.error("No se pudo abrir el selector de proyectos.", error);
      restoreButton(trigger, "Guardar");
      showToast("No se pudo abrir su archivo. Vuelva a intentar.");
    }
  }

  return { start, handle };
}
