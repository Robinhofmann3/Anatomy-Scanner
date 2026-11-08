// Die Minispiele der Organ-Party. Jedes Spiel ist eine async-Funktion play({ stage, ui, player })
// und liefert { points, detail } zurück. Es steuert nur die Bühne (stage.js) und die Oberfläche.
import * as THREE from 'three';
import { COLORS, ARTICLE, CM_PER_UNIT, shuffled } from './stage.js';

const SNAP_PIXELS = 70;
const CLICK_PIXELS = 6;
const CLUE_FIELDS = ['superkraft', 'dasMagIchGarNicht', 'besterFreund', 'lieblingsspruch', 'wohnort'];
const CLUE_POINTS = [20, 16, 12, 8, 4];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const article = organ => ARTICLE[organ.entry.id] || 'das';

// n zufällige Organe mit unterschiedlichem Steckbrief (nicht beide Nieren in einer Runde)
function pickDistinct(organs, n) {
    const seen = new Set();
    const result = [];
    for (const organ of shuffled(organs)) {
        if (seen.has(organ.entry.id)) continue;
        seen.add(organ.entry.id);
        result.push(organ);
        if (result.length === n) break;
    }
    return result;
}

// Klick (kurz, kaum bewegt) von Kamera-Drehen unterscheiden
function clickDetector(onClick) {
    let down = null;
    return {
        pointerdown(event) { if (event.button === 0) down = { x: event.clientX, y: event.clientY, t: performance.now() }; },
        pointerup(event) {
            if (!down || event.button !== 0) return;
            const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
            const quick = performance.now() - down.t < 600;
            down = null;
            if (moved <= CLICK_PIXELS && quick) onClick(event);
        },
    };
}

