// Shared inventory API for a future category panel. Does not load geometry.
export async function loadAnatomyCatalog() {
    const response = await fetch(new URL('./Data/anatomy-catalog.json', import.meta.url));
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    return response.json();
}

export function getCategoryModels(catalog, categoryId, source = catalog.defaultSource) {
    if (!catalog.categories.some(category => category.id === categoryId)) {
        throw new Error(`Unknown category: ${categoryId}`);
    }
    const ids = new Set([categoryId]);
    let previousSize;
    do {
        previousSize = ids.size;
        for (const category of catalog.categories) {
            if (ids.has(category.parentId)) ids.add(category.id);
        }
    } while (ids.size !== previousSize);
    return catalog.models.filter(model => model.source === source && ids.has(model.categoryId));
}
