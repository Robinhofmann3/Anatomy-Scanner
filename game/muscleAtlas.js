// „💪 Muskel-Atlas“: Muskeln nach Regionen (Oberkörper, Arme, Rumpf, Beine) und Gruppen
// (Delta, Bizeps, Adduktoren …). Muskel im 3D-Körper oder in der Liste anklicken →
// Kurzanleitung zur Hauptübung mit Bildern, typischem Fehler und Alternativen.
// Daten: Data/muscle-atlas.json · Übungsbilder: Free Exercise DB (Public Domain).
import * as THREE from 'three';

const EXCLUDE = /artery|vein|nerve|branch|ligament|tendon/i;
const FAINT = '#d9c7bd';

export function createMuscleAtlas({ stage, ui }) {
    const muscles = new THREE.Group();
    muscles.name = 'MUSCLE_ATLAS';
    muscles.visible = false;
    let atlas = null;
    let loading = null;
    const groups = new Map();        // id -> { data, region, material, meshes: [] }
    let region = null;
    let selected = null;
    let hovered = null;
    let cameraGoal = null;

    const panel = document.createElement('aside');
    panel.className = 'atlas-panel';
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
        panel.addEventListener(type, event => event.stopPropagation());
    }
    document.body.append(panel);

    async function load(onProgress) {
        atlas = await fetch(new URL('../Data/muscle-atlas.json', import.meta.url)).then(r => r.json());
        const [supplement] = await Promise.all([stage.loadSupplement(), stage.ensureLoaded()]);
        const pool = [...stage.catalog.models, ...supplement];
        const records = [];
        const groupOf = new Map();
        for (const r of atlas.regions) {
            for (const g of r.groups) {
                const pattern = new RegExp(g.patterns.join('|'), 'i');
                const material = new THREE.MeshStandardMaterial({ color: FAINT, roughness: 0.6 });
                groups.set(g.id, { data: g, region: r, material, meshes: [] });
                for (const record of pool) {
                    if (record.source !== g.source || EXCLUDE.test(record.nameEn) || groupOf.has(record.key)) continue;
                    if (!pattern.test(record.nameEn)) continue;
                    groupOf.set(record.key, g.id);
                    records.push(record);
                }
            }
        }
        let done = 0;
        const parts = await stage.loadParts(records, () => onProgress?.(++done / records.length));
        const inner = stage.modelSpace();
        for (const record of records) {
            const obj = parts.get(record.key);
            if (!obj) continue;
            const group = groups.get(groupOf.get(record.key));
            obj.traverse(c => {
                if (!c.isMesh) return;
                c.material = group.material;
                c.userData.muscleGroup = group.data.id;
                group.meshes.push(c);
            });
            inner.add(obj);
        }
        muscles.add(inner);
        stage.root.add(muscles);
    }

    // ------------------------------------------------------------ Darstellung
    function paint() {
        for (const [id, g] of groups) {
            const on = id === selected;
            const inRegion = g.region.id === region;
            const m = g.material;
            m.color.set(on ? g.data.color : FAINT);
            m.emissive.set(on ? g.data.color : id === hovered ? '#555555' : '#000000');
            m.emissiveIntensity = on ? 0.2 : 0.35;
            m.transparent = !on;
            m.opacity = on ? 1 : inRegion ? 0.6 : 0.3;
            m.depthWrite = on;
            m.needsUpdate = true;
            for (const mesh of g.meshes) mesh.renderOrder = on ? 0 : 1;
        }
    }

    function lookFrom(view) {
        cameraGoal = new THREE.Vector3(0, 11, view === 'back' ? -34 : 34);
    }

    function select(id) {
        const g = groups.get(id);
        if (!g) return;
        selected = id;
        region = g.region.id;
        lookFrom(g.data.view);
        paint();
        render();
    }

    function badge(home) {
        return ui.el('span', `atlas-badge ${home ? 'home' : 'gym'}`, home ? '🏠 Zuhause' : '🏋️ Gym');
    }

    function image(src, alt) {
        const img = document.createElement('img');
        img.src = new URL(`../${src}`, import.meta.url).href;
        img.alt = alt;
        img.loading = 'lazy';
        return img;
    }

    function render() {
        panel.replaceChildren();
        const head = ui.el('div', 'atlas-head');
        head.append(ui.el('h2', '', '💪 Muskel-Atlas'), ui.button('✕', () => close()));
        panel.append(head);

        const tabs = ui.el('div', 'atlas-tabs');
        for (const r of atlas.regions) {
            const b = ui.button(r.label, () => { region = r.id; selected = null; paint(); render(); });
            b.setAttribute('aria-pressed', String(r.id === region));
            tabs.append(b);
        }
        panel.append(tabs);

        const list = ui.el('div', 'atlas-groups');
        for (const g of atlas.regions.find(r => r.id === region).groups) {
            const b = ui.button(g.label, () => select(g.id));
            b.style.setProperty('--group', g.color);
            b.setAttribute('aria-pressed', String(g.id === selected));
            list.append(b);
        }
        panel.append(list);

        if (!selected) {
            panel.append(ui.el('p', 'atlas-hint', 'Wähle eine Muskelgruppe – oder klicke direkt auf einen Muskel im Körper.'));
        } else {
            const g = groups.get(selected).data;
            const card = ui.el('article', 'atlas-card');
            card.style.setProperty('--group', g.color);
            card.append(ui.el('h3', '', g.label), ui.el('p', 'atlas-function', g.function));

            const main = g.main;
            const title = ui.el('div', 'atlas-ex-title');
            title.append(ui.el('strong', '', `Hauptübung: ${main.name}`), badge(main.home));
            const pics = ui.el('div', 'atlas-pics');
            main.images.forEach((src, i) => pics.append(image(src, `${main.name} – ${i ? 'Endposition' : 'Startposition'}`)));
            const steps = ui.el('ol', 'atlas-steps');
            for (const s of main.steps) steps.append(ui.el('li', '', s));
            card.append(title, pics, steps, ui.el('p', 'atlas-mistake', `⚠️ Typischer Fehler: ${main.mistake}`));

            card.append(ui.el('h4', '', 'Alternativen'));
            const alts = ui.el('ul', 'atlas-alts');
            for (const a of g.alternatives) {
                const li = ui.el('li');
                const text = ui.el('div');
                const name = ui.el('div', 'atlas-alt-name');
                name.append(ui.el('strong', '', a.name), badge(a.home));
                text.append(name, ui.el('span', '', a.tip));
                li.append(image(a.images[0], a.name), text);
                alts.append(li);
            }
            card.append(alts);
            panel.append(card);
        }

        const view = ui.el('div', 'atlas-view');
        view.append(ui.button('👀 Vorderseite', () => lookFrom('front')), ui.button('🔄 Rückseite', () => lookFrom('back')));
        panel.append(view);
        panel.append(ui.el('small', 'atlas-credit', `${atlas.imageCredit} Latissimus, gerader Bauchmuskel und Lungenlappen ergänzt aus BodyParts3D 3.0.`));
    }

    // ------------------------------------------------------------ Interaktion
    function pickGroup(event) {
        const hit = stage.setPointer(event).intersectObject(muscles, true)[0];
        return hit?.object.userData.muscleGroup || null;
    }

    function activate() {
        let down = null;
        stage.setMode({
            pointer: {
                pointerdown(event) { if (event.button === 0) down = { x: event.clientX, y: event.clientY }; },
                pointerup(event) {
                    if (!down) return;
                    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
                    down = null;
                    if (moved > 6) return;                     // war eine Drehung, kein Klick
                    const id = pickGroup(event);
                    if (id) select(id);
                },
                pointermove(event) {
                    if (down) return;
                    const id = pickGroup(event);
                    if (id !== hovered) { hovered = id; paint(); }
                    stage.canvas.style.cursor = id ? 'pointer' : '';
                    if (id) ui.showTooltip(groups.get(id).data.label, event.clientX, event.clientY);
                    else ui.hideTooltip();
                },
            },
            frame(dt) {
                if (!cameraGoal) return;
                stage.camera.position.lerp(cameraGoal, Math.min(1, dt * 4));
                stage.controls.target.set(0, 10, 0);
                stage.controls.update();
                if (stage.camera.position.distanceTo(cameraGoal) < 0.05) cameraGoal = null;
            },
        });
    }

    async function open() {
        stage.enter();
        stage.hideAll();
        const show = p => ui.showRound({ title: '💪 Muskeln werden geladen …', text: `${Math.round(p * 100)} %` });
        show(0);
        try {
            if (!loading) loading = load(show);
            await loading;
        } catch (error) {
            console.error(error);
            loading = null;
            ui.hideRound();
            ui.toast('Muskeln konnten nicht geladen werden.', 'bad');
            return close();
        }
        ui.hideRound();
        stage.hideAll();          // beim ersten Laden wurden die Spielorgane erst danach erzeugt
        muscles.visible = true;
        document.body.classList.add('atlas-active');
        region = atlas.regions[0].id;
        selected = null;
        paint();
        render();
        activate();
    }

    function close() {
        muscles.visible = false;
        ui.hideTooltip();
        document.body.classList.remove('atlas-active');
        panel.replaceChildren();
        stage.exit();
    }

    return { open, close, select };
}
