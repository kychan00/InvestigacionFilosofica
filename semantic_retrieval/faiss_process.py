from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from threading import Lock

import numpy as np


class FaissSearchProcess:
    """Keep FAISS isolated from PyTorch's native runtime on macOS."""

    def __init__(self, index_path: Path):
        self.index_path = index_path
        self._lock = Lock()
        self._process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "semantic_retrieval.faiss_worker",
                str(index_path),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

    def search(self, vector: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
        if self._process.stdin is None or self._process.stdout is None:
            raise RuntimeError("FAISS worker pipes are unavailable")
        request = {
            "vector": np.asarray(vector, dtype=np.float32).reshape(-1).tolist(),
            "count": int(count),
        }
        with self._lock:
            if self._process.poll() is not None:
                raise RuntimeError(
                    f"FAISS worker exited with code {self._process.returncode}"
                )
            self._process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
            self._process.stdin.flush()
            response_line = self._process.stdout.readline()
        if not response_line:
            raise RuntimeError(
                f"FAISS worker closed unexpectedly with code {self._process.poll()}"
            )
        response = json.loads(response_line)
        if "error" in response:
            raise RuntimeError(f"FAISS worker failed: {response['error']}")
        scores = np.asarray(response["scores"], dtype=np.float32).reshape(1, -1)
        vector_ids = np.asarray(response["vector_ids"], dtype=np.int64).reshape(1, -1)
        return scores, vector_ids

    def close(self) -> None:
        if self._process.poll() is None and self._process.stdin is not None:
            try:
                self._process.stdin.write('{"close":true}\n')
                self._process.stdin.flush()
                self._process.wait(timeout=5)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self._process.terminate()
        if self._process.poll() is None:
            self._process.kill()
        self._process.wait()
        if self._process.stdin is not None:
            self._process.stdin.close()
        if self._process.stdout is not None:
            self._process.stdout.close()
