import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Import browser ES module without requiring a package.json change.
const source = await readFile(new URL('../anatomyCatalog.js', import.meta.url), 'utf8');
const { getCategoryModels } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const catalog = JSON.parse(await readFile(new URL('../Data/anatomy-catalog.json', import.meta.url), 'utf8'));
for (const sourceId of ['isa', 'partof']) {
    const all = getCategoryModels(catalog, 'body', sourceId);
    assert.equal(all.length, catalog.models.filter(m => m.source === sourceId).length);
    const heart = getCategoryModels(catalog, 'organs.heart', sourceId);
    assert.ok(heart.length > 0);
    assert.ok(heart.every(m => m.categoryId.startsWith('organs.heart.')));
    const vessels = getCategoryModels(catalog, 'vessels', sourceId);
    assert.equal(vessels.length,
        getCategoryModels(catalog, 'vessels.arteries', sourceId).length +
        getCategoryModels(catalog, 'vessels.veins', sourceId).length);
}
assert.ok(getCategoryModels(catalog, 'body').every(m => m.source === 'partof'));
assert.throws(() => getCategoryModels(catalog, 'missing'));
console.log('Category selection checks passed.');
