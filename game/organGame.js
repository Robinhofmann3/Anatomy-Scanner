// Organ-Puzzle: Organe aus der Ablage per Drag & Drop an die richtige Stelle im Körper ziehen.
// Datenbasis: Data/organ-hierarchy.json (LOD1–3) und Data/organ-portfolio.json (LOD4).
//
// CG-Komponenten: Picking (Raycaster), Objektmanipulation (Drag auf kameraparalleler Ebene),
// Animation (Einrasten, Zurückfliegen, Pulsieren), Hierarchie (Organ = Gruppe aus Einzelteilen).
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { createGameUI } from './organGameUI.js';

// Gleiche Transformation wie prepareModel() im Viewer (BodyParts3D: mm, z nach oben)
const MODEL_ROTATION_X = -Math.PI / 2;
const MODEL_SCALE = 20 / 1641;
const MAX_PARALLEL = 8;
const TRAY_MAX_SIZE = 2.4;          // Organe in der Ablage passen in diesen Würfel
const SNAP_PIXELS = 70;             // Einrast-Radius auf dem Bildschirm
const POINTS = { placeFirstTry: 10, placeLater: 5, quizCorrect: 5 };

const ARTICLE = {
    gehirn: 'das', herz: 'das', lunge: 'die', leber: 'die', magen: 'der',
    duenndarm: 'der', dickdarm: 'der', niere: 'die', harnblase: 'die',
};

const COLORS = {
    gehirn: '#e8a3b4', herz: '#c62f3a', lunge: '#f08a9a', leber: '#8e2f2a', magen: '#e99a7a',
    duenndarm: '#f2b08c', dickdarm: '#b9785a', niere: '#a3383f', harnblase: '#e8c35a',
};

// Orientierungshilfe: Skelett-Teile, die halbtransparent mitgeladen werden
function isOrientationBone(record) {
    return record.categoryId === 'skeleton.axial' || record.categoryId === 'skeleton.skull'
        || (record.categoryId === 'skeleton.limbs' && /hip bone|clavicle|scapula/i.test(record.nameEn));
}

function sideLabel(lod3Id) {
    if (lod3Id.endsWith('_links')) return 'links';
    if (lod3Id.endsWith('_rechts')) return 'rechts';
    return '';
}

