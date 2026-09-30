from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m semantic_retrieval.faiss_worker INDEX")
    try:
        import faiss
    except ImportError as error:
        raise RuntimeError(
            "Install requirements-semantic-retrieval.txt before searching FAISS."
        ) from error

    index = faiss.read_index(str(Path(sys.argv[1])))
    for line in sys.stdin:
        try:
            request = json.loads(line)
            if request.get("close"):
                return
            vector = np.asarray(request["vector"], dtype=np.float32).reshape(1, -1)
            scores, vector_ids = index.search(vector, int(request["count"]))
            response = {
                "scores": scores[0].tolist(),
                "vector_ids": vector_ids[0].tolist(),
            }
        except (KeyError, TypeError, ValueError, RuntimeError) as error:
            response = {"error": f"{type(error).__name__}: {error}"}
        print(json.dumps(response, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
