# Organ-Puzzle (Spielmodus)

Start über den Button **„🧩 Organ-Puzzle starten“** oben links in `Anatomy.html`.

## Spielidee
Die wichtigsten Organe liegen links und rechts neben dem Körper. Im Körper pulsieren
Platzhalterkugeln an den Stellen, an denen Organe fehlen. Organ packen, an die richtige
Kugel ziehen – rastet es ein, öffnet sich ein Steckbrief im Freundebuch-Stil und ein Quiz
mit 3 Fragen.

| Aktion | Punkte |
|---|---|
| Organ beim ersten Versuch richtig platziert | 10 |
| Organ nach Fehlversuch richtig platziert | 5 |
| Quizfrage richtig | 5 |

## CG-Komponenten
- **Hierarchie:** Ein Organ (LOD3) ist eine `THREE.Group` aus vielen OBJ-Einzelteilen;
  der Drehpunkt wird per Bounding Box in die Organmitte gelegt.
- **Picking:** `Raycaster` auf die Organ-Gruppen, mit Fallback in Bildschirmkoordinaten
  für dünne Strukturen (Bronchialbaum).
- **Objektmanipulation:** Drag auf einer kameraparallelen Ebene (`Plane` + `Ray.intersectPlane`).
- **Animation:** Einrasten (Easing „back out“), Zurückfliegen bei Fehlversuch,
  pulsierende Platzhalter, rotierende Organe in der Ablage.
- **Beleuchtung/Material:** Geisterhaut und Skelett halbtransparent (`depthWrite: false`).

## Daten
- `Data/organ-hierarchy.json` – LOD1 System → LOD2 Gruppe → LOD3 Organ (erzeugt mit
  `python tools/build_organ_hierarchy.py` aus `Data/anatomy-catalog.json`)
- `Data/organ-portfolio.json` – LOD4: Steckbrief + Quiz je Organ (Allgemeinwissen,
  keine medizinische Beratung)

## Dateien
- `game/organGame.js` – 3D-Logik (Laden, Drag & Drop, Animation, Punkte)
- `game/organGameUI.js` – HTML-Oberfläche (HUD, Steckbrief, Quiz)
- `game/organArt.js` – eigene Comic-Organe als SVG
- `game/organGame.css` – Styles

Eingebunden in `Main_all_obj.js` mit einem Import und einem Aufruf von `createOrganGame(...)`.
In der Browser-Konsole steht das Spiel als `window.organGame` zur Verfügung.
