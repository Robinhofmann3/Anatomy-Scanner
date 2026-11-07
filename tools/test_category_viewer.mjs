import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../Data/anatomy-catalog.json', import.meta.url), 'utf8'));
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const catalogSource = await readFile(new URL('../anatomyCatalog.js', import.meta.url), 'utf8');
const groupingSource = await readFile(new URL('../organGroups.js', import.meta.url), 'utf8');
const { getOrganDisplayGroups } = await import(moduleUrl(groupingSource));

class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.events = {}; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    addEventListener(event, callback) { this.events[event] = callback; }
}
globalThis.document = { createElement: tag => new Element(tag), body: new Element('body') };
let panelSource = await readFile(new URL('../categoryPanel.js', import.meta.url), 'utf8');
panelSource = panelSource.replace("'./anatomyCatalog.js'", JSON.stringify(moduleUrl(catalogSource)));
panelSource = panelSource.replace("'./organGroups.js'", JSON.stringify(moduleUrl(groupingSource)));
const { createCategoryPanel } = await import(moduleUrl(panelSource));
let selection;
createCategoryPanel(catalog, value => { selection = value; });
function descendants(element) { return [element, ...element.children.flatMap(descendants)]; }
const elements = descendants(document.body);
const labels = elements.filter(e => e.tag === 'label');
const checkboxFor = name => labels.find(label => label.children[1].textContent.startsWith(name + ' (')).children[0];
const root = checkboxFor('Körper');
assert.ok(root.indeterminate);
assert.ok(checkboxFor('Haut').checked);
assert.ok(!checkboxFor('Blutgefäße').checked);
const vessels = checkboxFor('Blutgefäße');
vessels.checked = true;
vessels.events.change();
assert.ok(checkboxFor('Arterien').checked && checkboxFor('Venen').checked);
const arteries = checkboxFor('Arterien');
arteries.checked = false;
arteries.events.change();
assert.ok(vessels.indeterminate);
elements.find(e => e.tag === 'button' && e.textContent === 'Keine').events.click();
assert.equal(selection.size, 0);
assert.ok(!root.checked && !root.indeterminate);
elements.find(e => e.tag === 'button' && e.textContent === 'Alle').events.click();
assert.equal(selection.size, catalog.models.filter(m => m.source === 'partof').length);
assert.ok(root.checked);
const sourceModels = catalog.models.filter(m => m.source === 'partof');
assert.equal(elements.filter(e => e.tag === 'input' && e.value?.startsWith('partof:')).length, 0,
    'Raw mesh selectors are not displayed');
// Every supported coarse grouping partitions its category without losses or
// duplicate assignments, including the fallback for unrecognized source names.
for (const sourceId of ['isa', 'partof']) {
    for (const category of catalog.categories) {
        const direct = catalog.models.filter(m => m.source === sourceId && m.categoryId === category.id);
        const groups = getOrganDisplayGroups(category.id, direct);
        if (!groups.length) continue;
        const keys = groups.flatMap(group => group.models.map(m => m.key));
        assert.equal(new Set(keys).size, direct.length);
        assert.equal(keys.length, direct.length);
        assert.deepEqual(new Set(keys), new Set(direct.map(m => m.key)));
    }
}
const intestine = getOrganDisplayGroups('organs.digestive', sourceModels.filter(m => m.categoryId === 'organs.digestive'))
    .find(group => group.id.endsWith('.smallIntestine'));
assert.ok(intestine.models.length > 10, 'Small intestine combines multiple fragments');
const smallIntestineInput = checkboxFor('Dünndarm');
const beforeGroupChange = new Set(selection);
smallIntestineInput.checked = false;
smallIntestineInput.events.change();
assert.equal(selection.size, beforeGroupChange.size - intestine.models.length);
assert.ok(intestine.models.every(m => !selection.has(m.key)));
assert.ok(checkboxFor('Dickdarm').checked && checkboxFor('Leber').checked);
assert.ok(checkboxFor('Verdauung').indeterminate && checkboxFor('Organe').indeterminate);
checkboxFor('Verdauung').checked = false;
checkboxFor('Verdauung').events.change();
assert.ok(!checkboxFor('Dünndarm').checked && !checkboxFor('Dickdarm').checked);
smallIntestineInput.checked = true;
smallIntestineInput.events.change();
assert.ok(intestine.models.every(m => selection.has(m.key)));
assert.ok(checkboxFor('Verdauung').indeterminate);

// Exercise the async queue with controllable OBJ callbacks, without network/GPU.
const requests = [];
class Group {
    constructor() { this.rotation = {}; this.scale = { setScalar() {} }; this.children = []; }
    add(obj) { this.children.push(obj); }
}
globalThis.__viewerMocks = {
    THREE: { Group },
    OBJLoader: class { load(path, success, progress, error) { requests.push({ path, success, error }); } },
};
let loaderSource = await readFile(new URL('../objects_all_obj_organs.js', import.meta.url), 'utf8');
loaderSource = loaderSource.replace(/^import .*;\r?\n/gm, '');
loaderSource = 'const {THREE, OBJLoader} = globalThis.__viewerMocks;\n' + loaderSource;
const { createCatalogModels } = await import(moduleUrl(loaderSource));
const records = Array.from({ length: 10 }, (_, i) => ({ key: 'partof:' + i, fileId: 'FJ' + i, path: i + '.obj', categoryId: 'muscles' }));
let progress;
const manager = createCatalogModels(new Group(), {}, records, value => { progress = value; });
manager.setSelected(records.map(r => r.key));
assert.equal(requests.length, 8, 'Concurrency is bounded');
manager.setSelected([]);
const mesh = () => ({ userData: {}, traverse() {} });
const first = mesh();
requests[0].success(first);
assert.equal(first.visible, false, 'A deselected in-flight model stays hidden');
assert.equal(requests.length, 8, 'Deselected queued models do not start');
manager.setSelected([records[0].key]);
assert.equal(first.visible, true);
assert.equal(requests.length, 8, 'Loaded models are reused');
assert.equal(progress.loaded, 1);
const warn = console.warn;
console.warn = () => {};
requests[1].error(new Error('test network failure'));
console.warn = warn;
manager.setSelected([records[1].key]);
assert.equal(requests.length, 9, 'Reselecting a failed model retries it');
requests.at(-1).success(mesh());
assert.equal(progress.loaded, 1);
assert.equal(progress.failed, 0);
console.log('Category panel and asynchronous visibility checks passed.');
