from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

import numpy as np


MODULE_PATH = (
    Path(__file__).parents[1]
    / "scripts/retrieval/evaluate_browser_static_v1.py"
)
SPEC = importlib.util.spec_from_file_location("browser_static_v1", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class BrowserStaticV1Test(unittest.TestCase):
    def test_normalized_prefix_has_fixed_dimension_and_unit_norm(self):
        values = np.arange(2 * 1024, dtype=np.float32).reshape(2, 1024) + 1
        output = MODULE.normalized_prefix(values)
        self.assertEqual(output.shape, (2, 256))
        np.testing.assert_allclose(np.linalg.norm(output, axis=1), 1.0, atol=1e-6)

    def test_quantization_is_deterministic_and_signed(self):
        values = np.asarray([[-1.0, -0.5, 0.0, 0.5, 1.0]], dtype=np.float32)
        output = MODULE.quantize(values)
        np.testing.assert_array_equal(output, [[-127, -64, 0, 64, 127]])

    def test_stable_topk_breaks_equal_scores_by_vector_id(self):
        scores = np.asarray([0.5, 0.9, 0.9, 0.2], dtype=np.float32)
        ids = np.asarray([7, 9, 3, 1], dtype=np.int64)
        selected_ids, _ = MODULE.stable_topk(scores, ids, 3)
        np.testing.assert_array_equal(selected_ids, [3, 9, 7])

    def test_recall_uses_identifier_overlap(self):
        expected = np.asarray([1, 2, 3, 4], dtype=np.int64)
        observed = np.asarray([1, 3, 8, 9], dtype=np.int64)
        self.assertEqual(MODULE.recall(expected, observed, 4), 0.5)


if __name__ == "__main__":
    unittest.main()
