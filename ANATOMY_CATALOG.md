# Anatomy model catalog

This is a first-pass UI classification of the local models, not an anatomical
ontology or a fixed outside-to-inside layer order. The current viewer uses it
for the category panel. The local skin cutout correction remains in place.

## Data and identity

`Data/anatomy-catalog.json` inventories every available OBJ in both collections.
Names, FMA concept IDs and representation IDs come from each OBJ's own header,
not from the text table exported from the other collection. Missing names fall
back to the filename. Models use collection-qualified keys (`partof:FJ2810`),
because the same file ID can have different representations across collections.
Do not load both collections as one body or merge records by file ID/concept ID.
Multiple meshes can share a concept ID and must remain separately selectable.

The default collection is `partof`, matching the current viewer. The viewer
loads selected records directly from their catalog paths, rather than requesting
the old hard-coded organ list. Catalog inclusion does not imply visibility.

## Category tree

- Body: skin, muscles, skeleton, vessels, organs, unclassified.
- Skeleton: skull; spine/rib cage; limbs/girdles.
- Vessels: arteries; veins.
- Organs: heart; respiratory; digestive; urinary/reproductive; nervous;
  sensory; endocrine; lymphatic.
- Heart: walls; valves; other structures (including cavity models).

Each model has one primary `categoryId`. Ancestors select all descendant models.
This is a UI grouping; eye muscles can be under muscles and coronary vessels
under vessels. It is not an assertion that every part of an organ belongs to
one exclusive anatomical system. Skin is one available mesh, with no invented
epidermis/dermis layers. Unknown structures, ligaments and ambiguous names
remain unclassified instead of being silently assigned.

## Review and maintain

Name rules produce initial proposals, marked `needsReview: true`. Counts are
counts of OBJ files, not unique anatomical organs. All proposals need review
before this is presented as a medically validated classification.

For reviewed corrections, edit `Data/anatomy-category-overrides.json`:

```json
{
  "partof:FJ2810": { "categoryId": "skin" }
}
```

Keys must reference existing models and category IDs must exist. Rebuild after
changing overrides or model files; do not hand-edit generated catalog entries.

```text
python tools/build_anatomy_catalog.py
python tools/test_anatomy_catalog.py
node tools/test_anatomy_catalog.mjs
node tools/test_category_viewer.mjs
```

## Category panel and rendering

`anatomyCatalog.js` exports `loadAnatomyCatalog()` (async HTTP fetch) and
`getCategoryModels(catalog, categoryId, source = catalog.defaultSource)`.
The latter returns model records including descendants; unknown category IDs
throw. Use each returned record's `path` to load geometry and `key` to track it.
Use a local web server, as with the existing viewer.

```js
const catalog = await loadAnatomyCatalog();
const heartModels = getCategoryModels(catalog, 'organs.heart');
```

The German-language panel controls whole-body visibility, with expandable
categories, descendant selection, mixed parent states and All/None actions.
Initially skin and organs are selected; muscles, skeleton, vessels and
unclassified models can be enabled independently. The skin cutout still works
through the draggable ring. Hide skin to see internal models outside the ring.

At most eight selected models load at once, skin first. Deselected queued models
do not start; in-flight models finish hidden if deselected. Loaded geometry is
cached for the page session. Failures remain visible in the progress summary;
toggle the affected category off and on to retry. The panel preserves selection
while loading. No fixed anatomical depth is encoded, and this panel does not
implement depth peeling, individual-model selection or saved preferences.

## View and magnifier controls

Right-drag pans the view; left-drag rotates by default. The compact bottom
toolbar can assign left-drag to panning, with the active mode highlighted.
Wheel zoom remains available. The magnifier's rim
and handle can be dragged with the left button or one touch, independently of
the body. Minus/plus buttons beside the rim change size in 5% steps, from 50%
to 250%, scaling the entire magnifier and live skin-cutout shader together.
The controls follow the projected rim, stay in the viewport and prefer the
opposite side if the category panel blocks them; other free positions are used
on narrow screens. They support keyboard activation and show the current
percentage. At each size limit the corresponding button is disabled.
Reset restores the camera, lens position and size,
without changing categories. This remains a skin viewing window, not optical
magnification. Optional real-browser checks: `python tools/test_magnifier_browser.py`
(requires Playwright, Microsoft Edge and access to the Three.js CDN).
