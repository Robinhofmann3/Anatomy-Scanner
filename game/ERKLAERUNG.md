# Code-Erklärung für die Präsentation

Ziel: Jede Funktion in 30 Sekunden erklären und im Code zeigen können.
Zeilenangaben = Stand Branch `hubeyb` (in VS Code mit **Strg+G** → Zeilennummer springen).

---

## 1. Aufbau in einem Satz pro Datei

```
Anatomy.html → Main_all_obj.js  (Team: Szene, Kamera, Licht, Lupe, Kategorie-Panel)
                   └─ createOrganGame(...)          Zeile 166
                        ├─ game/stage.js         3D-Bühne: Laden, Organe, Animation, Picking
                        ├─ game/modes.js         die 5 Minispiele
                        ├─ game/organGame.js     Spielablauf: Spieler → Glücksrad → Runde → Punkte
                        ├─ game/organGameUI.js   HTML-Oberfläche (Dialoge, Rad, Quiz)
                        └─ game/muscleAtlas.js   Muskel-Atlas
Daten: Data/organ-hierarchy.json (LOD1–3) · Data/organ-portfolio.json (LOD4) · Data/muscle-atlas.json
```

Wichtig: Das Spiel ändert **nichts** an Szene, Kamera oder Licht des Teams. Es hängt nur eigene
Objekte in dieselbe Szene und blendet die Viewer-Objekte während des Spiels aus.

---

## 2. Die CG-Komponenten – was, wo, wie

### Hierarchie / Szenengraph (Organ = Gruppe aus vielen Einzelteilen)
- **Wo:** `stage.js` Zeile 117 `build()`, besonders Zeile 179–182
- **Wie:** Ein Herz besteht aus 108 OBJ-Dateien. Alle kommen in eine `THREE.Group`. Mit
  `Box3.setFromObject` berechnen wir die Bounding Box, deren Mitte wird der **Drehpunkt**
  (`inner.position = -mitte`, Gruppe an die Mitte). So dreht und verschiebt sich das Herz als Ganzes.
- **Daten dazu:** `Data/organ-hierarchy.json`, erzeugt von `tools/build_organ_hierarchy.py`
  (LOD1 System → LOD2 Gruppe → LOD3 Organ).
- **Satz für Böhm:** „Szenengraph: Elterntransformation wirkt auf alle Kinder – wir verschieben
  nur die Gruppe, nicht 108 Einzelteile.“

### Koordinaten-Transformation (Modell → Welt)
- **Wo:** `stage.js` Zeile 63 `modelSpace()`
- **Wie:** BodyParts3D ist in Millimetern mit z nach oben. Wir drehen um −90° um x
  (z-oben → y-oben) und skalieren mit 20/1641 (Körper ≈ 20 Einheiten hoch).

### Picking (Objekt auswählen)
- **Wo:** `stage.js` Zeile 266 `pick()`
- **Wie:** Mausposition → normalisierte Gerätekoordinaten (−1…+1, y umgedreht) →
  `Raycaster.setFromCamera` → `intersectObjects` liefert das vorderste getroffene Mesh.
  Fallback: Bei sehr dünnen Organen (Bronchialbaum) nehmen wir das nächste Organ im
  Umkreis von 45 Pixeln (Projektion mit `screenPos`, Zeile 259).
- **Satz für Böhm:** „Strahl von der Kamera durch den Mauspunkt, erster Schnittpunkt gewinnt.“

### Objektmanipulation (Drag & Drop)
- **Wo:** `modes.js` Zeile 141 (Start) und 146 (Ziehen), Einrasten Zeile 80 `targetUnder()`
- **Wie:** Beim Anklicken legen wir eine **Ebene parallel zum Bildschirm** durch das Organ.
  Bei jeder Mausbewegung schneiden wir den Maus-Strahl mit dieser Ebene
  (`ray.intersectPlane`) → neue Organposition. Losgelassen wird geprüft, ob das Organ auf dem
  Bildschirm < 70 px von seinem Zielplatz entfernt ist → Einrasten, sonst zurückfliegen.
- **Detail:** Während des Ziehens wird OrbitControls deaktiviert (`controls.enabled = false`),
  weil unsere Event-Listener mit `capture: true` vor OrbitControls laufen (`stage.js` Zeile 254).

