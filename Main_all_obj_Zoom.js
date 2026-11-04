import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

import { createLights } from './lights.js';

import {
    createAlleModelle,
    createRing,
    getPartName
} from './objects_all_obj_Zoom.js';


// ========================================
// KLEINE UI-HELFER
// ========================================

function createLoadingLabel() {

    const label = document.createElement('div');

    label.style.cssText =
        'position:fixed;top:10px;left:10px;padding:6px 10px;' +
        'background:rgba(0,0,0,0.6);color:#fff;font-family:sans-serif;' +
        'font-size:13px;border-radius:4px;z-index:10;';

    label.textContent = 'Lade Modelle ...';

    document.body.appendChild(label);

    return label;

}


function createLayerPanel() {

    const panel = document.createElement('div');

    panel.style.cssText =
        'position:fixed;bottom:15px;left:50%;transform:translateX(-50%);' +
        'padding:8px 14px;background:rgba(0,0,0,0.6);color:#fff;' +
        'font-family:sans-serif;font-size:13px;border-radius:6px;' +
        'z-index:10;text-align:center;';

    const label = document.createElement('div');

    label.textContent = 'Schichten werden berechnet ...';

    const slider = document.createElement('input');

    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 1;
    slider.value = 0;
    slider.style.width = '300px';

    panel.appendChild(label);
    panel.appendChild(slider);

    document.body.appendChild(panel);

    return { label, slider };

}


// ========================================
// INITIALISIERUNG
// ========================================

