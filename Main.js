
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

import { createLights } from './lights.js';

import {
    createBody,
    createMagen,
    createRing,
    createMilz,
    createBauchspeicheldruese,
    createGallenblase,
    createRechteNiere,
    createLinkeNiere,
    createHarnblase,
    createZwoelffingerdarm,
    createLeber,
    createSpeiseroehre,
    createLuftroehre,
    createZwerchfell,
    createAppendix,
    createMastdarm,
    createAufsteigenderDickdarm,
    createQuerdickdarm,
    createAbsteigenderDickdarm,
    createDuennDarm,
    createHerzkammerwand,
    createRechterVorhof,
    createLinkerVorhof,
    createLinkerHauptbronchus,
    createRechterHauptbronchus,
    createTruncusPulmonalis,
    createRechteLungenarterie,
    createLinkeLungenarterie

} from './objects.js';


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

    controls.update();


    // ========================================
    // SICHTFENSTER-DATEN
    // ========================================

    const cutout = {

        center: new THREE.Vector3(0, 10, 5),

        axisX: new THREE.Vector3(1, 0, 0),

        axisY: new THREE.Vector3(0, 1, 0),

        radius: 0.96

    };


    // ========================================
    // BELEUCHTUNG
    // ========================================

    createLights(scene);


    // ========================================
    // HAUTMODELL LADEN
    // ========================================

    createBody(scene, cutout);


    // ========================================
    // MAGEN
    // ========================================

    createMagen(scene);


    // ========================================
    // BISHERIGE ANATOMIEMODELLE
    // ========================================

    createMilz(scene);

    createBauchspeicheldruese(scene);

    createGallenblase(scene);

    createRechteNiere(scene);

    createLinkeNiere(scene);

    createHarnblase(scene);

    createZwoelffingerdarm(scene);


    // ========================================
    // NEUE ANATOMIEMODELLE
    // ========================================

    // Speiseröhre
    createSpeiseroehre(scene);

    // Luftröhre
    createLuftroehre(scene);

    // Zwerchfell
    createZwerchfell(scene);

    // Appendix
    createAppendix(scene);

    // Mastdarm
    createMastdarm(scene);

    // Aufsteigender Dickdarm
    createAufsteigenderDickdarm(scene);

    // Querdickdarm
    createQuerdickdarm(scene);

    // Absteigender Dickdarm
    createAbsteigenderDickdarm(scene);

    //Leber 
    createLeber(scene);
    //Darm
    createDuennDarm(scene);
    //herz 

    createHerzkammerwand(scene);

    createRechterVorhof(scene);

    createLinkerVorhof(scene);

    // Atemwege und Lungengefäße
    createLinkerHauptbronchus(scene);
    createRechterHauptbronchus(scene);

    createTruncusPulmonalis(scene);
    createRechteLungenarterie(scene);
    createLinkeLungenarterie(scene);
    // ========================================
    // RING ERSTELLEN
    // ========================================

    const ring = createRing(scene);


    // ========================================
    // DRAG CONTROLS
    // ========================================

    const dragControls = new DragControls(

        [ring],
        camera,
        renderer.domElement

    );


    // Kamera beim Ziehen deaktivieren
    dragControls.addEventListener('dragstart', () => {

        controls.enabled = false;

    });


    // Kamera nach dem Ziehen aktivieren
    dragControls.addEventListener('dragend', () => {

        controls.enabled = true;

    });


    // ========================================
    // ANIMATION
    // ========================================

    function animate() {

        requestAnimationFrame(animate);

        // Kamera aktualisieren
        controls.update();

        // Weltmatrix des Rings aktualisieren
        ring.updateMatrixWorld(true);

        // Mittelpunkt des Rings auslesen
        ring.getWorldPosition(cutout.center);

        // X-Achse des Rings auslesen
        cutout.axisX.setFromMatrixColumn(

            ring.matrixWorld,
            0

        ).normalize();

        // Y-Achse des Rings auslesen
        cutout.axisY.setFromMatrixColumn(

            ring.matrixWorld,
            1

        ).normalize();

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
