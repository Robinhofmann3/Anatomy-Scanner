# Organ-Party (Spielesammlung)

Start über **„🎮 Neues Spiel“** oben links in `Anatomy.html`.

## Ablauf
1. **Spielerwahl:** 1–4 Spieler an einem PC, abwechselnd. Jeder bekommt einen witzigen
   Zufallsnamen (z. B. „Lausige Leber“, „Holpriges Herz“) – mit 🎲 neu würfeln oder selbst tippen.
   Dazu 2, 3 oder 5 Runden je Spieler wählen.
2. **Glücksrad:** Wer dran ist, dreht das Rad – es wählt zufällig eines von 5 Minispielen.
3. **Runde spielen**, Punkte landen auf der Punktetafel oben links.
4. **Siegerehrung** nach der letzten Runde.

## Minispiele
| Spiel | Aufgabe | Punkte (max.) |
|---|---|---|
| 🧩 Organ-Puzzle | 3 Organe an die leuchtenden Kugeln ziehen, je eine Quizfrage | 10 + 5 je Organ |
| 🏆 Profi-Puzzle | 3 Organe in 45 s platzieren – ohne Hilfskugeln | 15 je Organ |
| 📍 Wo ist das? | Auf die Stelle klicken, wo das Organ liegt; Abweichung in cm | 15 − cm je Organ |
| 🕵️ Wer bin ich? | Organ aus Freundebuch-Hinweisen erraten und im Körper anklicken | 20 → 4 je nach Hinweisen |
| 🔍 Lupen-Jagd | Organ mit der Röntgen-Lupe unter der Haut finden (1 s drüberhalten) | 20 − Sekunden/2 |

## CG-Komponenten
- **Hierarchie:** Ein Organ (LOD3) ist eine `THREE.Group` aus vielen OBJ-Einzelteilen;
  der Drehpunkt wird per Bounding Box in die Organmitte gelegt.
- **Picking:** `Raycaster` auf die Organ-Gruppen, mit Fallback in Bildschirmkoordinaten
  für dünne Strukturen (Bronchialbaum).
- **Objektmanipulation:** Drag auf einer kameraparallelen Ebene (`Plane` + `Ray.intersectPlane`).
- **Animation:** Einrasten (Easing „back out“), Zurückfliegen, pulsierende Platzhalter,
  rotierende Organe in der Ablage, Glücksrad (CSS-Transition).
- **Shader:** Lupen-Jagd nutzt den Ring-Cutout-Shader der Haut (Advancement des Teams).
- **Messung:** „Wo ist das?“ projiziert den Klick auf eine Ebene durch das Organ und rechnet
  Szeneneinheiten in cm um (1 Einheit ≈ 8,2 cm).

## Daten
- `Data/organ-hierarchy.json` – LOD1 System → LOD2 Gruppe → LOD3 Organ (erzeugt mit
  `python tools/build_organ_hierarchy.py` aus `Data/anatomy-catalog.json`)
- `Data/organ-portfolio.json` – LOD4: Steckbrief + Quiz je Organ (Allgemeinwissen,
  keine medizinische Beratung)

## Dateien
- `game/organGame.js` – Einstieg und Party-Ablauf (Spieler, Runden, Rad)
- `game/stage.js` – 3D-Bühne: Laden, Organe, Animation, Picking
- `game/modes.js` – die 5 Minispiele
- `game/organGameUI.js` – HTML-Oberfläche (HUD, Rad, Freundebuch, Quiz, Siegerehrung)
- `game/organArt.js` – eigene Comic-Organe als SVG
- `game/muscleAtlas.js` – Muskel-Atlas
- `game/organGame.css` – Styles

Eingebunden in `Main_all_obj.js` mit einem Import und einem Aufruf von `createOrganGame(...)`.
In der Browser-Konsole steht alles als `window.organGame` zur Verfügung.

## 💪 Muskel-Atlas
Zweiter Button oben links. Muskeln nach **Oberkörper · Arme · Rumpf · Beine**, darin 17 Gruppen
(Brust, Delta, Latissimus, Bizeps, Adduktoren …). Gruppe in der Liste wählen oder direkt einen
Muskel im 3D-Körper anklicken → Kurzanleitung zur Hauptübung (Start-/Endbild, Schritte,
typischer Fehler) und Alternativen, jeweils markiert mit 🏠 Zuhause oder 🏋️ Gym. Die Kamera
dreht automatisch auf die Seite, auf der der Muskel liegt.
Inhalte: `Data/muscle-atlas.json` · Bilder: `Data/exercises/` aus der
[Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (Public Domain).

## Ergänzung aus BodyParts3D 3.0
BodyParts3D 4.0 fehlen Lungengewebe, Latissimus und gerader Bauchmuskel. Diese 9 Teile liegen
vereinfacht in `Data/bp3d_v3_ergaenzung/` (gleicher Körper, gleiches Koordinatensystem;
erzeugt mit `python tools/build_v3_supplement.py`). Lilys Katalog bleibt unverändert.

## Lizenz der 3D-Modelle
BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan – der Hinweis
steht unten links in der App. Übungsbilder: Free Exercise DB, Public Domain (Unlicense).

