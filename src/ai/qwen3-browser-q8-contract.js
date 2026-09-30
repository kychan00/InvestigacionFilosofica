export const QWEN3_BROWSER_Q8_TOP_K =
  20;


export const QWEN3_BROWSER_Q8_CONTRACT =
  Object.freeze({
    modelId:
      "onnx-community/Qwen3-Reranker-0.6B-ONNX",

    revision:
      "9995c50e2310679108a55f5ccd16ba8be9f17c20",

    artifact:
      "onnx/model_quantized.onnx",

    dtype:
      "q8",

    device:
      "webgpu",

    maxLength:
      1024,

    transformersJsVersion:
      "4.3.0",

    instruction:
      "Given an academic philosophy search query, retrieve documents that substantively address the complete information need.\n\n" +
      "Treat explicit authors, works, philosophical concepts, and disciplinary domains as required constraints unless the query clearly expresses an alternative.\n\n" +
      "For interdisciplinary queries, require a substantive connection between the philosophical topic and the external domain. A document that substantively addresses only one side is insufficient.\n\n" +
      "Do not reward mere keyword overlap, incidental mentions, journal names, publisher metadata, retrieval provenance, or the fact that a document was retrieved by a particular query variant.\n\n" +
      "Judge relevance only from the supplied query and document content.\n"
  });


export function isQwen3BrowserQ8OptIn(
  search = ""
) {
  return new URLSearchParams(
    search
  ).get("qwen3") === "1";
}


function authorName(
  author
) {
  if (
    typeof author === "string"
  ) {
    return author.trim();
  }


  return String(
    author?.name || ""
  ).trim();
}


export function buildQwen3BrowserQ8Candidate(
  query,
  result
) {
  return {
    query:
      String(query).trim(),

    title:
      String(
        result?.title || ""
      ).trim(),

    authors:
      (result?.authors || [])
        .map(authorName)
        .filter(Boolean),

    year:
      Number.isInteger(
        result?.year
      )
        ? result.year
        : null,

    document_language:
      String(
        result?.language || ""
      ).trim() || null,

    abstract:
      String(
        result?.abstract || ""
      ).trim()
  };
}


export function selectQwen3BrowserQ8Candidates(
  query,
  results,
  topK = QWEN3_BROWSER_Q8_TOP_K
) {
  return results
    .slice(
      0,
      topK
    )
    .map(
      result =>
        buildQwen3BrowserQ8Candidate(
          query,
          result
        )
    );
}


export function rerankTopKByQwen3BrowserQ8(
  results,
  rawScores,
  topK = QWEN3_BROWSER_Q8_TOP_K
) {
  const candidateCount =
    Math.min(
      topK,
      results.length
    );


  if (
    rawScores.length !==
    candidateCount
  ) {
    throw new Error(
      "Qwen3 score count does not match the selected candidate count"
    );
  }


  const ranked =
    results
      .slice(
        0,
        candidateCount
      )
      .map(
        (
          result,
          originalIndex
        ) => ({
          result,
          originalIndex,
          rawScore:
            Number(
              rawScores[
                originalIndex
              ]
            )
        })
      );


  if (
    ranked.some(
      item =>
        !Number.isFinite(
          item.rawScore
        )
    )
  ) {
    throw new Error(
      "Qwen3 returned an invalid score"
    );
  }


  ranked.sort(
    (a, b) =>
      b.rawScore -
        a.rawScore ||
      a.originalIndex -
        b.originalIndex
  );


  return [
    ...ranked.map(
      item => item.result
    ),

    ...results.slice(
      candidateCount
    )
  ];
}