function init() {


    // ========================================
    // SZENE
    // ========================================

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0xEEEEEE);


    // ========================================
    // KAMERA
    // ========================================

    const camera = new THREE.PerspectiveCamera(

        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000

    );

    camera.position.set(0, 12, 40);


    // ========================================
    // RENDERER
    // ========================================

  const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(1);

    renderer.setSize(

        window.innerWidth,
        window.innerHeight

    );

    renderer.shadowMap.enabled = false;

    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById("WebGL-output")
        .appendChild(renderer.domElement);


    // ========================================
    // ORBIT CONTROLS
    // ========================================

    const controls = new OrbitControls(

        camera,
        renderer.domElement

    );

    controls.target.set(0, 10, 0);

    controls.enableDamping = true;

    controls.dampingFactor = 0.05;

    // Kamera darf nicht zu nah an den Körper,
    // sonst rutscht der Ring hinein
    controls.minDistance = 10;

    controls.update();


    // ========================================
    // RING-EINSTELLUNGEN
    // ========================================

    const RING_RADIUS = 1;

    // Dicke der Ringröhre (muss zu createRing passen)
    const RING_TUBE = 0.04;

    // Anteil des Weges von der Kamera zum Körpermittelpunkt
    // (0.5 = halbe Strecke, kleiner = näher an der Kamera)
    const RING_DISTANCE_FACTOR = 0.5;


    // ========================================
    // SICHTFENSTER-DATEN
    // ========================================

    const cutout = {

        center: new THREE.Vector3(0, 10, 5),

        axisX: new THREE.Vector3(1, 0, 0),

        axisY: new THREE.Vector3(0, 1, 0),

        // Loch = Ringradius minus Röhrendicke
        radius: RING_RADIUS - RING_TUBE,

        // Gemeinsame Tiefenschwelle (Abstand von der Kamera),
        // wird vom Slider gesetzt. 0 = nichts ausgeblendet
        depth: { value: 0 }

    };


    // ========================================
    // BELEUCHTUNG
    // ========================================

    createLights(scene);


    // ========================================
    // SCHICHTEN-STATUS (vor dem Laden anlegen)
    // ========================================

    const raycaster = new THREE.Raycaster();

    // [{ id, distance }] sortiert nach Abstand zur Kamera
    let layers = [];

    let layersDirty = true;

    let lastChange = 0;

    let sliderInitialized = false;


    // ========================================
    // ALLE OBJ-DATEIEN LADEN (inkl. Haut)
    // ========================================

    const loadingLabel = createLoadingLabel();
    const anatomie = createAlleModelle(

        scene,
        cutout,

        (geladen, fehler, gesamt) => {

            loadingLabel.textContent =
                'Lade Modelle: ' + (geladen + fehler) + ' / ' + gesamt +
                (fehler > 0 ? ' (' + fehler + ' fehlgeschlagen)' : '');

            if (geladen + fehler === gesamt) {

                layersDirty = true;

                lastChange = performance.now();

                setTimeout(() => loadingLabel.remove(), 3000);

                // Schichten einmal nach dem Laden berechnen
                setTimeout(() => computeLayers(), 100);

            }

        }

    );


    // ========================================
    // RING ERSTELLEN
    // ========================================

    const ring = createRing(scene, RING_RADIUS);

    // Verschiebung des Rings auf dem Bildschirm (Kamerakoordinaten)
    const ringOffset = new THREE.Vector2(0, 0);

    function updateRingFromCamera() {

        camera.updateMatrixWorld(true);

        const distance =
            camera.position.distanceTo(controls.target) *
            RING_DISTANCE_FACTOR;

        // Position: immer ein Stück vor der Kamera plus Verschiebung
        ring.position
            .set(ringOffset.x, ringOffset.y, -distance)
            .applyMatrix4(camera.matrixWorld);

        // Ring zeigt immer genau auf die Kamera
        ring.lookAt(camera.position);

        ring.updateMatrixWorld(true);

    }

    updateRingFromCamera();


    // ========================================
    // DRAG CONTROLS
    // ========================================

    const dragControls = new DragControls(

        [ring],
        camera,
        renderer.domElement

    );

    dragControls.addEventListener('dragstart', () => {

        controls.enabled = false;

    });

    // Beim Ziehen nur die Bildschirm-Verschiebung merken
    dragControls.addEventListener('drag', () => {

        const local = camera.worldToLocal(ring.position.clone());

        ringOffset.set(local.x, local.y);

    });

    dragControls.addEventListener('dragend', () => {

        controls.enabled = true;

    });


    // ========================================
    // SCHICHTEN HINTER DEM RING + SLIDER
    // ========================================

    const { label, slider } = createLayerPanel();

    function applyDepth() {

        const n = Number(slider.value);

        if (layers.length === 0 || n === 0) {

            cutout.depth.value = 0;

            label.textContent = 'Nichts ausgeblendet';

        } else if (n >= layers.length) {

            cutout.depth.value = 1e9;

            label.textContent =
                'Alle ' + layers.length + ' Schichten ausgeblendet';

        } else {

            // Alles vor dem Eintritt der nächsten Schicht ausblenden
            cutout.depth.value = layers[n].distance - 0.001;

            label.textContent =
                n + ' / ' + layers.length +
                ' ausgeblendet. Nächste Schicht: ' +
                getPartName(layers[n].id);

        }

    }

    function computeLayers() {

        // Strahl von der Kamera durch die Ringmitte
        const origin = camera.position.clone();

        const direction = cutout.center.clone().sub(origin).normalize();

        raycaster.set(origin, direction);

        const hits = raycaster.intersectObject(anatomie, true);

        const seen = new Set();

        layers = [];

        hits.forEach((hit) => {

            // Zum obersten Objekt (eine FJ-Datei) hochgehen
            let obj = hit.object;

            while (obj.parent && obj.parent !== anatomie) {
                obj = obj.parent;
            }

            // Nur den ersten Treffer pro Teil zählen (Vorderseite)
            if (!seen.has(obj.name)) {

                seen.add(obj.name);

                layers.push({ id: obj.name, distance: hit.distance });

            }

        });

        slider.max = layers.length;

        // Beim ersten Mal die Haut (Schicht 1) ausblenden
        if (!sliderInitialized && layers.length > 0) {

            slider.value = 1;

            sliderInitialized = true;

        }

        if (Number(slider.value) > layers.length) {
            slider.value = layers.length;
        }

        applyDepth();

    }

    slider.addEventListener('input', applyDepth);


    // ========================================
    // ANIMATION
    // ========================================

    const lastCamPos = new THREE.Vector3();
    const lastCamQuat = new THREE.Quaternion();
    const lastRingPos = new THREE.Vector3();

    function animate() {

        requestAnimationFrame(animate);

        // Kamera aktualisieren
        controls.update();

        // Ring vor der Kamera positionieren und ausrichten
        updateRingFromCamera();

        // Ringdaten für den Shader
        ring.getWorldPosition(cutout.center);

        cutout.axisX.setFromMatrixColumn(ring.matrixWorld, 0).normalize();

        cutout.axisY.setFromMatrixColumn(ring.matrixWorld, 1).normalize();

        // Hat sich etwas bewegt?
        if (!camera.position.equals(lastCamPos) ||
            !camera.quaternion.equals(lastCamQuat) ||
            !cutout.center.equals(lastRingPos)) {

            lastCamPos.copy(camera.position);
            lastCamQuat.copy(camera.quaternion);
            lastRingPos.copy(cutout.center);

            layersDirty = true;

            lastChange = performance.now();

        }
        // nach slider.addEventListener('input', applyDepth);
        slider.addEventListener('pointerdown', () => {

            if (layersDirty) {

                layersDirty = false;

                computeLayers();

            }

        });

        // Szene rendern
        renderer.render(scene, camera);

    }

    animate();


    // ========================================
    // FENSTERGRÖSSE ANPASSEN
    // ========================================

    window.addEventListener('resize', () => {

        camera.aspect = window.innerWidth / window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(

            window.innerWidth,
            window.innerHeight

        );

    });

}


// ========================================
// START
// ========================================

window.onload = init;