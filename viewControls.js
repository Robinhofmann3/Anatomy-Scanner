import * as THREE from 'three';

// Prefer the upper-right rim, then the opposite side. Clamp to the viewport
// and use other free positions when a panel occupies either side of the lens.
export function chooseOverlayPosition(rim, size, viewport, obstacles) {
    const gap = 10;
    const clamp = (value, maximum) => Math.max(gap, Math.min(value, Math.max(gap, maximum)));
    const positions = [
        [rim.right + gap, rim.top],
        [rim.left - size.width - gap, rim.top],
        [(rim.left + rim.right - size.width) / 2, rim.top - size.height - gap],
        [(rim.left + rim.right - size.width) / 2, rim.bottom + gap],
    ];
    for (const obstacle of obstacles) {
        positions.push([rim.left - size.width - gap, obstacle.bottom + gap]);
        positions.push([obstacle.left - size.width - gap, rim.top]);
        positions.push([rim.left, obstacle.top - size.height - gap]);
    }
    const candidates = positions.map(([x, y]) => ({
        x: Math.round(clamp(x, viewport.width - size.width - gap)),
        y: Math.round(clamp(y, viewport.height - size.height - gap)),
    }));
    const overlap = candidate => obstacles.reduce((total, rect) => total +
        Math.max(0, Math.min(candidate.x + size.width + gap, rect.right) - Math.max(candidate.x - gap, rect.left)) *
        Math.max(0, Math.min(candidate.y + size.height + gap, rect.bottom) - Math.max(candidate.y - gap, rect.top)), 0);
    return candidates.find(candidate => overlap(candidate) === 0) ||
        candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best);
}

export function createViewControls({ magnifier, camera, canvas, controls, onReset }) {
    const overlay = document.getElementById('magnifier-controls');
    const output = document.getElementById('magnifier-size-value');
    const decrease = document.getElementById('magnifier-smaller');
    const increase = document.getElementById('magnifier-larger');
    const toolbar = document.getElementById('view-toolbar');
    let percent = 100;
    function setSize(value) {
        percent = Math.round(magnifier.userData.setSize(value / 100) * 100);
        output.value = `${percent} %`;
        decrease.disabled = percent <= 50;
        increase.disabled = percent >= 250;
    }
    decrease.addEventListener('click', () => setSize(percent - 5));
    increase.addEventListener('click', () => setSize(percent + 5));
    const modeButtons = [...toolbar.querySelectorAll('[data-view-mode]')];
    for (const button of modeButtons) button.addEventListener('click', () => {
        controls.mouseButtons.LEFT = button.dataset.viewMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        for (const item of modeButtons) item.setAttribute('aria-pressed', String(item === button));
    });
    document.getElementById('reset-view').addEventListener('click', onReset);
    // DOM controls are siblings of the canvas. Also prevent wheel/touch gestures
    // on them from reaching any future scene-level listeners.
    for (const element of [overlay, toolbar]) {
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
            element.addEventListener(type, event => event.stopPropagation());
        }
    }
    setSize(100);
    const point = new THREE.Vector3();
    function updatePosition() {
        const rect = canvas.getBoundingClientRect();
        const rim = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        // Project the complete rim after its camera-facing transform and scale.
        for (let i = 0; i < 16; i++) {
            const angle = i * Math.PI / 8;
            point.set(Math.cos(angle) * 1.04, Math.sin(angle) * 1.04, 0);
            magnifier.localToWorld(point).project(camera);
            const x = rect.left + (point.x + 1) * rect.width / 2;
            const y = rect.top + (1 - point.y) * rect.height / 2;
            rim.left = Math.min(rim.left, x);
            rim.right = Math.max(rim.right, x);
            rim.top = Math.min(rim.top, y);
            rim.bottom = Math.max(rim.bottom, y);
        }
        const obstacles = [document.querySelector('.category-panel'), toolbar]
            .filter(Boolean).map(element => element.getBoundingClientRect());
        const placement = chooseOverlayPosition(rim, {
            width: overlay.offsetWidth, height: overlay.offsetHeight,
        }, { width: window.innerWidth, height: window.innerHeight }, obstacles);
        const transform = `translate(${placement.x}px, ${placement.y}px)`;
        if (overlay.style.transform !== transform) overlay.style.transform = transform;
        overlay.style.visibility = 'visible';
    }
    return { updatePosition, resetSize: () => setSize(100) };
}
