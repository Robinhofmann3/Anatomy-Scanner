// Spiel-Bühne: lädt Geisterkörper + Spielorgane, verwaltet Animationen, Picking und
// Zeiger-Ereignisse. Die einzelnen Minispiele (modes.js) steuern die Bühne nur noch.
//
// CG-Komponenten: Hierarchie (Organ = Gruppe aus OBJ-Einzelteilen mit Drehpunkt in der Mitte),
// Picking (Raycaster), Manipulation (Drag auf kameraparalleler Ebene), Animation (Tweens).
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Gleiche Transformation wie prepareModel() im Viewer (BodyParts3D: mm, z nach oben)
const MODEL_ROTATION_X = -Math.PI / 2;
const MODEL_SCALE = 20 / 1641;
export const CM_PER_UNIT = 1641 / 20 / 10;     // 1 Szeneneinheit ≈ 8,2 cm
const MAX_PARALLEL = 8;
const TRAY_MAX_SIZE = 2.4;

export const COLORS = {
    gehirn: '#e8a3b4', herz: '#c62f3a', lunge: '#f08a9a', leber: '#8e2f2a', magen: '#e99a7a',
    duenndarm: '#f2b08c', dickdarm: '#b9785a', niere: '#a3383f', harnblase: '#e8c35a',
};

export const ARTICLE = {
    gehirn: 'das', herz: 'das', lunge: 'die', leber: 'die', magen: 'der',
    duenndarm: 'der', dickdarm: 'der', niere: 'die', harnblase: 'die',
};

function isOrientationBone(record) {
    return record.categoryId === 'skeleton.axial' || record.categoryId === 'skeleton.skull'
        || (record.categoryId === 'skeleton.limbs' && /hip bone|clavicle|scapula/i.test(record.nameEn));
}

function sideLabel(lod3Id) {
    if (lod3Id.endsWith('_links')) return 'links';
    if (lod3Id.endsWith('_rechts')) return 'rechts';
    return '';
}