export function createOrganGame({ scene, camera, controls, canvas, catalog, viewerGroup, hideDuringGame = [] }) {
    const ui = createGameUI({ onStart: start, onExit: exit, onRestart: shuffle });
    const root = new THREE.Group();
    root.name = 'ORGAN_GAME';
    root.visible = false;
    scene.add(root);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragOffset = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const tweens = [];

    let organs = [];            // { lod3Id, entry, label, group, target, traySlot, trayScale, placeholder, placed, tries }
    let loaded = false;
    let loading = null;
    let active = false;
    let dragging = null;
    let hovered = null;
    let points = 0;
    let wrongDrops = 0;
    const savedCamera = { position: new THREE.Vector3(), target: new THREE.Vector3() };

    // ---------------------------------------------------------------- Laden
    async function loadData() {
        const [hierarchy, portfolio] = await Promise.all([
            fetch(new URL('../Data/organ-hierarchy.json', import.meta.url)).then(r => r.json()),
            fetch(new URL('../Data/organ-portfolio.json', import.meta.url)).then(r => r.json()),
        ]);
        const records = new Map(catalog.models.map(m => [m.key, m]));
        const portfolioByLod3 = new Map();
        for (const entry of portfolio.organs) for (const id of entry.lod3Ids) portfolioByLod3.set(id, entry);
        const gameNodes = hierarchy.nodes.filter(n => n.level === 3 && n.game && portfolioByLod3.has(n.id));
        const bones = catalog.models.filter(m => m.source === hierarchy.source && isOrientationBone(m));
        const skin = catalog.models.filter(m => m.source === hierarchy.source && m.categoryId === 'skin');
        return { gameNodes, portfolioByLod3, records, bones, skin };
    }

    // Bereits im Viewer geladene Teile wiederverwenden (Geometrie wird geteilt)
    function viewerCache() {
        const cache = new Map();
        for (const child of viewerGroup?.children || []) {
            if (child.userData.catalogKey) cache.set(child.userData.catalogKey, child);
        }
        return cache;
    }

    function loadParts(records, onEach) {
        const loader = new OBJLoader();
        const cache = viewerCache();
        const queue = [...records];
        const results = new Map();
        return new Promise(resolve => {
            let running = 0;
            const pump = () => {
                if (!queue.length && !running) return resolve(results);
                while (running < MAX_PARALLEL && queue.length) {
                    const record = queue.shift();
                    const cached = cache.get(record.key);
                    if (cached) {
                        const copy = cached.clone(true);
                        copy.traverse(o => { o.visible = true; });
                        results.set(record.key, copy);
                        onEach();
                        continue;
                    }
                    running++;
                    loader.load(record.path, obj => {
                        obj.traverse(c => { if (c.isMesh) c.geometry.computeVertexNormals(); });
                        results.set(record.key, obj);
                        running--; onEach(); pump();
                    }, undefined, error => {
                        console.warn('Organ-Puzzle: Teil fehlt', record.path, error);
                        running--; onEach(); pump();
                    });
                }
                if (!queue.length && !running) resolve(results);
            };
            pump();
        });
    }

    function modelSpace() {
        const inner = new THREE.Group();
        inner.rotation.x = MODEL_ROTATION_X;
        inner.scale.setScalar(MODEL_SCALE);
        return inner;
    }

    async function build() {
        const data = await loadData();
        const wanted = [
            ...data.skin, ...data.bones,
            ...data.gameNodes.flatMap(n => n.modelKeys.map(k => data.records.get(k)).filter(Boolean)),
        ];
        let done = 0;
        const parts = await loadParts(wanted, () => {
            done++;
            ui.setStartLabel(`⏳ Lade Organe … ${Math.round(done / wanted.length * 100)} %`, true);
        });

        // Geisterhaut + Skelett zur Orientierung
        const body = modelSpace();
        const ghost = (color, opacity) => new THREE.MeshStandardMaterial({
            color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 });
        const skinMat = ghost(0xe6bea0, 0.14);
        const boneMat = ghost(0xf4f1ea, 0.35);
        for (const record of [...data.skin, ...data.bones]) {
            const obj = parts.get(record.key);
            if (!obj) continue;
            const isSkin = record.categoryId === 'skin';
            obj.traverse(c => {
                if (!c.isMesh) return;
                c.material = isSkin ? skinMat : boneMat;
                c.renderOrder = isSkin ? 2 : 1;
                c.castShadow = c.receiveShadow = false;
            });
            body.add(obj);
        }
        root.add(body);

        // Spielorgane: jedes LOD3-Organ wird eine Gruppe mit Drehpunkt in der Organmitte
        const placeholderGeo = new THREE.SphereGeometry(1, 32, 16);
        for (const node of data.gameNodes) {
            const entry = data.portfolioByLod3.get(node.id);
            const material = new THREE.MeshStandardMaterial({
                color: COLORS[entry.id] || '#cc8877', roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
            const group = new THREE.Group();
            group.name = node.id;
            const inner = modelSpace();
            for (const key of node.modelKeys) {
                const obj = parts.get(key);
                if (!obj) continue;
                obj.traverse(c => {
                    if (!c.isMesh) return;
                    c.material = material;
                    c.castShadow = true;
                    c.userData.organId = node.id;
                });
                inner.add(obj);
            }
            if (!inner.children.length) continue;
            group.add(inner);
            root.add(group);
            group.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(inner);
            const target = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            inner.position.copy(target).negate();        // Drehpunkt in die Organmitte
            group.position.copy(target);

            const placeholder = new THREE.Mesh(placeholderGeo, new THREE.MeshStandardMaterial({
                color: 0x7fd3ff, emissive: 0x2a8fd0, emissiveIntensity: 0.6,
                transparent: true, opacity: 0.55, depthWrite: false }));
            const radius = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.22, 0.35, 1.0);
            placeholder.scale.setScalar(radius);
            placeholder.userData.baseScale = radius;
            placeholder.position.copy(target);
            placeholder.renderOrder = 3;
            root.add(placeholder);

            const side = sideLabel(node.id);
            organs.push({
                lod3Id: node.id, entry, material, group, target, placeholder,
                label: side ? `${entry.name} (${side})` : entry.name,
                trayScale: Math.min(1, TRAY_MAX_SIZE / Math.max(size.x, size.y, size.z)),
                traySlot: new THREE.Vector3(), placed: false, tries: 0,
            });
        }
        loaded = true;
    }

    // ---------------------------------------------------------------- Spielablauf
    function layoutTray() {
        const order = [...organs].sort(() => Math.random() - 0.5);
        const perSide = Math.ceil(order.length / 2);
        order.forEach((organ, i) => {
            const left = i < perSide;
            const row = left ? i : i - perSide;
            const rows = left ? perSide : order.length - perSide;
            const y = 17.5 - row * (15 / Math.max(1, rows - 1));
            organ.traySlot.set(left ? -8.5 : 8.5, y, 1.5);
        });
    }

    function resetOrgans() {
        tweens.length = 0;
        points = 0;
        wrongDrops = 0;
        layoutTray();
        for (const organ of organs) {
            organ.placed = false;
            organ.tries = 0;
            organ.quizDone = false;
            organ.group.position.copy(organ.traySlot);
            organ.group.scale.setScalar(organ.trayScale);
            organ.group.rotation.set(0, 0, 0);
            organ.placeholder.visible = true;
            organ.material.emissive.setHex(0x000000);
        }
        updateStats();
    }

    function updateStats() {
        ui.setStats({ placedCount: organs.filter(o => o.placed).length, total: organs.length, points });
    }

    function maxPoints() {
        const quizzes = new Set(organs.map(o => o.entry.id));
        const quizCount = [...quizzes].reduce((sum, id) => sum + organs.find(o => o.entry.id === id).entry.quiz.length, 0);
        return organs.length * POINTS.placeFirstTry + quizCount * POINTS.quizCorrect;
    }

    async function start() {
        if (!loaded) {
            if (!loading) loading = build().catch(error => {
                console.error(error);
                ui.setStartLabel('⚠️ Laden fehlgeschlagen – Seite neu laden', false);
                loading = null;
                throw error;
            });
            await loading;
        }
        active = true;
        document.body.classList.add('game-active');
        if (viewerGroup) viewerGroup.visible = false;
        for (const obj of hideDuringGame) obj.traverse(o => o.layers.set(31));   // unsichtbar + nicht anklickbar
        root.visible = true;
        savedCamera.position.copy(camera.position);
        savedCamera.target.copy(controls.target);
        camera.position.set(0, 11, 36);
        controls.target.set(0, 10, 0);
        controls.update();
        resetOrgans();
        ui.setStartLabel('🧩 Organ-Puzzle starten', false);
        ui.showIntro(() => {});
    }

    function exit() {
        active = false;
        endDrag();
        ui.closeModal();
        ui.hideTooltip();
        root.visible = false;
        if (viewerGroup) viewerGroup.visible = true;
        for (const obj of hideDuringGame) obj.traverse(o => o.layers.set(0));
        document.body.classList.remove('game-active');
        camera.position.copy(savedCamera.position);
        controls.target.copy(savedCamera.target);
        controls.update();
    }

    function shuffle() {
        if (!active) return;
        ui.closeModal();
        resetOrgans();
        ui.toast('Neu gemischt – auf ein Neues!');
    }

    // ---------------------------------------------------------------- Animation
    function tween(object, { position, scale, duration = 0.6, onDone }) {
        for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].object === object) tweens.splice(i, 1);
        tweens.push({
            object, t: 0, duration, onDone, movesPosition: Boolean(position),
            fromPos: object.position.clone(), toPos: position ? position.clone() : null,
            fromScale: object.scale.x, toScale: scale ?? object.scale.x,
        });
    }

    const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    let last = performance.now();
    function tick(now) {
        requestAnimationFrame(tick);
        const dt = Math.min(0.2, (now - last) / 1000);
        last = now;
        if (!root.visible) return;
        for (let i = tweens.length - 1; i >= 0; i--) {
            const tw = tweens[i];
            tw.t = Math.min(1, tw.t + dt / tw.duration);
            const k = easeOutBack(tw.t);
            if (tw.movesPosition) tw.object.position.lerpVectors(tw.fromPos, tw.toPos, k);
            tw.object.scale.setScalar(tw.fromScale + (tw.toScale - tw.fromScale) * k);
            if (tw.t >= 1) { tweens.splice(i, 1); tw.onDone?.(); }
        }
        // Platzhalter pulsieren lassen
        const pulse = 1 + 0.12 * Math.sin(now / 260);
        for (const organ of organs) {
            if (!organ.placeholder.visible) continue;
            const hot = dragging && organ.placeholder.userData.hot;
            organ.placeholder.scale.setScalar(organ.placeholder.userData.baseScale * (hot ? 1.35 : pulse));
            organ.placeholder.material.emissiveIntensity = hot ? 1.4 : 0.6;
        }
        // Wartende Organe in der Ablage drehen sich langsam
        for (const organ of organs) {
            if (!organ.placed && organ !== dragging) organ.group.rotation.y += dt * 0.4;
        }
    }
    requestAnimationFrame(tick);

    // ---------------------------------------------------------------- Picking & Drag
    function setPointer(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
            -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
    }

    function pickOrgan(event) {
        setPointer(event);
        const candidates = organs.filter(o => !o.placed).map(o => o.group);
        const hit = raycaster.intersectObjects(candidates, true)[0];
        if (hit) return organs.find(o => o.lod3Id === hit.object.userData.organId);
        // Fallback: dünne Organe (z. B. Bronchialbaum) sind schwer zu treffen –
        // dann das nächste Organ in der Ablage im Umkreis von 45 px nehmen
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let best = null;
        let bestDistance = 45;
        for (const organ of organs) {
            if (organ.placed) continue;
            const p = screenPos(organ.group.position);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestDistance) { best = organ; bestDistance = d; }
        }
        return best;
    }

    function screenPos(world) {
        const rect = canvas.getBoundingClientRect();
        tmp.copy(world).project(camera);
        return { x: (tmp.x + 1) / 2 * rect.width, y: (1 - tmp.y) / 2 * rect.height, behind: tmp.z > 1 };
    }

    // Nächster freier Platzhalter unter dem gezogenen Organ (in Bildschirm-Pixeln)
    function placeholderUnder(organ) {
        const p = screenPos(organ.group.position);
        let best = null;
        let bestDistance = Infinity;
        for (const other of organs) {
            if (other.placed) continue;
            const q = screenPos(other.target);
            if (q.behind) continue;
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < SNAP_PIXELS && d < bestDistance) { best = other; bestDistance = d; }
        }
        return best;
    }

    function setHover(organ) {
        if (hovered === organ) return;
        if (hovered && hovered !== dragging) hovered.material.emissive.setHex(0x000000);
        hovered = organ;
        if (organ) organ.material.emissive.setHex(0x3a3a3a);
        canvas.style.cursor = organ ? 'grab' : '';
    }

    function onPointerDown(event) {
        if (!active || event.button !== 0 || dragging || ui.isModalOpen()) return;
        const organ = pickOrgan(event);
        if (!organ) return;                       // daneben: OrbitControls übernimmt
        event.stopImmediatePropagation();
        event.preventDefault();
        controls.enabled = false;
        dragging = organ;
        dragging.pointerId = event.pointerId;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        tween(organ.group, { scale: Math.min(1, organ.trayScale * 1.25), duration: 0.25 });
        dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), organ.group.position);
        if (raycaster.ray.intersectPlane(dragPlane, tmp)) dragOffset.copy(organ.group.position).sub(tmp);
        ui.showTooltip(organ.label, event.clientX, event.clientY);
    }

    function onPointerMove(event) {
        if (!active) return;
        if (dragging) {
            if (event.pointerId !== dragging.pointerId) return;
            setPointer(event);
            if (raycaster.ray.intersectPlane(dragPlane, tmp)) dragging.group.position.copy(tmp.add(dragOffset));
            const under = placeholderUnder(dragging);
            for (const o of organs) o.placeholder.userData.hot = o === under;
            ui.showTooltip(dragging.label, event.clientX, event.clientY);
            event.stopImmediatePropagation();
            return;
        }
        if (ui.isModalOpen()) return;
        const organ = pickOrgan(event);
        setHover(organ);
        if (organ) ui.showTooltip(organ.label, event.clientX, event.clientY);
        else ui.hideTooltip();
    }

    function onPointerUp(event) {
        if (!dragging || event.pointerId !== dragging.pointerId) return;
        const organ = dragging;
        const under = placeholderUnder(organ);
        endDrag();
        event.stopImmediatePropagation();
        if (!under) {
            tween(organ.group, { position: organ.traySlot, scale: organ.trayScale });
            return;
        }
        if (under === organ) return placeCorrect(organ);
        organ.tries++;
        wrongDrops++;
        const twin = under.entry.id === organ.entry.id;
        ui.toast(twin
            ? `Fast! Das ist der Platz für ${under.label}. Links/rechts gilt aus Sicht des Körpers.`
            : `Nicht ganz – hier gehört ${ARTICLE[organ.entry.id] || 'das'} ${organ.label} nicht hin.`, 'bad');
        tween(organ.group, { position: organ.traySlot, scale: organ.trayScale, duration: 0.8 });
    }

    function endDrag() {
        if (!dragging) return;
        const id = dragging.pointerId;
        dragging.material.emissive.setHex(0x000000);
        dragging = null;
        hovered = null;
        controls.enabled = true;
        canvas.style.cursor = '';
        ui.hideTooltip();
        for (const o of organs) o.placeholder.userData.hot = false;
        if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }

    function placeCorrect(organ) {
        organ.placed = true;
        organ.placeholder.visible = false;
        organ.group.rotation.set(0, 0, 0);
        points += organ.tries === 0 ? POINTS.placeFirstTry : POINTS.placeLater;
        updateStats();
        tween(organ.group, {
            position: organ.target, scale: 1, duration: 0.7, onDone: () => {
                // Kurzes Aufleuchten als Bestätigung
                organ.material.emissive.setHex(0x2f7a3f);
                setTimeout(() => organ.material.emissive.setHex(0x000000), 450);
                // Zwillinge (Lunge, Niere) teilen sich Steckbrief und Quiz
                const twinDone = organs.some(o => o !== organ && o.entry.id === organ.entry.id && o.placed && o.quizDone);
                if (twinDone) {
                    ui.toast(`✅ ${organ.label} – richtig! Den Steckbrief kennst du schon.`, 'good');
                    return checkFinished();
                }
                organ.quizDone = true;
                ui.showPortfolio(organ.entry, COLORS[organ.entry.id], correct => {
                    points += correct * POINTS.quizCorrect;
                    updateStats();
                    checkFinished();
                });
            },
        });
    }

    function checkFinished() {
        if (organs.every(o => o.placed)) {
            ui.showFinal({ points, maxPoints: maxPoints(), wrongDrops, onAgain: shuffle, onExit: exit });
        }
    }

    // capture: true, damit wir vor OrbitControls entscheiden können
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove, true);
    canvas.addEventListener('pointerup', onPointerUp, true);
    canvas.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dragging) {
            const organ = dragging;
            endDrag();
            tween(organ.group, { position: organ.traySlot, scale: organ.trayScale });
        }
    });

    // Für Tests/Debugging in der Browser-Konsole: window.organGame
    return {
        start, exit,
        get organs() { return organs; },
        get points() { return points; },
        // Bildschirmposition (Pixel im Canvas) eines Organs und seines Zielplatzes – für Tests
        debugScreen(lod3Id) {
            const organ = organs.find(o => o.lod3Id === lod3Id);
            return organ && { organ: screenPos(organ.group.position), target: screenPos(organ.target) };
        },
    };
}
