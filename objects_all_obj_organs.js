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
// Es wird jeweils nur FJxxxx.obj geladen
// ========================================

// --- Ursprüngliche Organ-Liste ---
const ORGAN_IDS = [
    'FJ1770', 'FJ1781', 'FJ1796', 'FJ1817', 'FJ1830',
    'FJ1895', 'FJ2561', 'FJ2563', 'FJ2564', 'FJ2565',
    'FJ2566', 'FJ2567', 'FJ2571', 'FJ2572', 'FJ2573',
    'FJ2574', 'FJ2575', 'FJ2576', 'FJ2577', 'FJ2578',
    'FJ2579', 'FJ2580', 'FJ2581', 'FJ2582', 'FJ2583',
    'FJ2584', 'FJ2585', 'FJ2586', 'FJ2587', 'FJ2588',
    'FJ2589', 'FJ2590', 'FJ2591', 'FJ2592', 'FJ2593',
    'FJ2594', 'FJ2595', 'FJ2596', 'FJ2597', 'FJ2598',
    'FJ2600', 'FJ2601', 'FJ2602', 'FJ2603', 'FJ2604',
    'FJ2605', 'FJ2606', 'FJ2607', 'FJ2608', 'FJ2609',
    'FJ2610', 'FJ2611', 'FJ2612', 'FJ2613', 'FJ2614',
    'FJ2615', 'FJ2616', 'FJ2617', 'FJ2618', 'FJ2619',
    'FJ2620', 'FJ2621', 'FJ2622', 'FJ2623', 'FJ2624',
    'FJ2625', 'FJ2626', 'FJ2627', 'FJ2628', 'FJ2629',
    'FJ2765', 'FJ2766', 'FJ2767', 'FJ2768', 'FJ2816',
    'FJ2817', 'FJ2818', 'FJ2819', 'FJ2820', 'FJ2821',
    'FJ2822', 'FJ2823', 'FJ2824', 'FJ2417', 'FJ2418',
    'FJ2419', 'FJ2420', 'FJ2421', 'FJ2422', 'FJ2423',
    'FJ2424', 'FJ2425', 'FJ2426', 'FJ2427', 'FJ2428',
    'FJ2429', 'FJ2430', 'FJ2431', 'FJ2432', 'FJ2433',
    'FJ2434', 'FJ2435', 'FJ2436', 'FJ2437', 'FJ2438',
    'FJ2439', 'FJ2441', 'FJ2442', 'FJ2443', 'FJ2444',
    'FJ2445', 'FJ2446', 'FJ2447', 'FJ2448', 'FJ2449',
    'FJ2450', 'FJ2451', 'FJ2452', 'FJ2453', 'FJ2454',
    'FJ2455', 'FJ2456', 'FJ2457', 'FJ2458', 'FJ2459',
    'FJ2460', 'FJ2461', 'FJ2462', 'FJ2463', 'FJ2464',
    'FJ2465', 'FJ2466', 'FJ2467', 'FJ2468', 'FJ2469',
    'FJ2470', 'FJ2471', 'FJ2472', 'FJ2473', 'FJ2474',
    'FJ2475', 'FJ2476', 'FJ2477', 'FJ2478', 'FJ2479',
    'FJ2480', 'FJ2481', 'FJ2482', 'FJ2483', 'FJ2484',
    'FJ2485', 'FJ2486', 'FJ2487', 'FJ2488', 'FJ2489',
    'FJ2490', 'FJ2491', 'FJ2492', 'FJ2493', 'FJ2494',
    'FJ2495', 'FJ2496', 'FJ2497', 'FJ2498', 'FJ2499',
    'FJ2500', 'FJ2501', 'FJ2502', 'FJ2503', 'FJ2504',
    'FJ2505', 'FJ2506', 'FJ2507', 'FJ2508', 'FJ2509',
    'FJ2510', 'FJ2511', 'FJ2512', 'FJ2513', 'FJ2514',
    'FJ2515', 'FJ2516', 'FJ2517', 'FJ2518', 'FJ2519',
    'FJ2520', 'FJ2521', 'FJ2522', 'FJ2523', 'FJ2524',
    'FJ2525', 'FJ2526', 'FJ2527', 'FJ2528', 'FJ2529',
    'FJ2530', 'FJ2531', 'FJ2532', 'FJ2533', 'FJ2534',
    'FJ2535', 'FJ2536', 'FJ2537', 'FJ2538', 'FJ2539',
    'FJ2540', 'FJ2541', 'FJ2924', 'FJ2925', 'FJ2944',
    'FJ2966', 'FJ3019', 'FJ3020', 'FJ3040', 'FJ3129',
    'FJ3130', 'FJ3131', 'FJ3138', 'FJ3139', 'FJ3142',
    'FJ3145', 'FJ3147', 'FJ3149', 'FJ3150', 'FJ3151',
    'FJ3094', 'FJ3396'
];