### Animation
- **Wo:** `stage.js` Zeile 206 `tween()`, Zeile 214 Easing, Zeile 217 `tick()` (läuft jedes Frame)
- **Wie:** Eigene kleine Tween-Funktion: Position/Skalierung werden pro Frame zwischen Start und
  Ziel interpoliert (`lerpVectors`), mit „Back-out“-Easing (leichtes Überschwingen beim Einrasten).
  Zeitbasiert über `dt`, also unabhängig von der Bildrate. Dazu: pulsierende Platzhalter
  (Sinus), drehende Organe in der Ablage, Glücksrad (`organGameUI.js` Zeile 230, CSS-Transition).

### Beleuchtung / Material / Transparenz
- **Wo:** Licht: `lights.js` (Team). Geisterhaut: `stage.js` Zeile 138
- **Wie:** Haut und Skelett halbtransparent mit `depthWrite: false`, damit sie die Organe nicht
  im Z-Buffer verdecken. Organe: `MeshStandardMaterial` (PBR), Hervorheben über `emissive`.

### Shader (Advancement des Teams, im Spiel genutzt)
- **Wo:** `objects_all_obj_organs.js` Zeile ~214–248 (Lupe), genutzt in `modes.js` Zeile 298
- **Wie:** Fragment-Shader verwirft (`discard`) Hautpixel innerhalb des Lupenrings → man sieht
  ins Innere. Die Lupen-Jagd misst, ob das Ziel-Organ (auf den Bildschirm projiziert) 1 Sekunde
  im Ring liegt (`modes.js` Zeile 328).
- **Lupe aus-/einblenden:** über **Layers** (`stage.js` Zeile 338): Layer 31 rendert die Kamera nicht
  und der Raycaster trifft ihn nicht.

### Messen in 3D („Wo ist das?“)
- **Wo:** `stage.js` Zeile 285 `pointOnPlane()`, `modes.js` Zeile 210
- **Wie:** Klick wird auf eine Ebene durch das echte Organ projiziert, Abstand in Szeneneinheiten
  × 8,2 = cm.

---

## 3. Spielablauf (ohne CG, nur Logik)
- `organGame.js` Zeile 36 `newGame()`: Spielerwahl → Organe laden → Schleife über Runden und
  Spieler (Zeile 62) → Glücksrad → `GAMES[...].play()` (Zeile 71) → Punkte → Siegerehrung.
- Die 5 Spiele stehen als Liste in `modes.js` Zeile 347 (`GAMES`). Ein neues Spiel = ein neuer
  Eintrag mit einer `play()`-Funktion.

## 4. Muskel-Atlas
- `muscleAtlas.js` Zeile 29 `load()`: Muskeln per Namensmuster aus `Data/muscle-atlas.json` laden
- Zeile 172 `pickGroup()`: Picking auf Muskeln (gleiches Prinzip wie oben)
- Zeile 68 `paint()`: ausgewählte Gruppe farbig und deckend, Rest transparent
- Zeile 201: Kamera fährt weich auf Vorder-/Rückseite (`position.lerp`)

## 5. Daten & Lizenzen (falls gefragt)
- 3D-Modelle: BodyParts3D 4.0, ergänzt um Lunge, Latissimus, geraden Bauchmuskel aus 3.0
  (`Data/bp3d_v3_ergaenzung/`, gleiches Koordinatensystem) – CC BY-SA 2.1 Japan, Hinweis unten links.
- Übungsbilder: Free Exercise DB, Public Domain.
- Steckbriefe/Quiz: Allgemeinwissen, eigene Texte.

## 6. Demo in 5 Minuten (reproduzierbar)
1. `npx http-server -p 8080 -c-1` → http://localhost:8080/Anatomy.html
2. Viewer + Lupe kurz zeigen (Team-Teil, Shader)
3. **Neues Spiel** → 2 Spieler → Rad drehen → Organ-Puzzle: ein Organ ziehen (Picking + Drag),
   Einrasten (Animation), Steckbrief + Quizfrage
4. Falls Zeit: Lupen-Jagd (Shader + Messung)
5. **Muskel-Atlas** → Latissimus anklicken (Kamera dreht, Übungskarte)
6. Konsole (F12): `organGame.stage.organs` zeigt die Organ-Gruppen (Hierarchie)
