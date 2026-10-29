import {
  normalizeAuthorName
} from "./remote-author-resolution.js?v=20261029-author-reliability-v1";


const TITLE_STOPWORDS = new Set([
  "about", "after", "against", "also", "among", "and", "avec",
  "como", "contra", "dans", "das", "dass", "della", "dem", "den",
  "der", "des", "die", "eine", "einer", "eines", "entre", "essay",
  "essays", "estudio", "from", "für", "historia", "into", "les",
  "mais", "mit", "more", "nach", "nelle", "oder", "para", "por",
  "sobre", "the", "their", "through", "toward", "towards", "uma",
  "und", "une", "unter", "with", "without", "zum", "zur"
]);


function countBy(values) {
  const counts = new Map();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(
      value,
      (counts.get(value) || 0) + 1
    );
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count
    }))
    .sort((a, b) =>
      b.count - a.count ||
      String(a.value).localeCompare(
        String(b.value),
        "und",
        { numeric: true }
      )
    );
}


function focusTerms(
  author,
  works,
  limit = 8
) {
  const authorTokens = new Set(
    normalizeAuthorName(
      author?.displayName || ""
    )
      .split(" ")
      .filter(Boolean)
  );
  const terms = [];

  for (const work of works) {
    const unique = new Set(
      normalizeAuthorName(work.title || "")
        .split(" ")
        .filter(term =>
          term.length >= 4 &&
          !TITLE_STOPWORDS.has(term) &&
          !authorTokens.has(term) &&
          !/^\d+$/.test(term)
        )
    );

    terms.push(...unique);
  }

  return countBy(terms)
    .slice(0, limit)
    .map(item => ({
      term: item.value,
      count: item.count
    }));
}


function decadeCounts(works) {
  return countBy(
    works
      .map(work => Number(work.year))
      .filter(Number.isFinite)
      .map(year =>
        Math.floor(year / 10) * 10
      )
  )
    .sort((a, b) =>
      Number(a.value) - Number(b.value)
    )
    .map(item => ({
      decade: Number(item.value),
      label: `${item.value}s`,
      count: item.count
    }));
}


export function summarizeAuthorCorpus(
  author,
  works
) {
  const safeWorks = Array.isArray(works)
    ? works
    : [];
  const years = safeWorks
    .map(work => Number(work.year))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const loadedWorks = safeWorks.length;
  const reportedWorks = Number(
    author?.corpusWorks
  ) || 0;

  return {
    corpusWorks:
      Math.max(reportedWorks, loadedWorks),
    loadedWorks,
    yearFrom:
      years[0] || null,
    yearTo:
      years.at(-1) || null,
    languages: countBy(
      safeWorks.map(work =>
        work.language || "und"
      )
    ),
    types: countBy(
      safeWorks.map(work =>
        work.type || "other"
      )
    ),
    focuses:
      focusTerms(author, safeWorks),
    decades:
      decadeCounts(safeWorks)
  };
}
