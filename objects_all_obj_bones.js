
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const BASE_PATH = './Data/partof_BP3D_4.0_obj_99/partof_BP3D_4.0_obj_99/';

// Wie viele OBJ-Dateien gleichzeitig geladen werden
const MAX_PARALLEL = 8;

const SKIN_ID = 'FJ2810';


// ========================================
// GEMEINSAME MODELLPOSITIONIERUNG
// ========================================

function prepareModel(obj) {

    obj.rotation.x = -Math.PI / 2;
    obj.scale.setScalar(20 / 1641);

}


// ========================================
// DATEILISTE (aus dem cmd-Output)
// [von, bis, modus]
// 'p' = nur FJxxxx.obj
// 'b' = FJxxxx.obj und FJxxxxM.obj (gespiegelt)
// 'm' = nur FJxxxxM.obj
// ========================================

const ID_RANGES = [
    [2772, 2772, 'p'],
    [3152, 3201, 'p'],
    [3225, 3237, 'p'],
    [3240, 3241, 'p'],
    [3243, 3244, 'p'],
    [3246, 3247, 'p'],
    [3249, 3250, 'p'],
    [3252, 3253, 'p'],
    [3258, 3260, 'p'],
    [3262, 3267, 'p'],
    [3269, 3275, 'p'],
    [3277, 3277, 'p'],
    [3279, 3279, 'p'],
    [3281, 3282, 'p'],
    [3286, 3289, 'p'],
    [3291, 3332, 'p'],
    [3334, 3334, 'p'],
    [3336, 3336, 'p'],
    [3338, 3338, 'p'],
    [3340, 3340, 'p'],
    [3342, 3342, 'p'],
    [3344, 3344, 'p'],
    [3346, 3359, 'p'],
    [3362, 3362, 'p'],
    [3364, 3366, 'p'],
    [3368, 3373, 'p'],
    [3375, 3381, 'p'],
    [3384, 3384, 'p'],
    [3386, 3387, 'p'],
    [3391, 3395, 'p'],
];


function buildFileList() {

    const ids = [];

    ID_RANGES.forEach(([from, to, mode]) => {

        for (let n = from; n <= to; n++) {

            if (mode === 'p' || mode === 'b') ids.push('FJ' + n);
            if (mode === 'm' || mode === 'b') ids.push('FJ' + n + 'M');

        }

    });

    ids.push(SKIN_ID);
    return [...new Set(ids)];

}


// ========================================
// BEKANNTE ORGANE (Name + Farbe)
// ========================================

const KNOWN = {};

// Diese zuerst laden, damit man sie früh sieht
const PRIORITY = [SKIN_ID, ...Object.keys(KNOWN)];


// Farbe für alle übrigen Teile (stabil pro Dateiname)
function colorForId(id) {

    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    const color = new THREE.Color();

    color.setHSL(
        (hash % 360) / 360,
        0.25 + (hash % 20) / 100,
        0.55
    );

    return color;

}


// ========================================
// MATERIALIEN
// ========================================

