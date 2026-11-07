"""Optional real-browser check. Requires Playwright and installed Microsoft Edge."""
import functools
import threading
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel='msedge', args=['--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 1280, 'height': 900}, ignore_https_errors=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/Anatomy.html')
        page.locator('.category-panel').wait_for(timeout=45000)
        page.evaluate('''() => {
            for (const name of ['Organe (', 'Verdauung (']) {
                const details = [...document.querySelectorAll('details')].find(d =>
                    d.querySelector(':scope > summary span')?.textContent.startsWith(name));
                details.open = true;
            }
        }''')
        part = page.locator('input[value="organs.digestive.smallIntestine"]')
        part.uncheck()
        assert not part.is_checked()
        assert page.evaluate('''() => [...document.querySelectorAll('summary')].find(s =>
            s.querySelector('span')?.textContent.startsWith('Verdauung (')).querySelector('input').indeterminate''')
        part.check()
        assert page.locator('input[value="organs.digestive.largeIntestine"]').is_checked()
        assert page.locator('.category-panel input[value^="partof:"]').count() == 0
        page.screenshot(path=str(Path(tempfile.gettempdir()) / 'anatomy-organ-groups.png'))
        page.evaluate('''() => {
            for (const details of document.querySelectorAll('details')) {
                if (!details.querySelector(':scope > summary span')?.textContent.startsWith('Körper (')) details.open = false;
            }
            document.querySelector('.category-panel').scrollTop = 0;
        }''')
        def settle():
            page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')

        larger = page.locator('#magnifier-larger')
        smaller = page.locator('#magnifier-smaller')
        larger.focus()
        page.keyboard.press('Enter')
        assert page.locator('#magnifier-size-value').inner_text() == '105 %'
        page.evaluate("() => { for(let i=0;i<50;i++) document.querySelector('#magnifier-larger').click(); }")
        assert page.locator('#magnifier-size-value').inner_text() == '250 %'
        assert larger.is_disabled()
        page.evaluate("() => { for(let i=0;i<50;i++) document.querySelector('#magnifier-smaller').click(); }")
        assert page.locator('#magnifier-size-value').inner_text() == '50 %'
        assert smaller.is_disabled()
        category_selection = page.locator('.category-panel input').evaluate_all('(inputs) => inputs.map(input => input.checked)')
        page.locator('#reset-view').click()
        assert page.locator('#magnifier-size-value').inner_text() == '100 %'
        assert page.locator('.category-panel input').evaluate_all('(inputs) => inputs.map(input => input.checked)') == category_selection
        page.locator('[data-view-mode=pan]').click()
        assert page.locator('[data-view-mode=pan]').get_attribute('aria-pressed') == 'true'
        assert page.locator('[data-view-mode=rotate]').get_attribute('aria-pressed') == 'false'
        page.locator('[data-view-mode=rotate]').click()
        settle()
        before = page.locator('#magnifier-controls').bounding_box()
        # Drag the actual handle; the overlay must follow, avoiding the side panel.
        page.mouse.move(709, 519)
        page.mouse.down()
        page.mouse.move(1000, 350, steps=12)
        page.mouse.up()
        settle()
        after = page.locator('#magnifier-controls').bounding_box()
        assert abs(after['x'] - before['x']) + abs(after['y'] - before['y']) > 60

        def check_overlay():
            return page.evaluate('''() => {
                const a = document.querySelector('#magnifier-controls').getBoundingClientRect();
                const obstacles = ['.category-panel', '#view-toolbar'].map(selector => document.querySelector(selector).getBoundingClientRect());
                return a.left >= 0 && a.top >= 0 && a.right <= innerWidth && a.bottom <= innerHeight &&
                    obstacles.every(b => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
            }''')

        assert check_overlay(), 'Desktop overlay overlaps the category panel or toolbar'
        page.screenshot(path=str(Path(tempfile.gettempdir()) / 'anatomy-controls-desktop.png'))
        page.locator('#reset-view').click()
        page.mouse.move(500, 400)
        page.mouse.wheel(0, -250)
        settle()
        assert check_overlay()
        page.set_viewport_size({'width': 390, 'height': 844})
        settle()
        assert check_overlay(), 'Narrow-screen overlay overlaps a panel or leaves the viewport'
        page.screenshot(path=str(Path(tempfile.gettempdir()) / 'anatomy-controls-mobile.png'))
        # Force each screen edge, then verify that the overlay still fits.
        for x, y in [(5, 500), (385, 500), (195, 5), (195, 830)]:
            placement = page.evaluate('''async ([x,y]) => {
                const { chooseOverlayPosition } = await import('./viewControls.js');
                return chooseOverlayPosition({left:x-40,right:x+40,top:y-40,bottom:y+40},
                    {width:140,height:48}, {width:390,height:844},
                    [document.querySelector('.category-panel').getBoundingClientRect(), document.querySelector('#view-toolbar').getBoundingClientRect()]);
            }''', [x,y])
            assert 0 <= placement['x'] <= 250 and 0 <= placement['y'] <= 796
        result = page.evaluate('''async () => {
            const THREE = await import('three');
            const { createMagnifier } = await import('./magnifier.js');
            const { createCatalogModels } = await import('./objects_all_obj_organs.js');
            const catalog = await (await fetch('./Data/anatomy-catalog.json')).json();
            const record = catalog.models.find(m => m.source === 'partof' && m.categoryId === 'skin');
            const scene = new THREE.Scene();
            const cutout = { center: new THREE.Vector3(), axisX: new THREE.Vector3(1,0,0),
                axisY: new THREE.Vector3(0,1,0), radius: 0.96 };
            const glass = createMagnifier(scene, cutout);
            let manager;
            await new Promise((resolve, reject) => {
                manager = createCatalogModels(scene, cutout, [record], progress => {
                    if (progress.failed) reject(new Error('Skin failed to load'));
                    if (progress.loaded === 1) resolve();
                });
                manager.setSelected([record.key]);
            });
            let material;
            manager.group.traverse(obj => { if (obj.isMesh) material = obj.material; });
            const shader = { uniforms: {}, vertexShader: '#include <common>\\n#include <worldpos_vertex>',
                fragmentShader: '#include <common>\\n#include <clipping_planes_fragment>' };
            material.onBeforeCompile(shader);
            for (const size of [0.5, 1, 2, 2.5]) {
                glass.userData.setSize(size);
                if (Math.abs(shader.uniforms.uRingRadius.value - 0.96 * size) > 1e-9)
                    throw new Error('Skin cutout did not follow magnifier size');
                if (glass.scale.x !== size) throw new Error('Frame size mismatch');
            }
            return { parts: glass.children.length, sharedUniform: shader.uniforms.uRingRadius === cutout.radiusUniform };
        }''')
        assert result == {'parts': 3, 'sharedUniform': True}, result
        assert not errors, errors
        browser.close()
        print('Real-browser keyboard, size limits, dragging, layout, reset and skin shader checks passed.')
finally:
    server.shutdown()