export function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function createStage({ scene, camera, controls, canvas, catalog, viewerGroup, magnifier }) {
    const root = new THREE.Group();
    root.name = 'ORGAN_GAME';
    root.visible = false;
    scene.add(root);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const tmp = new THREE.Vector3();
    const tweens = [];
    const organs = [];
    const savedCamera = { position: new THREE.Vector3(), target: new THREE.Vector3() };
    let loading = null;
    let handlers = {};          // Zeiger-Handler des aktiven Minispiels
    let frameHooks = new Set(); // pro Frame aufgerufene Funktionen des aktiven Minispiels

    // ------------------------------------------------------------ Laden
    function modelSpace() {
        const inner = new THREE.Group();
        inner.rotation.x = MODEL_ROTATION_X;
        inner.scale.setScalar(MODEL_SCALE);
        return inner;
    }

    function loadParts(records, onEach) {
        const loader = new OBJLoader();
        const cache = new Map();
        for (const child of viewerGroup?.children || []) {
            if (child.userData.catalogKey) cache.set(child.userData.catalogKey, child);
        }
        const queue = [...records];
        const results = new Map();
        return new Promise(resolve => {
            let running = 0;
            const pump = () => {
                while (running < MAX_PARALLEL && queue.length) {
                    const record = queue.shift();
                    const cached = cache.get(record.key);
                    if (cached) {     // im Viewer schon geladen: Geometrie teilen statt neu laden
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
                        console.warn('Organ-Spiel: Teil fehlt', record.path, error);
                        running--; onEach(); pump();
                    });
                }
                if (!queue.length && !running) resolve(results);
            };
            pump();
        });
    }

    async function build(onProgress) {
        const [hierarchy, portfolio] = await Promise.all([
            fetch(new URL('../Data/organ-hierarchy.json', import.meta.url)).then(r => r.json()),
            fetch(new URL('../Data/organ-portfolio.json', import.meta.url)).then(r => r.json()),
        ]);
        const records = new Map(catalog.models.map(m => [m.key, m]));
        const portfolioByLod3 = new Map();
        for (const entry of portfolio.organs) for (const id of entry.lod3Ids) portfolioByLod3.set(id, entry);
        const gameNodes = hierarchy.nodes.filter(n => n.level === 3 && n.game && portfolioByLod3.has(n.id));
        const own = catalog.models.filter(m => m.source === hierarchy.source);
        const skin = own.filter(m => m.categoryId === 'skin');
        const bones = own.filter(isOrientationBone);
        const wanted = [...skin, ...bones,
            ...gameNodes.flatMap(n => n.modelKeys.map(k => records.get(k)).filter(Boolean))];
        let done = 0;
        const parts = await loadParts(wanted, () => onProgress?.(++done / wanted.length));

        // Geisterhaut + Skelett zur Orientierung
        const body = modelSpace();
        const ghost = (color, opacity) => new THREE.MeshStandardMaterial({
            color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 });
        const skinMat = ghost(0xe6bea0, 0.14);
        const boneMat = ghost(0xf4f1ea, 0.35);
        for (const record of [...skin, ...bones]) {
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
        for (const node of gameNodes) {
            const entry = portfolioByLod3.get(node.id);
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
            inner.position.copy(target).negate();     // Drehpunkt in die Organmitte
            group.position.copy(target);

            const placeholder = new THREE.Mesh(placeholderGeo, new THREE.MeshStandardMaterial({
                color: 0x7fd3ff, emissive: 0x2a8fd0, emissiveIntensity: 0.6,
                transparent: true, opacity: 0.55, depthWrite: false }));
            const radius = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.22, 0.35, 1.0);
            placeholder.userData.baseScale = radius;
            placeholder.position.copy(target);
            placeholder.renderOrder = 3;
            placeholder.visible = false;
            root.add(placeholder);

            const side = sideLabel(node.id);
            organs.push({
                lod3Id: node.id, entry, material, group, target, placeholder,
                label: side ? `${entry.name} (${side})` : entry.name,
                trayScale: Math.min(1, TRAY_MAX_SIZE / Math.max(size.x, size.y, size.z)),
                traySlot: new THREE.Vector3(), inTray: false,
            });
        }
    }

    // ------------------------------------------------------------ Animation
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
        if (!stage.active) return;
        for (let i = tweens.length - 1; i >= 0; i--) {
            const tw = tweens[i];
            tw.t = Math.min(1, tw.t + dt / tw.duration);
            const k = easeOutBack(tw.t);
            if (tw.movesPosition) tw.object.position.lerpVectors(tw.fromPos, tw.toPos, k);
            tw.object.scale.setScalar(tw.fromScale + (tw.toScale - tw.fromScale) * k);
            if (tw.t >= 1) { tweens.splice(i, 1); tw.onDone?.(); }
        }
        const pulse = 1 + 0.12 * Math.sin(now / 260);
        for (const organ of organs) {
            const p = organ.placeholder;
            if (p.visible) {
                const hot = p.userData.hot;
                p.scale.setScalar(p.userData.baseScale * (hot ? 1.35 : pulse));
                p.material.emissiveIntensity = hot ? 1.4 : 0.6;
            }
            if (organ.inTray && !organ.dragging) organ.group.rotation.y += dt * 0.4;
        }
        for (const hook of frameHooks) hook(dt, now);
    }
    requestAnimationFrame(tick);

    // ------------------------------------------------------------ Zeiger
    function setPointer(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
            -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster;
    }
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        // capture: true – das Minispiel entscheidet vor OrbitControls, ob es den Klick braucht
        canvas.addEventListener(type, event => {
            if (stage.active && !stage.blocked) handlers[type]?.(event);
        }, true);
    }

    function screenPos(world) {
        const rect = canvas.getBoundingClientRect();
        tmp.copy(world).project(camera);
        return { x: (tmp.x + 1) / 2 * rect.width, y: (1 - tmp.y) / 2 * rect.height, behind: tmp.z > 1 };
    }

    // Organ unter dem Zeiger; Fallback im Bildschirm-Umkreis für dünne Organe (Bronchialbaum)
    function pick(event, candidates, fallbackPixels = 45) {
        setPointer(event);
        const hit = raycaster.intersectObjects(candidates.map(o => o.group), true)[0];
        if (hit) return candidates.find(o => o.lod3Id === hit.object.userData.organId);
        if (!fallbackPixels) return null;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let best = null;
        let bestDistance = fallbackPixels;
        for (const organ of candidates) {
            const p = screenPos(organ.group.position);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestDistance) { best = organ; bestDistance = d; }
        }
        return best;
    }

    // Klickpunkt auf eine kameraparallele Ebene durch "through" projizieren
    function pointOnPlane(event, through) {
        setPointer(event);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()), through);
        const point = new THREE.Vector3();
        return raycaster.ray.intersectPlane(plane, point) ? point : null;
    }

    // ------------------------------------------------------------ Zustände der Organe
    function hideAll() {
        for (const o of organs) {
            o.group.visible = false;
            o.placeholder.visible = false;
            o.placeholder.userData.hot = false;
            o.inTray = false;
            o.material.emissive.setHex(0x000000);
        }
    }
    function placeInBody(list = organs) {
        for (const o of list) {
            o.group.visible = true;
            o.inTray = false;
            o.group.rotation.set(0, 0, 0);
            o.group.position.copy(o.target);
            o.group.scale.setScalar(1);
        }
    }
    function putInTray(list) {
        const perSide = Math.ceil(list.length / 2);
        shuffled(list).forEach((o, i) => {
            const left = i < perSide;
            const row = left ? i : i - perSide;
            const rows = left ? perSide : list.length - perSide;
            const y = rows === 1 ? 10 : 15 - row * (10 / Math.max(1, rows - 1));
            o.traySlot.set(left ? -8.5 : 8.5, y, 1.5);
            o.group.visible = true;
            o.inTray = true;
            o.group.rotation.set(0, 0, 0);
            o.group.position.copy(o.traySlot);
            o.group.scale.setScalar(o.trayScale);
        });
    }
    function frontView() {
        camera.position.set(0, 11, 36);
        controls.target.set(0, 10, 0);
        controls.update();
    }

    // Lupen-Ansicht: echter Viewer mit Haut + Lupe statt Geisterkörper
    function setView(view) {
        const viewer = view === 'viewer';
        root.visible = !viewer;
        if (viewerGroup) viewerGroup.visible = viewer;
        magnifier?.traverse(o => o.layers.set(viewer ? 0 : 31));
    }

    const stage = {
        active: false,
        blocked: false,         // true, solange ein Dialog offen ist
        organs, root, camera, controls, canvas, magnifier,
        ensureLoaded(onProgress) {
            if (!loading) loading = build(onProgress).catch(error => { loading = null; throw error; });
            return loading;
        },
        enter() {
            stage.active = true;
            savedCamera.position.copy(camera.position);
            savedCamera.target.copy(controls.target);
            document.body.classList.add('game-active');
            setView('stage');
            hideAll();
            frontView();
        },
        exit() {
            stage.clearMode();
            stage.active = false;
            root.visible = false;
            if (viewerGroup) viewerGroup.visible = true;
            magnifier?.traverse(o => o.layers.set(0));
            document.body.classList.remove('game-active');
            camera.position.copy(savedCamera.position);
            controls.target.copy(savedCamera.target);
            controls.enabled = true;
            controls.update();
        },
        // Ein Minispiel registriert seine Handler; clearMode räumt alles wieder ab
        setMode({ pointer = {}, frame } = {}) {
            handlers = pointer;
            frameHooks = new Set(frame ? [frame] : []);
        },
        clearMode() {
            handlers = {};
            frameHooks.clear();
            tweens.length = 0;
            controls.enabled = true;
            canvas.style.cursor = '';
            setView('stage');
            hideAll();
        },
        tween, screenPos, pick, pointOnPlane, setPointer, hideAll, placeInBody, putInTray, frontView, setView,
    };
    return stage;
}
