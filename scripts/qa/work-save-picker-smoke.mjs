import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true, args: ["--no-sandbox"]
});
await mkdir("artifacts/work-save-picker", { recursive: true });

try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({
      viewport: { width, height: 760 },
      isMobile: true, hasTouch: true
    });
    await page.route("**/*", route =>
      route.request().url().startsWith(BASE)
        ? route.continue()
        : route.abort()
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ url: new URL("css/account.css", BASE).href });

    await page.evaluate(async () => {
      const [{ createWorkSaveManager }, { workSaveKey }] = await Promise.all([
        import("./js/work-save-picker.js"),
        import("./js/work-save-identity.js")
      ]);
      const work = {
        id: "W987654321",
        title: "Hegel's Preface to the Phenomenology of Spirit",
        authors: [{ name: "Georg Wilhelm Friedrich Hegel" }],
        year: 2021,
        doi: "10.1234/hegel"
      };
      const state = {
        library: [],
        assigned: new Map(),
        savedCalls: 0,
        projects: [
          { id: "project-one", title: "Investigación hegeliana", color: "#0f62fe" },
          { id: "project-two", title: "Ontología II", color: "#874b32" }
        ]
      };
      const emit = () => { if (state.listener) state.listener([...state.library]); };
      const normalizeWork = item => ({
        ...item,
        id: /^work-/.test(item.id)
          ? item.id
          : "work-" + item.id.toLowerCase(),
        sourceRecordId: item.sourceRecordId || item.id,
        origin: "public-engine",
        privateOnly: false
      });
      const runtime = {
        normalizeWork,
        subscribeLibrary: (_uid, callback) => {
          state.listener = callback;
          callback([...state.library]);
          return () => { state.listener = null; };
        },
        listUserProjects: async () => state.projects,
        listProjectSubprojects: async (_uid, id) =>
          id === "project-one"
            ? [{ id: "chapter-one", title: "Capítulo I" }]
            : [],
        getLibraryWork: async (_uid, id) =>
          state.library.find(item => item.id === id) || null,
        getProjectWorkAssignments: async (_uid, workId) =>
          new Map([...state.assigned.entries()]
            .filter(([, item]) => item.id === workId)),
        saveLibraryWork: async (_uid, item) => {
          const normalized = normalizeWork(item);
          state.library = [normalized,
            ...state.library.filter(record => record.id !== normalized.id)];
          state.savedCalls += 1;
          emit();
          return normalized;
        },
        attachWorkToProject: async (_uid, id, item, { subprojectId = "" } = {}) => {
          state.assigned.set(id, { ...item, subprojectId });
        },
        detachWorkFromProject: async (_uid, id) => {
          state.assigned.delete(id);
        },
        deleteLibraryWork: async (_uid, id) => {
          state.library = state.library.filter(item => item.id !== id);
          emit();
        }
      };
      window.__bookmarkFixture = state;

      const card = document.createElement("article");
      card.className = "result-card";
      card.id = "bookmark-test-card";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "research-save-button research-save-icon";
      button.dataset.saveIcon = "";
      button.dataset.saveWorkKey = workSaveKey(work);
      button.setAttribute("aria-label", "Guardar obra en mi biblioteca");
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path class="save-bookmark-shape" d="M7 4.75V21l5-3.35L17 21V4.75Z"></path></svg>';
      card.append(button);
      document.body.append(card);
      const manager = createWorkSaveManager({
        getWorkspace: async () => ({ runtime, user: { uid: "fixture" } }),
        onSignInRequired: () => { throw Error("unexpected auth redirect"); },
        setSavingState: trigger => {
          trigger.disabled = true;
          trigger.classList.add("is-saving");
        },
        setSavedState: (trigger, _text, allowToggle) => {
          trigger.disabled = !allowToggle;
          trigger.classList.remove("is-saving");
          trigger.classList.add("is-saved");
          trigger.dataset.saved = "true";
        },
        restoreButton: trigger => {
          trigger.disabled = false;
          trigger.classList.remove("is-saving", "is-saved");
          delete trigger.dataset.saved;
        },
        showToast: message => { state.toast = message; }
      });
      manager.start(true);
      button.addEventListener("click", () => void manager.handle({ work, trigger: button }));
    });

    const bookmark = page.locator("#bookmark-test-card .research-save-button");
    await bookmark.click();
    await page.locator("[data-work-picker-project][value='project-two']").waitFor();

    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector(".work-save-dialog");
      const rect = dialog.getBoundingClientRect();
      return {
        left: rect.left, right: rect.right,
        top: rect.top, bottom: rect.bottom,
        width: innerWidth, height: innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth + 2
      };
    });
    assert.ok(geometry.left >= -1 && geometry.right <= width + 1,
      "Project picker extends beyond phone width " + width +
      ": " + JSON.stringify(geometry));
    assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.height + 1,
      "Project picker extends beyond phone height " + width +
      ": " + JSON.stringify(geometry));
    assert.equal(geometry.overflow, false, "Page scrolls horizontally");

    await page.locator('[data-work-picker-project][value="project-one"]').check();
    await page.locator('[data-work-picker-subproject="project-one"]').selectOption("chapter-one");
    await page.locator('[data-work-picker-project][value="project-two"]').check();

    await page.screenshot({
      path: "artifacts/work-save-picker/select-" + width + ".png",
      animations: "disabled"
    });

    await page.locator("[data-work-picker-commit]").click();
    await page.waitForFunction(() =>
      window.__bookmarkFixture.library.length === 1 &&
      window.__bookmarkFixture.assigned.size === 2 &&
      !document.querySelector(".work-save-dialog").open
    );

    const saved = await page.evaluate(() => ({
      count: window.__bookmarkFixture.library.length,
      writes: window.__bookmarkFixture.savedCalls,
      assigned: [...window.__bookmarkFixture.assigned.entries()]
        .map(([key, value]) => [key, value.subprojectId]),
      marked: document.querySelector("#bookmark-test-card .research-save-button")
        ?.classList.contains("is-saved")
    }));
    assert.equal(saved.count, 1, "Saving to two projects must create only one library entry");
    assert.equal(saved.writes, 1, "Library must be saved once");
    assert.equal(saved.assigned.length, 2);
    assert.deepEqual(saved.assigned[0], ["project-one", "chapter-one"]);
    assert.equal(saved.marked, true);

    // A newly rendered result for the same work must show its saved state.
    await page.evaluate(() => {
      const first = document.querySelector("#bookmark-test-card .research-save-button");
      const clone = first.cloneNode(true);
      clone.classList.remove("is-saved");
      clone.disabled = false;
      document.querySelector("#bookmark-test-card").append(clone);
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#bookmark-test-card .research-save-button")]
        .every(button => button.classList.contains("is-saved"))
    );

    // Clicking again exposes the option to un-save. Removing from projects is
    // explicit and confirmed rather than silently erasing research structure.
    page.on("dialog", async alert => { await alert.accept(); });
    await bookmark.click();
    await page.locator("[data-work-picker-remove]").waitFor();
    assert.equal(await page.locator("[data-work-picker-remove]").isVisible(), true);
    await page.locator("[data-work-picker-remove]").click();
    await page.waitForFunction(() =>
      window.__bookmarkFixture.library.length === 0 &&
      window.__bookmarkFixture.assigned.size === 0 &&
      !document.querySelector(".work-save-dialog").open
    );

    assert.equal(await bookmark.evaluate(button => button.classList.contains("is-saved")),
      false, "Un-save should restore the empty bookmark");
    await page.close();
    process.stdout.write("Bookmark project picker and un-save OK: " + width + "px\n");
  }
} finally {
  await browser.close();
}
