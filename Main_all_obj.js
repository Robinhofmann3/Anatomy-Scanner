import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMagnifier, attachMagnifierDrag } from './magnifier.js';
import { createViewControls } from './viewControls.js';

import { createLights } from './lights.js';

import {
    createCatalogModels
} from './objects_all_obj_organs.js';
import { loadAnatomyCatalog } from './anatomyCatalog.js';
import { createCategoryPanel } from './categoryPanel.js';


// ========================================
// LADEANZEIGE
// ========================================

function createLoadingLabel() {

    const label = document.createElement('div');

    label.style.position = 'fixed';
    label.style.top = '10px';
    label.style.left = '10px';
    label.style.padding = '6px 10px';
    label.style.background = 'rgba(0, 0, 0, 0.6)';
    label.style.color = '#ffffff';
    label.style.fontFamily = 'sans-serif';
    label.style.fontSize = '13px';
    label.style.borderRadius = '4px';
    label.style.zIndex = '10';

    label.textContent = 'Lade Modelle ...';

    document.body.appendChild(label);

    return label;

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

    const renderer = new THREE.WebGLRenderer({

        antialias: true

    });

    renderer.setSize(

        window.innerWidth,
        window.innerHeight

    );

    renderer.shadowMap.enabled = true;

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
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    controls.update();


    // ========================================
    // SICHTFENSTER-DATEN
    // ========================================

const cutout = {
    center: new THREE.Vector3(0, 10, 5),
    axisX: new THREE.Vector3(1, 0, 0),
    axisY: new THREE.Vector3(0, 1, 0),
    radius: 0.96,
    depth: { value: 0 }
};


    // ========================================
    // BELEUCHTUNG
    // ========================================

    createLights(scene);


    // ========================================
    // ALLE OBJ-DATEIEN LADEN (inkl. Haut)
    // ========================================

    const loadingLabel = createLoadingLabel();

    loadAnatomyCatalog().then(catalog => {
        let panel;
        let latestProgress;
        const models = createCatalogModels(scene, cutout,
            catalog.models.filter(model => model.source === catalog.defaultSource),
            progress => {
                latestProgress = progress;
                panel?.setProgress(progress);
            });
        panel = createCategoryPanel(catalog, selected => models.setSelected(selected));
        // Refresh once the panel reference exists (initial selection is synchronous).
        panel.setProgress(latestProgress);
        loadingLabel.remove();
    }).catch(error => {
        loadingLabel.textContent = 'Kategorien konnten nicht geladen werden. Bitte Seite neu laden.';
        console.error(error);
    });


      // ========================================
    // RING ERSTELLEN
    // ========================================

    const ring = createMagnifier(scene, cutout);

    // Anteil des Weges von der Kamera zum Körpermittelpunkt
    // (0.5 = Ring sitzt auf halber Strecke, kleiner = näher an der Kamera)
    const RING_DISTANCE_FACTOR = 0.5;

    // Verschiebung des Rings auf dem Bildschirm (Kamerakoordinaten)
    const ringOffset = new THREE.Vector2(0, 0);

    // Kamera darf nicht zu nah an den Körper, sonst rutscht der Ring hinein
    controls.minDistance = 10;

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

    attachMagnifierDrag(ring, camera, renderer.domElement, controls, ringOffset);
    const viewControls = createViewControls({ magnifier: ring, camera,
        canvas: renderer.domElement, controls, onReset: () => {
        controls.reset();
        camera.position.set(0, 12, 40);
        controls.target.set(0, 10, 0);
        controls.update();
        ringOffset.set(0, 0);
        viewControls.resetSize();
        updateRingFromCamera();
    } });


    // ========================================
    // ANIMATION
    // ========================================

    function animate() {

        requestAnimationFrame(animate);

        controls.update();

        // Ring jedes Frame vor der Kamera positionieren und ausrichten
        updateRingFromCamera();
        viewControls.updatePosition();

        ring.getWorldPosition(cutout.center);

        cutout.axisX.setFromMatrixColumn(ring.matrixWorld, 0).normalize();

        cutout.axisY.setFromMatrixColumn(ring.matrixWorld, 1).normalize();

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
