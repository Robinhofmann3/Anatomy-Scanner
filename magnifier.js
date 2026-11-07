import * as THREE from 'three';

export function createMagnifier(scene, cutout) {
    const magnifier = new THREE.Group();
    magnifier.name = 'MAGNIFIER';
    const rim = new THREE.MeshStandardMaterial({ color: 0xe13c42, metalness: 0.35, roughness: 0.3 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x263447, roughness: 0.65 });
    magnifier.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 16, 100), rim));
    const direction = new THREE.Vector3(1, -1, 0).normalize();
    function handlePart(radius, length, distance, material) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        mesh.position.copy(direction).multiplyScalar(distance);
        magnifier.add(mesh);
    }
    handlePart(0.09, 0.4, 1.15, rim);
    handlePart(0.14, 1.05, 1.8, grip);
    scene.add(magnifier);
    cutout.radiusUniform = { value: cutout.radius };
    magnifier.userData.setSize = value => {
        const size = Math.min(2.5, Math.max(0.5, Number(value) || 1));
        magnifier.scale.setScalar(size);
        cutout.radius = 0.96 * size;
        cutout.radiusUniform.value = cutout.radius;
        return size;
    };
    return magnifier;
}

// Intercept only left/touch hits on the rim or handle. The empty lens remains
// available to OrbitControls; right-button panning never moves the magnifier.
export function attachMagnifierDrag(magnifier, camera, canvas, controls, offset) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    const start = new THREE.Vector3();
    const position = new THREE.Vector3();
    let pointerId = null;
    function updateRay(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
            -(event.clientY - rect.top) / rect.height * 2 + 1);
        camera.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
    }
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointerId !== null) return;
        updateRay(event);
        magnifier.updateMatrixWorld(true);
        if (!raycaster.intersectObject(magnifier, true).length) return;
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), magnifier.position);
        if (!raycaster.ray.intersectPlane(plane, start)) return;
        position.copy(magnifier.position);
        pointerId = event.pointerId;
        controls.enabled = false;
        canvas.setPointerCapture(pointerId);
        canvas.style.cursor = 'grabbing';
        event.stopImmediatePropagation();
        event.preventDefault();
    }, true);
    canvas.addEventListener('pointermove', event => {
        if (pointerId !== event.pointerId) return;
        updateRay(event);
        if (raycaster.ray.intersectPlane(plane, hit)) {
            const local = camera.worldToLocal(hit.sub(start).add(position));
            offset.set(local.x, local.y);
        }
        event.stopImmediatePropagation();
    }, true);
    function finish(event) {
        if (pointerId !== event.pointerId) return;
        const id = pointerId;
        pointerId = null;
        controls.enabled = true;
        canvas.style.cursor = '';
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        event.stopImmediatePropagation();
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        canvas.addEventListener(type, finish, true);
    }
}