function createSkinMaterial(cutout) {

    const material = new THREE.MeshStandardMaterial({

        color: 0xe6bea0,
        roughness: 0.7,
        side: THREE.DoubleSide

    });

    material.onBeforeCompile = (shader) => {

        shader.uniforms.uRingCenter = { value: cutout.center };
        shader.uniforms.uRingAxisX = { value: cutout.axisX };
        shader.uniforms.uRingAxisY = { value: cutout.axisY };
        shader.uniforms.uRingRadius = { value: cutout.radius };

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec3 vAnatomyWorldPosition;
            `
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>

            vAnatomyWorldPosition =
                (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>

            uniform vec3 uRingCenter;
            uniform vec3 uRingAxisX;
            uniform vec3 uRingAxisY;
            uniform float uRingRadius;

            varying vec3 vAnatomyWorldPosition;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `
            #include <clipping_planes_fragment>

            // Normale der Ring-Ebene
            vec3 ringNormal = normalize(cross(uRingAxisX, uRingAxisY));

            // Sehstrahl von der Kamera zum Hautpunkt
            vec3 viewRay = vAnatomyWorldPosition - cameraPosition;

            float denom = dot(viewRay, ringNormal);

            if (abs(denom) > 0.00001) {

                // Schnittpunkt des Sehstrahls mit der Ring-Ebene
                float t = dot(uRingCenter - cameraPosition, ringNormal) / denom;

                vec3 hit = cameraPosition + viewRay * t;

                vec3 ringDelta = hit - uRingCenter;

                float ringX = dot(ringDelta, uRingAxisX);
                float ringY = dot(ringDelta, uRingAxisY);

                float ringDistance = sqrt(ringX * ringX + ringY * ringY);

                if (ringDistance < uRingRadius) {
                    discard;
                }

            }
            `
        );

    };

    material.customProgramCacheKey = () => 'anatomy-ring-cutout-v1';

    material.needsUpdate = true;

    return material;

}


function createPartMaterial(id) {

    const baseId = id.endsWith('M') ? id.slice(0, -1) : id;

    const color = KNOWN[baseId]
        ? KNOWN[baseId].color
        : colorForId(id);

    return new THREE.MeshStandardMaterial({

        color: color,
        roughness: 0.8,
        side: THREE.DoubleSide

    });

}


// ========================================
// ALLE MODELLE LADEN
// onProgress(geladen, fehler, gesamt) wird nach jeder Datei aufgerufen
// ========================================

export function createAlleModelle(scene, cutout, onProgress) {

    const anatomie = new THREE.Group();

    anatomie.name = 'ANATOMIE';

    prepareModel(anatomie);

    scene.add(anatomie);

    const loader = new OBJLoader();

    // Priorisierte Dateien zuerst, Rest danach
    const alle = buildFileList();

    const queue = [
        ...PRIORITY.filter((id) => alle.includes(id)),
        ...alle.filter((id) => !PRIORITY.includes(id))
    ];

    const gesamt = queue.length;

    let geladen = 0;
    let fehler = 0;
    let naechster = 0;

    const fehlendeDateien = [];

    function meldeFortschritt() {

        if (onProgress) onProgress(geladen, fehler, gesamt);

        if (geladen + fehler === gesamt) {

            console.log(
                'Alle Modelle verarbeitet:',
                geladen, 'geladen,',
                fehler, 'fehlgeschlagen von', gesamt
            );

            if (fehlendeDateien.length > 0) {
                console.warn('Nicht geladen:', fehlendeDateien);
            }

        }

    }

    function ladeNaechste() {

        if (naechster >= queue.length) return;

        const id = queue[naechster++];

        loader.load(

            BASE_PATH + id + '.obj',

            (obj) => {

                obj.name = id;

                obj.traverse((child) => {

                    if (child.isMesh) {

                        child.geometry.computeVertexNormals();

                        child.material = (id === SKIN_ID)
                            ? createSkinMaterial(cutout)
                            : createPartMaterial(id);

                        child.castShadow = true;
                        child.receiveShadow = true;

                    }

                });

                anatomie.add(obj);

                geladen++;

                meldeFortschritt();

                ladeNaechste();

            },

            undefined,

            () => {

                fehler++;

                fehlendeDateien.push(id);

                meldeFortschritt();

                ladeNaechste();

            }

        );

    }

    // Mehrere Ladevorgänge parallel starten
    for (let i = 0; i < MAX_PARALLEL; i++) {
        ladeNaechste();
    }

    return anatomie;

}


// ========================================
// RING ERSTELLEN
// ========================================

export function createRing(scene) {

    const geometry = new THREE.TorusGeometry(
        1,
        0.04,
        16,
        100
    );

    const material = new THREE.MeshStandardMaterial({

        color: 0xff0000,
        roughness: 0.5

    });

    const ring = new THREE.Mesh(geometry, material);

    ring.position.set(0, 10, 5);

    scene.add(ring);

    return ring;

}
