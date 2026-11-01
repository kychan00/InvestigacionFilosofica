import unittest

from scripts.openalex.author_index_common import (
    alias_signatures,
    bucket_for,
    normalize_name,
    token_signature,
)


class AuthorIndexCommonTest(unittest.TestCase):
    def test_normalizes_accents_and_punctuation(self):
        self.assertEqual(
            normalize_name("Nava-Amezcua, Álvaro"),
            "nava amezcua alvaro",
        )

    def test_signature_is_order_independent(self):
        self.assertEqual(
            token_signature("Alonso Nava Amezcua"),
            token_signature("Amezcua, Alonso Nava"),
        )

    def test_aliases_include_full_tokens_and_initial(self):
        aliases = dict(
            alias_signatures(
                "Alonso Nava Amezcua"
            )
        )

        self.assertEqual(
            aliases["alonso amezcua nava"],
            "full",
        )

        self.assertEqual(
            aliases["amezcua"],
            "surname",
        )

        self.assertEqual(
            aliases["a amezcua"],
            "initial",
        )

    def test_academic_titles_and_compound_surnames_are_aliases(self):
        self.assertEqual(normalize_name("Dra. Dinora Hernández"),"dinora hernandez")
        self.assertEqual(token_signature("Dra Dinora Hernández"),
                         token_signature("Dinora Hernández"))
        aliases=dict(alias_signatures("Dinora Hernández López"))
        self.assertEqual(aliases["dinora hernandez"],"given-first-family")
        self.assertEqual(aliases["dinora hernandez lopez"],"full")
        self.assertEqual(dict(alias_signatures("Dra Dinora Hernández"))["dinora hernandez"],"full")

    def test_bucket_is_deterministic(self):
        self.assertEqual(
            bucket_for("immanuel kant"),
            bucket_for("immanuel kant"),
        )

        self.assertGreaterEqual(
            bucket_for("immanuel kant"),
            0,
        )

        self.assertLess(
            bucket_for("immanuel kant"),
            1024,
        )


if __name__ == "__main__":
    unittest.main()
