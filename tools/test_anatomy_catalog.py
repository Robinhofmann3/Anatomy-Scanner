"""Inventory integrity checks; run after build_anatomy_catalog.py."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CatalogIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'Data/anatomy-catalog.json').read_text(encoding='utf-8'))

    def test_every_model_is_inventoried_once_and_exists(self):
        models = self.catalog['models']
        actual = {p.relative_to(ROOT).as_posix() for p in (ROOT / 'Data').rglob('*.obj')}
        self.assertEqual(actual, {m['path'].removeprefix('./') for m in models})
        self.assertEqual(len(models), len({m['key'] for m in models}))
        self.assertEqual(len(models), len(actual))
        for model in models:
            self.assertEqual(model['fileId'], model['headerFileId'])

    def test_category_tree_is_connected_acyclic_and_complete(self):
        parents = {c['id']: c['parentId'] for c in self.catalog['categories']}
        for category in parents:
            visited = set()
            cursor = category
            while cursor is not None:
                self.assertNotIn(cursor, visited)
                visited.add(cursor)
                cursor = parents[cursor]
            self.assertIn('body', visited)
        for model in self.catalog['models']:
            self.assertIn(model['categoryId'], parents)

    def test_variants_are_not_conflated_and_uncertainty_is_preserved(self):
        models = {m['key']: m for m in self.catalog['models']}
        self.assertNotEqual(models['isa:FJ2810']['representationId'],
                            models['partof:FJ2810']['representationId'])
        self.assertTrue(any(m['categoryId'] == 'unclassified' for m in models.values()))
        for model in models.values():
            if model['classificationBasis'] in ('name-rule', 'unmatched'):
                self.assertTrue(model['needsReview'])


if __name__ == '__main__':
    unittest.main()