// ------------------------------------------------------------------ 🧩 Organ-Puzzle / 🏆 Profi-Puzzle
function puzzle({ pro }) {
    return ({ stage, ui, player }) => new Promise(resolve => {
        const chosen = pickDistinct(stage.organs, 3);
        const state = new Map(chosen.map(o => [o, { placed: false, tries: 0 }]));
        stage.hideAll();
        stage.frontView();
        stage.putInTray(chosen);
        if (!pro) for (const o of chosen) o.placeholder.visible = true;

        let points = 0;
        let placedCount = 0;
        let quizCorrect = 0;
        let timeLeft = 45;
        let dragging = null;
        let finished = false;
        const plane = new THREE.Plane();
        const offset = new THREE.Vector3();
        const hit = new THREE.Vector3();

        const baseText = pro
            ? 'Zieh die 3 Organe an ihren Platz – ganz ohne Hilfskugeln!'
            : 'Zieh die 3 Organe an die leuchtenden Kugeln. Für jedes Organ gibt’s eine Quizfrage.';
        ui.showRound({ player, title: pro ? '🏆 Profi-Puzzle' : '🧩 Organ-Puzzle', text: pro ? `${baseText} ⏱ 45 s` : baseText });

        const open = () => chosen.filter(o => !state.get(o).placed);

        function finish(reason) {
            if (finished) return;
            finished = true;
            stage.setMode({});
            ui.hideTooltip();
            const quizPart = pro ? '' : ` · ${quizCorrect} Quizfrage${quizCorrect === 1 ? '' : 'n'} richtig`;
            resolve({ points, detail: `${reason} ${placedCount} von ${chosen.length} Organen platziert${quizPart}.` });
        }

        // Organ, dessen Zielplatz unter dem gezogenen Organ liegt (in Bildschirm-Pixeln)
        function targetUnder(organ) {
            const p = stage.screenPos(organ.group.position);
            let best = null;
            let bestDistance = SNAP_PIXELS;
            for (const other of open()) {
                const q = stage.screenPos(other.target);
                const d = Math.hypot(p.x - q.x, p.y - q.y);
                if (!q.behind && d < bestDistance) { best = other; bestDistance = d; }
            }
            return best;
        }

        function release(event) {
            const organ = dragging;
            dragging = null;
            organ.dragging = false;
            stage.controls.enabled = true;
            stage.canvas.style.cursor = '';
            ui.hideTooltip();
            for (const o of chosen) o.placeholder.userData.hot = false;
            if (event && stage.canvas.hasPointerCapture(event.pointerId)) stage.canvas.releasePointerCapture(event.pointerId);
            return organ;
        }

        async function placeCorrect(organ) {
            const s = state.get(organ);
            s.placed = true;
            organ.inTray = false;
            organ.placeholder.visible = false;
            organ.group.rotation.set(0, 0, 0);
            placedCount++;
            const gained = pro ? 15 : s.tries === 0 ? 10 : 5;
            points += gained;
            ui.toast(`✅ ${organ.label} sitzt! +${gained}`, 'good');
            stage.tween(organ.group, { position: organ.target, scale: 1, duration: 0.7 });
            await wait(750);
            if (!pro && !finished) {
                const question = organ.entry.quiz[Math.floor(Math.random() * organ.entry.quiz.length)];
                const correct = await ui.showPortfolio(organ.entry, COLORS[organ.entry.id], { questions: [question] });
                quizCorrect += correct;
                points += correct * 5;
            }
            if (!open().length) finish('Alles an seinem Platz!');
        }

        stage.setMode({
            pointer: {
                pointerdown(event) {
                    if (event.button !== 0 || dragging || finished) return;
                    const organ = stage.pick(event, open());
                    if (!organ) return;                     // daneben: OrbitControls dreht die Kamera
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    dragging = organ;
                    organ.dragging = true;
                    stage.controls.enabled = false;
                    stage.canvas.setPointerCapture(event.pointerId);
                    stage.canvas.style.cursor = 'grabbing';
                    stage.tween(organ.group, { scale: Math.min(1, organ.trayScale * 1.25), duration: 0.25 });
                    plane.setFromNormalAndCoplanarPoint(
                        stage.camera.getWorldDirection(new THREE.Vector3()), organ.group.position);
                    if (stage.setPointer(event).ray.intersectPlane(plane, hit)) offset.copy(organ.group.position).sub(hit);
                    ui.showTooltip(organ.label, event.clientX, event.clientY);
                },
                pointermove(event) {
                    if (dragging) {
                        if (stage.setPointer(event).ray.intersectPlane(plane, hit)) dragging.group.position.copy(hit.add(offset));
                        if (!pro) {
                            const under = targetUnder(dragging);
                            for (const o of chosen) o.placeholder.userData.hot = o === under;
                        }
                        ui.showTooltip(dragging.label, event.clientX, event.clientY);
                        event.stopImmediatePropagation();
                        return;
                    }
                    const organ = stage.pick(event, open());
                    stage.canvas.style.cursor = organ ? 'grab' : '';
                    if (organ) ui.showTooltip(organ.label, event.clientX, event.clientY);
                    else ui.hideTooltip();
                },
                pointerup(event) {
                    if (!dragging) return;
                    event.stopImmediatePropagation();
                    const organ = release(event);
                    const under = targetUnder(organ);
                    if (under === organ) return placeCorrect(organ);
                    if (under) {
                        state.get(organ).tries++;
                        ui.toast(under.entry.id === organ.entry.id
                            ? `Fast! Links/rechts gilt aus Sicht des Körpers.`
                            : `Nicht ganz – hier gehört ${article(organ)} ${organ.label} nicht hin.`, 'bad');
                    }
                    stage.tween(organ.group, { position: organ.traySlot, scale: organ.trayScale, duration: 0.7 });
                },
                pointercancel(event) {
                    if (!dragging) return;
                    const organ = release(event);
                    stage.tween(organ.group, { position: organ.traySlot, scale: organ.trayScale });
                },
            },
            frame(dt) {
                if (!pro || finished || stage.blocked) return;
                timeLeft -= dt;
                ui.updateRoundText(`${baseText} ⏱ ${Math.max(0, Math.ceil(timeLeft))} s`);
                if (timeLeft <= 0) {
                    if (dragging) release();
                    finish('⏰ Zeit abgelaufen!');
                }
            },
        });
    });
}

