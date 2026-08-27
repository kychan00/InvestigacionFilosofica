import {
  institutionalSources
} from "../data/institutional-sources.js";


function titleAuthorQuery(item) {
  return [
    item.title,
    item.authors?.[0]?.name
  ]
    .filter(Boolean)
    .map(
      value =>
        String(value).trim()
    )
    .join(" ");
}


function titleQuery(item) {
  return String(
    item.title || ""
  ).trim();
}


function doiQuery(item) {
  return String(
    item.doi ||
    item.title ||
    ""
  ).trim();
}


function sourceQuery(
  source,
  item
) {
  if (
    source.queryMode ===
    "title"
  ) {
    return titleQuery(item);
  }


  if (
    source.queryMode ===
    "doi"
  ) {
    return doiQuery(item);
  }


  return titleAuthorQuery(
    item
  );
}


export function buildInstitutionalLinks(
  item
) {
  return institutionalSources
    .filter(
      source =>
        source.enabled &&
        source.searchUrl
    )
    .map(
      source => {
        const query =
          sourceQuery(
            source,
            item
          );


        return {
          id:
            source.id,

          name:
            source.name,

          mode:
            source.mode,

          query,

          url:
            source.searchUrl.replace(
              "{query}",
              encodeURIComponent(
                query
              )
            )
        };
      }
    );
}
