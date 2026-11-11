import {
  createReadStream
} from "node:fs";


function parseJsonLine(
  path,
  line,
  lineNumber
) {
  if (!line.trim()) {
    return null;
  }

  try {
    return JSON.parse(line);
  } catch (error) {
    const preview =
      JSON.stringify(
        line.slice(
          0,
          240
        )
      );

    throw new SyntaxError(
      "Invalid JSONL in " +
      path +
      " at physical line " +
      lineNumber +
      ": " +
      error.message +
      "; preview=" +
      preview,
      {
        cause:
          error
      }
    );
  }
}


export async function* readJsonLines(
  path
) {
  const input =
    createReadStream(
      path,
      {
        encoding:
          "utf8"
      }
    );

  let buffer = "";
  let lineNumber = 0;

  for await (
    const chunk of
    input
  ) {
    buffer += chunk;

    while (true) {
      const separator =
        buffer.indexOf(
          "\n"
        );

      if (
        separator < 0
      ) {
        break;
      }

      let line =
        buffer.slice(
          0,
          separator
        );

      buffer =
        buffer.slice(
          separator + 1
        );

      lineNumber++;

      if (
        line.endsWith(
          "\r"
        )
      ) {
        line =
          line.slice(
            0,
            -1
          );
      }

      const parsed =
        parseJsonLine(
          path,
          line,
          lineNumber
        );

      if (
        parsed !== null
      ) {
        yield parsed;
      }
    }
  }

  if (
    buffer.length
  ) {
    lineNumber++;

    let line =
      buffer;

    if (
      line.endsWith(
        "\r"
      )
    ) {
      line =
        line.slice(
          0,
          -1
        );
    }

    const parsed =
      parseJsonLine(
        path,
        line,
        lineNumber
      );

    if (
      parsed !== null
    ) {
      yield parsed;
    }
  }
}
