// HTML-Oberfläche des Organ-Puzzles: Start-Button, HUD, Toasts, Tooltip,
// Freundebuch-Steckbrief und Quiz. Kein three.js – nur DOM.
import { organSvg } from './organArt.js';

const FIELDS = [
    ['spitzname', 'Spitzname'],
    ['wohnort', 'Hier wohne ich'],
    ['groesseGewicht', 'Größe & Gewicht'],
    ['besterFreund', 'Mein bester Freund'],
    ['dasLiebeIch', 'Das liebe ich'],
    ['dasMagIchGarNicht', 'Das mag ich gar nicht'],
    ['superkraft', 'Meine Superkraft'],
    ['lieblingsspruch', 'Mein Lieblingsspruch'],
];

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Klicks/Scrollen auf der Oberfläche dürfen nicht die 3D-Steuerung auslösen
function shield(node) {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
        node.addEventListener(type, event => event.stopPropagation());
    }
    return node;
}

export function createGameUI({ onStart, onExit, onRestart }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./organGame.css', import.meta.url).href;
    document.head.append(link);

    const startButton = shield(el('button', 'game-start', '🧩 Organ-Puzzle starten'));
    startButton.type = 'button';
    startButton.addEventListener('click', onStart);

    const hud = shield(el('div', 'game-hud'));
    hud.setAttribute('role', 'status');
    const title = el('strong', '', '🧩 Organ-Puzzle');
    const placed = el('span', 'game-stat');
    const score = el('span', 'game-stat');
    const restart = el('button', '', '↺ Neu mischen');
    restart.type = 'button';
    restart.addEventListener('click', onRestart);
    const exit = el('button', '', '✕ Beenden');
    exit.type = 'button';
    exit.addEventListener('click', onExit);
    hud.append(title, placed, score, restart, exit);

    const tooltip = el('div', 'game-tooltip');
    const toast = el('div', 'game-toast');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const backdrop = shield(el('div', 'game-backdrop'));
    const modal = el('div', 'game-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    backdrop.append(modal);
    document.body.append(startButton, hud, tooltip, toast, backdrop);

    let toastTimer;

    function openModal(build) {
        modal.replaceChildren();
        build(modal);
        backdrop.classList.add('open');
        modal.querySelector('button.primary, button')?.focus();
    }
    function closeModal() { backdrop.classList.remove('open'); }

    function actions(...buttons) {
        const row = el('div', 'game-actions');
        row.append(...buttons);
        return row;
    }
    function button(label, onClick, primary = false) {
        const b = el('button', primary ? 'primary' : '', label);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }

    return {
        setStartLabel(text, disabled = false) {
            startButton.textContent = text;
            startButton.disabled = disabled;
        },
        setStats({ placedCount, total, points }) {
            placed.textContent = `${placedCount} / ${total} platziert`;
            score.textContent = `${points} Punkte`;
        },
        showTooltip(text, x, y) {
            tooltip.textContent = text;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
            tooltip.style.display = 'block';
        },
        hideTooltip() { tooltip.style.display = 'none'; },
        toast(text, kind = '') {
            toast.textContent = text;
            toast.className = `game-toast show ${kind}`;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toast.className = 'game-toast'; }, 2600);
        },
        isModalOpen: () => backdrop.classList.contains('open'),
        closeModal,

        showIntro(onGo) {
            openModal(m => {
                m.append(el('h2', '', '🧩 Organ-Puzzle'));
                m.append(el('p', '', 'Links und rechts liegen die wichtigsten Organe durcheinander. Die leuchtenden Kugeln im Körper zeigen, wo etwas fehlt.'));
                m.append(el('p', '', '👉 Organ mit der linken Maustaste packen und an die richtige Kugel ziehen.'));
                m.append(el('p', '', '🔄 Neben den Organen ziehen dreht die Ansicht, das Mausrad zoomt.'));
                m.append(el('p', '', '📖 Für jedes richtig platzierte Organ gibt es einen Steckbrief und 3 Quizfragen.'));
                m.append(el('p', '', '⚠️ Links und rechts gelten aus Sicht des Körpers – nicht aus deiner!'));
                m.append(actions(button("Los geht's", () => { closeModal(); onGo(); }, true)));
            });
        },

        // Steckbrief + anschließendes Quiz. onDone(anzahlRichtig)
        showPortfolio(entry, color, onDone) {
            const showFriendbook = () => openModal(m => {
                const book = el('div', 'friendbook');
                const head = el('div', 'friendbook-head');
                head.insertAdjacentHTML('afterbegin', organSvg(entry.id, color));
                const name = el('div');
                name.append(el('small', '', 'Mein Freundebuch-Eintrag'), el('h2', '', entry.name));
                head.append(name);
                book.append(head);
                const list = el('dl');
                for (const [key, label] of FIELDS) {
                    if (!entry.freundebuch[key]) continue;
                    list.append(el('dt', '', `${label}:`), el('dd', '', entry.freundebuch[key]));
                }
                book.append(list);
                if (entry.hinweisModell) book.append(el('p', 'model-note', entry.hinweisModell));
                m.append(el('p', 'quiz-progress', '✅ Richtig platziert!'), book);
                m.append(actions(button(`Quiz starten (${entry.quiz.length} Fragen)`, () => askQuestion(0, 0), true)));
            });

            const askQuestion = (index, correct) => openModal(m => {
                const q = entry.quiz[index];
                m.append(el('p', 'quiz-progress', `${entry.name} · Frage ${index + 1} von ${entry.quiz.length}`));
                m.append(el('p', 'quiz-question', q.frage));
                const list = el('div', 'quiz-answers');
                const explain = el('div', 'quiz-explain');
                const next = button(index + 1 < entry.quiz.length ? 'Nächste Frage' : 'Auswertung', () => {
                    if (index + 1 < entry.quiz.length) askQuestion(index + 1, correct);
                    else showResult(correct);
                }, true);
                next.hidden = true;
                q.antworten.forEach((text, i) => {
                    const b = button(text, () => {
                        const right = i === q.richtig;
                        if (right) correct++;
                        for (const [j, other] of [...list.children].entries()) {
                            other.disabled = true;
                            if (j === q.richtig) other.classList.add('correct');
                        }
                        if (!right) b.classList.add('wrong');
                        explain.textContent = `${right ? '✅ Richtig! ' : '❌ Leider falsch. '}${q.erklaerung}`;
                        m.insertBefore(explain, next.parentElement);
                        next.hidden = false;
                        next.focus();
                    });
                    list.append(b);
                });
                m.append(list, actions(next));
            });

            const showResult = correct => openModal(m => {
                m.append(el('h2', '', `${entry.name}: ${correct} von ${entry.quiz.length} richtig`));
                m.append(el('p', '', correct === entry.quiz.length ? 'Volle Punktzahl – stark! 🎉'
                    : correct > 0 ? 'Gut gemacht – weiter geht’s!' : 'Nächstes Mal klappt’s besser!'));
                m.append(actions(button('Weiter puzzeln', () => { closeModal(); onDone(correct); }, true)));
            });

            showFriendbook();
        },

        showFinal({ points, maxPoints, wrongDrops, onAgain, onExit: exitGame }) {
            openModal(m => {
                m.append(el('h2', '', '🏆 Alle Organe sind an ihrem Platz!'));
                m.append(el('p', 'score-big', `${points} / ${maxPoints} Punkte`));
                m.append(el('p', '', wrongDrops === 0 ? 'Kein einziger Fehlversuch – Anatomie-Profi!'
                    : `${wrongDrops} Fehlversuch${wrongDrops === 1 ? '' : 'e'} beim Platzieren.`));
                m.append(actions(
                    button('Zurück zum Scanner', () => { closeModal(); exitGame(); }),
                    button('Nochmal spielen', () => { closeModal(); onAgain(); }, true)));
            });
        },
    };
}