// ------------------------------------------------------------------ 📍 Wo ist das?
async function whereIs({ stage, ui, player }) {
    const chosen = pickDistinct(stage.organs, 3);
    stage.hideAll();
    stage.frontView();
    let points = 0;
    const results = [];
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xe5484d });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe5484d });

    for (const [i, organ] of chosen.entries()) {
        ui.showRound({ player, title: '📍 Wo ist das?',
            text: `Klicke dorthin, wo ${article(organ)} ${organ.label} liegt. (${i + 1}/${chosen.length})` });
        const event = await new Promise(resolve => stage.setMode({ pointer: clickDetector(resolve) }));
        stage.setMode({});
        const point = stage.pointOnPlane(event, organ.target);
        if (!point) continue;
        const cm = point.distanceTo(organ.target) * CM_PER_UNIT;
        const gained = Math.max(0, Math.round(15 - cm));
        points += gained;
        results.push(`${organ.label}: ${cm.toFixed(0)} cm`);

        // Auflösung: Organ erscheint am echten Ort, roter Punkt + Linie zeigen die Abweichung
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), markerMat);
        marker.position.copy(point);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([point, organ.target]), lineMat);
        stage.root.add(marker, line);
        stage.placeInBody([organ]);
        organ.group.scale.setScalar(0.01);
        stage.tween(organ.group, { scale: 1, duration: 0.6 });
        ui.toast(cm < 3 ? `🎯 Volltreffer! Nur ${cm.toFixed(1)} cm daneben – +${gained}`
            : `${cm.toFixed(0)} cm daneben – +${gained}`, gained >= 8 ? 'good' : gained > 0 ? '' : 'bad');
        await wait(2200);
        stage.root.remove(marker, line);
        marker.geometry.dispose();
        line.geometry.dispose();
        organ.group.visible = false;
    }
    return { points, detail: `Abweichungen: ${results.join(' · ')}.` };
}

// ------------------------------------------------------------------ 🕵️ Wer bin ich?
async function whoAmI({ stage, ui, player }) {
    stage.hideAll();
    stage.frontView();
    stage.placeInBody();
    const chosen = pickDistinct(stage.organs, 2);
    let points = 0;
    const results = [];

    for (const [i, organ] of chosen.entries()) {
        // Organname in den Hinweisen schwärzen (z. B. „Lungenbläschen“)
        const stem = new RegExp(`${organ.entry.name.slice(0, -1)}\\p{L}*`, 'giu');
        const clues = CLUE_FIELDS.map(f => organ.entry.freundebuch[f]).filter(Boolean)
            .map(text => text.replace(stem, '▇▇▇'));
        let shown = 1;
        const list = ui.el('ol', 'clue-list');
        const more = ui.button('Nächster Hinweis (−4)', () => reveal());
        const render = () => {
            list.replaceChildren(...clues.slice(0, shown).map(c => ui.el('li', '', c)));
            more.disabled = shown >= clues.length;
            ui.updateRoundText(`Wer bin ich? Klicke auf das Organ im Körper. (${i + 1}/${chosen.length}) · noch ${CLUE_POINTS[shown - 1]} Punkte möglich`);
        };
        const reveal = () => { if (shown < clues.length) { shown++; render(); } };
        ui.showRound({ player, title: '🕵️ Wer bin ich?', text: '', extra: [list, more] });
        render();

        const gained = await new Promise(resolve => {
            let hovered = null;
            const clicks = clickDetector(event => {
                const hit = stage.pick(event, stage.organs, 0);
                if (!hit) return;
                if (hit.entry.id === organ.entry.id) return resolve(CLUE_POINTS[shown - 1]);
                ui.toast(`Nein, das ist ${article(hit)} ${hit.entry.name}. Nächster Hinweis!`, 'bad');
                if (shown >= clues.length) return resolve(0);
                reveal();
            });
            stage.setMode({
                pointer: {
                    ...clicks,
                    pointermove(event) {
                        const hit = stage.pick(event, stage.organs, 0);
                        if (hovered === hit) return;
                        if (hovered) hovered.material.emissive.setHex(0x000000);
                        hovered = hit;
                        if (hit) hit.material.emissive.setHex(0x3a3a3a);
                        stage.canvas.style.cursor = hit ? 'pointer' : '';
                    },
                },
            });
        });
        stage.setMode({});
        for (const o of stage.organs) o.material.emissive.setHex(0x000000);
        points += gained;
        results.push(`${organ.entry.name}: ${gained > 0 ? `nach ${shown} Hinweis${shown === 1 ? '' : 'en'}` : 'nicht erraten'}`);
        organ.material.emissive.setHex(gained > 0 ? 0x2f7a3f : 0x7a2f2f);
        ui.toast(gained > 0 ? `✅ Richtig – ich bin ${article(organ)} ${organ.entry.name}! +${gained}`
            : `Aufgelöst: Es war ${article(organ)} ${organ.entry.name}.`, gained > 0 ? 'good' : 'bad');
        await wait(1800);
        organ.material.emissive.setHex(0x000000);
    }
    return { points, detail: results.join(' · ') + '.' };
}

