// Organ-Party: Einstieg der Spielesammlung.
// Ablauf: Neues Spiel → Spielerwahl (1–4, witzige Namen) → Glücksrad wählt ein Minispiel →
// Spieler spielt eine Runde → Punkte → nächster Spieler … → Siegerehrung.
//
// Aufbau:  stage.js (3D-Bühne)  ·  modes.js (Minispiele)  ·  organGameUI.js (Oberfläche)
import { createStage } from './stage.js';
import { GAMES } from './modes.js';
import { createGameUI } from './organGameUI.js';

export function createOrganGame({ scene, camera, controls, canvas, catalog, viewerGroup, magnifier, hideDuringGame = [] }) {
    const stage = createStage({
        scene, camera, controls, canvas, catalog, viewerGroup,
        magnifier: magnifier || hideDuringGame[0],
    });
    const ui = createGameUI({
        onStart: () => newGame(),
        onExit: () => exitGame(),
        onModalChange: open => { stage.blocked = open; },
    });
    let session = null;
    let progress = null;

    function exitGame() {
        if (session) session.aborted = true;
        session = null;
        ui.closeModal();
        ui.hideRound();
        ui.hideTooltip();
        stage.exit();
        ui.setStartLabel('🎮 Neues Spiel');
    }

    async function newGame() {
        const current = { aborted: false };
        session = current;
        const loaded = stage.ensureLoaded(p => progress?.(p));
        stage.enter();
        ui.setScores([], -1);

        const setup = await ui.choosePlayers();
        if (current.aborted) return;
        if (!setup) return exitGame();
        const { players, rounds } = setup;
        ui.setScores(players, 0);

        // Organe laden (läuft schon seit dem Klick auf „Neues Spiel“ im Hintergrund)
        progress = p => ui.showRound({ title: '⏳ Organe werden vorbereitet …', text: `${Math.round(p * 100)} %` });
        progress(0);
        try {
            await loaded;
        } catch (error) {
            console.error(error);
            ui.toast('Laden fehlgeschlagen – bitte Seite neu laden.', 'bad');
            return exitGame();
        }
        progress = null;
        ui.hideRound();

        for (let round = 0; round < rounds; round++) {
            for (const [index, player] of players.entries()) {
                if (current.aborted) return;
                ui.setScores(players, index);
                stage.clearMode();
                stage.frontView();
                const info = `Runde ${round + 1} von ${rounds}`;
                const gameIndex = await ui.spinWheel(player, GAMES, info);
                if (current.aborted) return;
                const result = await GAMES[gameIndex].play({ stage, ui, player });
                if (current.aborted) return;
                stage.clearMode();
                ui.hideRound();
                player.score += result.points;
                ui.setScores(players, index);
                await ui.roundResult(player, result.points, result.detail);
            }
        }
        if (current.aborted) return;
        ui.setScores(players, -1);
        const choice = await ui.showPodium(players);
        if (current.aborted) return;
        if (choice === 'again') newGame();
        else exitGame();
    }

    // Für Tests/Debugging in der Browser-Konsole: window.organGame
    return { stage, ui, games: GAMES, newGame, exit: exitGame };
}