// --- NEU: Gehirn (Großhirn, Hirnstamm, Kerne, Ventrikel) ---
const NEW_BRAIN_IDS = [
    'FJ1730', 'FJ1731', 'FJ1732', 'FJ1733', 'FJ1739',
    'FJ1740', 'FJ1742', 'FJ1744', 'FJ1745', 'FJ1746',
    'FJ1747', 'FJ1748', 'FJ1749', 'FJ1753', 'FJ1754',
    'FJ1757', 'FJ1758', 'FJ1759', 'FJ1760', 'FJ1767',
    'FJ1769', 'FJ1775', 'FJ1776', 'FJ1782', 'FJ1783',
    'FJ1784', 'FJ1785', 'FJ1786', 'FJ1787', 'FJ1788',
    'FJ1789', 'FJ1790', 'FJ1791', 'FJ1792', 'FJ1793',
    'FJ1794', 'FJ1795', 'FJ1797', 'FJ1798', 'FJ1800',
    'FJ1801', 'FJ1802', 'FJ1805', 'FJ1806', 'FJ1807',
    'FJ1808', 'FJ1814', 'FJ1822', 'FJ1823', 'FJ1827',
    'FJ1829', 'FJ1831', 'FJ1833', 'FJ1834', 'FJ1835',
    'FJ1836', 'FJ1837', 'FJ1838', 'FJ1839', 'FJ1840',
    'FJ1841', 'FJ1842'
];

// --- NEU: Auge (Augapfel-Bestandteile, Tränendrüsen) ---
const NEW_EYE_IDS = [
    'FJ1282', 'FJ1285', 'FJ1286', 'FJ1287', 'FJ1289',
    'FJ1297', 'FJ1299', 'FJ1305', 'FJ1316', 'FJ1317',
    'FJ1331', 'FJ1332', 'FJ1336', 'FJ1337', 'FJ1338',
    'FJ1340', 'FJ1348', 'FJ1350', 'FJ1356', 'FJ1367',
    'FJ1368', 'FJ1382'
];

// --- NEU: Verdauungssystem ---
const NEW_DIGESTIVE_IDS = [
    'FJ1858',  // Hepatovenous segment IX
    'FJ1896',  // Pancreatic duct
    'FJ2409',  // Hepatovenous segment VII
    'FJ2599',  // Ileocecal junction
    'FJ2630',  // Pancreatic duct tree
    'FJ2761'   // Tongue
];

// --- NEU: Harn- und Geschlechtsorgane ---
const NEW_UROGENITAL_IDS = [
    'FJ3132', 'FJ3133', 'FJ3134', 'FJ3135', 'FJ3136',
    'FJ3137', 'FJ3140', 'FJ3141', 'FJ3143', 'FJ3144',
    'FJ3146', 'FJ3148'
];

const NEW_ORGAN_IDS = [
    ...NEW_BRAIN_IDS,
    ...NEW_EYE_IDS,
    ...NEW_DIGESTIVE_IDS,
    ...NEW_UROGENITAL_IDS
];


function buildFileList() {
    return [...new Set([...ORGAN_IDS, ...NEW_ORGAN_IDS, SKIN_ID])];
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