// ------------------------------------------------------------------ 🔍 Lupen-Jagd
async function magnifierHunt({ stage, ui, player }) {
    const ring = stage.magnifier;
    if (!ring) return { points: 0, detail: 'Keine Lupe verfügbar.' };
    stage.hideAll();
    stage.setView('viewer');
    stage.frontView();
    const chosen = pickDistinct(stage.organs, 2);
    let points = 0;
    const results = [];
    const center = new THREE.Vector3();
    const edge = new THREE.Vector3();

    for (const [i, organ] of chosen.entries()) {
        const base = `Finde ${article(organ)} ${organ.label} mit der Lupe! Lupe am roten Rand oder Griff ziehen. (${i + 1}/${chosen.length})`;
        ui.showRound({ player, title: '🔍 Lupen-Jagd', text: base });
        const gained = await new Promise(resolve => {
            let elapsed = 0;
            let hold = 0;
            stage.setMode({
                frame(dt) {
                    if (stage.blocked) return;
                    elapsed += dt;
                    ring.getWorldPosition(center);
                    edge.set(1, 0, 0);
                    ring.localToWorld(edge);
                    const c = stage.screenPos(center);
                    const e = stage.screenPos(edge);
                    const t = stage.screenPos(organ.target);
                    const radius = Math.max(20, Math.hypot(e.x - c.x, e.y - c.y));
                    const d = Math.hypot(t.x - c.x, t.y - c.y) / radius;
                    hold = d < 0.75 ? hold + dt : 0;
                    const temp = d < 0.75 ? '🔥 Heiß – Lupe kurz still halten!' : d < 1.6 ? '♨️ Warm' : d < 3 ? '🌤 Lauwarm' : '🥶 Kalt';
                    ui.updateRoundText(`${base} ${temp} · ⏱ ${Math.max(0, Math.ceil(40 - elapsed))} s`);
                    if (hold >= 1) resolve(Math.max(5, Math.round(20 - elapsed / 2)));
                    else if (elapsed >= 40) resolve(0);
                },
            });
        });
        stage.setMode({});
        points += gained;
        results.push(`${organ.label}: ${gained ? `+${gained}` : 'nicht gefunden'}`);
        ui.toast(gained ? `🔍 Gefunden! +${gained}` : `⏰ Zeit um – ${article(organ)} ${organ.label} hat sich gut versteckt.`,
            gained ? 'good' : 'bad');
        await wait(1500);
    }
    stage.setView('stage');
    return { points, detail: results.join(' · ') + '.' };
}

export const GAMES = [
    { id: 'puzzle', icon: '🧩', title: 'Organ-Puzzle', color: '#2462c5',
      teaser: '3 Organe an die leuchtenden Kugeln ziehen, dazu je eine Quizfrage.', play: puzzle({ pro: false }) },
    { id: 'where', icon: '📍', title: 'Wo ist das?', color: '#2f9a5b',
      teaser: 'Klick auf die Stelle, wo das Organ liegt – jeder Zentimeter zählt.', play: whereIs },
    { id: 'who', icon: '🕵️', title: 'Wer bin ich?', color: '#8e44ad',
      teaser: 'Errate das Organ aus Freundebuch-Hinweisen. Je weniger Hinweise, desto mehr Punkte.', play: whoAmI },
    { id: 'hunt', icon: '🔍', title: 'Lupen-Jagd', color: '#d98a00',
      teaser: 'Such das Organ mit der Röntgen-Lupe unter der Haut.', play: magnifierHunt },
    { id: 'pro', icon: '🏆', title: 'Profi-Puzzle', color: '#c62f3a',
      teaser: '3 Organe in 45 Sekunden platzieren – ohne Hilfskugeln!', play: puzzle({ pro: true }) },
];

