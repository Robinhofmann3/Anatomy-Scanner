import { getCategoryModels } from './anatomyCatalog.js';

const LABELS = {
    body: 'Körper', skin: 'Haut', muscles: 'Muskeln', skeleton: 'Skelett',
    'skeleton.skull': 'Schädel', 'skeleton.axial': 'Wirbelsäule & Brustkorb',
    'skeleton.limbs': 'Arme, Beine & Gürtel', vessels: 'Blutgefäße',
    'vessels.arteries': 'Arterien', 'vessels.veins': 'Venen', organs: 'Organe',
    'organs.heart': 'Herz', 'organs.heart.walls': 'Wände',
    'organs.heart.valves': 'Klappen', 'organs.heart.other': 'Weitere Herzstrukturen',
    'organs.respiratory': 'Atmung', 'organs.digestive': 'Verdauung',
    'organs.urogenital': 'Harn- & Geschlechtsorgane', 'organs.nervous': 'Nervensystem',
    'organs.senses': 'Sinnesorgane', 'organs.endocrine': 'Hormondrüsen',
    'organs.lymphatic': 'Lymphatische Organe', unclassified: 'Nicht zugeordnet',
};

export function createCategoryPanel(catalog, onChange) {
    const panel = document.createElement('aside');
    panel.className = 'category-panel';
    panel.setAttribute('aria-label', 'Anatomische Kategorien');
    const title = document.createElement('h2');
    title.textContent = 'Körper anzeigen';
    panel.append(title);
    const help = document.createElement('p');
    help.textContent = 'Gruppen ein-/ausblenden. Haut ausblenden, um das Innere zu sehen. Modelle werden bei Auswahl geladen.';
    panel.append(help);
    const toolbar = document.createElement('div');
    toolbar.className = 'category-toolbar';
    panel.append(toolbar);
    const selected = new Set([
        ...getCategoryModels(catalog, 'skin'), ...getCategoryModels(catalog, 'organs'),
    ].map(model => model.key));
    const rows = [];

    function refresh() {
        for (const { checkbox, models } of rows) {
            const count = models.filter(model => selected.has(model.key)).length;
            checkbox.checked = count > 0 && count === models.length;
            checkbox.indeterminate = count > 0 && count < models.length;
        }
        onChange(new Set(selected));
    }

    for (const [text, enable] of [['Alle', true], ['Keine', false]]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.addEventListener('click', () => {
            selected.clear();
            if (enable) for (const model of getCategoryModels(catalog, 'body')) selected.add(model.key);
            refresh();
        });
        toolbar.append(button);
    }

    function addCategory(category, container) {
        const children = catalog.categories.filter(child => child.parentId === category.id);
        const models = getCategoryModels(catalog, category.id);
        let row;
        let nested;
        if (children.length) {
            const details = document.createElement('details');
            details.open = category.id === 'body';
            row = document.createElement('summary');
            details.append(row);
            nested = document.createElement('div');
            nested.className = 'category-children';
            details.append(nested);
            container.append(details);
        } else {
            row = document.createElement('div');
            row.className = 'category-leaf';
            container.append(row);
        }
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.disabled = models.length === 0;
        const text = document.createElement('span');
        text.textContent = `${LABELS[category.id] || category.labelEn} (${models.length})`;
        label.append(checkbox, text);
        // Labels toggle selection; the disclosure triangle toggles expansion.
        label.addEventListener('click', event => event.stopPropagation());
        checkbox.addEventListener('change', () => {
            for (const model of models) {
                if (checkbox.checked) selected.add(model.key);
                else selected.delete(model.key);
            }
            refresh();
        });
        row.append(label);
        rows.push({ checkbox, models });
        for (const child of children) addCategory(child, nested);
    }
    addCategory(catalog.categories.find(category => category.id === 'body'), panel);
    const status = document.createElement('p');
    status.className = 'category-status';
    status.setAttribute('role', 'status');
    panel.append(status);
    const note = document.createElement('small');
    note.textContent = 'Vorläufige Zuordnung · Zahlen = Modelldateien. Nicht medizinisch geprüft.';
    panel.append(note);
    document.body.append(panel);
    refresh();
    return {
        setProgress({ total, loaded, failed }) {
            status.textContent = total === 0 ? 'Keine Modelle ausgewählt.'
                : `${loaded} / ${total} Modelle geladen${failed ? ` · ${failed} Fehler (zum Wiederholen ab- und anwählen)` : ''}`;
        },
    };
}
