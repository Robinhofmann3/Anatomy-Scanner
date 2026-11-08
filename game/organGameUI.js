// HTML-Oberfläche der Spielesammlung: Start-Button, HUD mit Punktetafel, Rundenkarte,
// Dialoge (Spielerwahl, Glücksrad, Freundebuch, Quiz, Siegerehrung), Toasts, Tooltip.
// Kein three.js – nur DOM. Dialoge liefern Promises, damit der Spielablauf linear lesbar bleibt.
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

export const PLAYER_COLORS = ['#e5484d', '#2462c5', '#2f9a5b', '#d98a00'];

export const FUNNY_NAMES = [
    'Lausige Leber', 'Holpriges Herz', 'Gelangweiltes Gehirn', 'Launische Lunge',
    'Mürrischer Magen', 'Nervöse Niere', 'Durchgedrehter Dünndarm', 'Dramatischer Dickdarm',
    'Hibbelige Harnblase', 'Schusselige Speiseröhre', 'Grummelige Gallenblase',
    'Bockige Bauchspeicheldrüse', 'Zappelige Zunge', 'Kichernder Kehlkopf',
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

function button(label, onClick, primary = false) {
    const b = el('button', primary ? 'primary' : '', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
}

function actions(...buttons) {
    const row = el('div', 'game-actions');
    row.append(...buttons);
    return row;
}

export function createGameUI({ onStart, onExit, onModalChange, onAtlas }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./organGame.css', import.meta.url).href;
    document.head.append(link);

    const launcher = shield(el('div', 'game-launch'));
    const startButton = el('button', 'game-start', '🎮 Neues Spiel');
    startButton.type = 'button';
    startButton.addEventListener('click', onStart);
    const atlasButton = el('button', 'game-start secondary', '💪 Muskel-Atlas');
    atlasButton.type = 'button';
    atlasButton.addEventListener('click', () => onAtlas?.());
    launcher.append(startButton, atlasButton);

    const hud = shield(el('div', 'game-hud'));
    const scoreboard = el('div', 'game-scoreboard');
    hud.append(el('strong', '', '🎮 Organ-Party'), scoreboard, button('✕ Beenden', onExit));

    const roundCard = shield(el('div', 'game-round'));
    roundCard.setAttribute('role', 'status');

    const tooltip = el('div', 'game-tooltip');
    const toast = el('div', 'game-toast');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const backdrop = shield(el('div', 'game-backdrop'));
    const modal = el('div', 'game-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    backdrop.append(modal);

    const credit = el('div', 'game-credit');
    credit.innerHTML = '3D-Modelle: <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 Japan</a>';
    document.body.append(launcher, hud, roundCard, tooltip, toast, backdrop, credit);

    let toastTimer;
    function openModal(build) {
        modal.replaceChildren();
        build(modal);
        backdrop.classList.add('open');
        onModalChange?.(true);
        (modal.querySelector('button.primary') || modal.querySelector('button'))?.focus();
    }
    function closeModal() {
        if (!backdrop.classList.contains('open')) return;
        backdrop.classList.remove('open');
        onModalChange?.(false);
    }

    const ui = {
        closeModal,
        setStartLabel(text, disabled = false) {
            startButton.textContent = text;
            startButton.disabled = disabled;
        },
        setScores(players, currentIndex) {
            scoreboard.replaceChildren(...players.map((p, i) => {
                const chip = el('span', `score-chip${i === currentIndex ? ' current' : ''}`);
                chip.style.setProperty('--player', p.color);
                chip.append(el('span', 'dot'), el('span', '', `${p.name}: ${p.score}`));
                return chip;
            }));
        },
        // Rundenkarte oben in der Mitte: Titel, Text, optional Elemente/Buttons
        showRound({ player, title, text, extra = [] }) {
            roundCard.replaceChildren();
            const head = el('div', 'round-head');
            if (player) {
                const who = el('span', 'round-player', player.name);
                who.style.setProperty('--player', player.color);
                head.append(who);
            }
            head.append(el('strong', '', title));
            roundCard.append(head);
            if (text) roundCard.append(el('p', 'round-text', text));
            for (const node of extra) roundCard.append(node);
            roundCard.classList.add('open');
        },
        updateRoundText(text) {
            const p = roundCard.querySelector('.round-text');
            if (p) p.textContent = text;
        },
        hideRound() { roundCard.classList.remove('open'); roundCard.replaceChildren(); },
        el, button,
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

        // Spielerwahl: 1–4 Spieler, witzige Zufallsnamen, Rundenanzahl
        choosePlayers() {
            return new Promise(resolve => openModal(m => {
                let count = 2;
                let rounds = 3;
                const names = shuffledNames();
                const inputs = [];
                m.append(el('h2', '', '🎮 Neues Spiel'));
                m.append(el('p', '', 'Wie viele spielen mit? Ihr spielt abwechselnd an diesem PC.'));
                const countRow = el('div', 'seg-row');
                const list = el('div', 'player-list');
                const roundRow = el('div', 'seg-row');

                function renderPlayers() {
                    list.replaceChildren();
                    for (let i = 0; i < count; i++) {
                        const row = el('div', 'player-row');
                        row.style.setProperty('--player', PLAYER_COLORS[i]);
                        const input = inputs[i] || el('input');
                        input.type = 'text';
                        input.maxLength = 28;
                        input.value ||= names[i];
                        input.setAttribute('aria-label', `Name Spieler ${i + 1}`);
                        inputs[i] = input;
                        const dice = button('🎲', () => { input.value = randomName(inputs.map(x => x.value)); });
                        dice.title = 'Neuer Zufallsname';
                        row.append(el('span', 'dot'), el('span', 'player-no', `Spieler ${i + 1}`), input, dice);
                        list.append(row);
                    }
                }
                function segmented(container, values, current, onPick, label) {
                    container.replaceChildren(el('span', 'seg-label', label));
                    for (const v of values) {
                        const b = button(String(v), () => { onPick(v); segmented(container, values, v, onPick, label); });
                        b.setAttribute('aria-pressed', String(v === current));
                        container.append(b);
                    }
                }
                segmented(countRow, [1, 2, 3, 4], count, v => { count = v; renderPlayers(); }, 'Spieler:');
                segmented(roundRow, [2, 3, 5], rounds, v => { rounds = v; }, 'Runden je Spieler:');
                renderPlayers();
                m.append(countRow, list, roundRow);
                m.append(actions(
                    button('Abbrechen', () => { closeModal(); resolve(null); }),
                    button('Weiter zum Glücksrad', () => {
                        closeModal();
                        resolve({
                            rounds,
                            players: inputs.slice(0, count).map((input, i) => ({
                                name: input.value.trim() || names[i], color: PLAYER_COLORS[i], score: 0 })),
                        });
                    }, true)));
            }));
        },

        // "Spieler X ist dran" + Glücksrad drehen. Liefert den Index des gewählten Spiels.
        spinWheel(player, games, roundInfo) {
            return new Promise(resolve => openModal(m => {
                const head = el('h2', 'turn-title', `${player.name} ist dran!`);
                head.style.setProperty('--player', player.color);
                m.append(head, el('p', 'quiz-progress', roundInfo));
                const wrap = el('div', 'wheel-wrap');
                wrap.innerHTML = wheelSvg(games);
                const wheel = wrap.querySelector('.wheel');
                wrap.append(el('div', 'wheel-pointer'));
                m.append(wrap);
                const result = el('p', 'wheel-result', 'Dreh das Rad – das Schicksal wählt dein Spiel!');
                m.append(result);
                const go = button('Los geht’s', () => { closeModal(); resolve(chosen); }, true);
                go.hidden = true;
                let chosen = -1;
                const spin = button('🎡 Rad drehen', () => {
                    spin.disabled = true;
                    chosen = Math.floor(Math.random() * games.length);
                    const segment = 360 / games.length;
                    const center = chosen * segment + segment / 2;
                    const turns = 5 + Math.floor(Math.random() * 3);
                    wheel.style.transform = `rotate(${turns * 360 - center}deg)`;
                    setTimeout(() => {
                        result.textContent = `${games[chosen].icon} ${games[chosen].title}: ${games[chosen].teaser}`;
                        spin.hidden = true;
                        go.hidden = false;
                        go.focus();
                    }, 4200);
                }, true);
                m.append(actions(spin, go));
            }));
        },

        info(title, lines, cta = 'Los') {
            return new Promise(resolve => openModal(m => {
                m.append(el('h2', '', title));
                for (const line of lines) m.append(el('p', '', line));
                m.append(actions(button(cta, () => { closeModal(); resolve(); }, true)));
            }));
        },

        // Freundebuch + Quiz. Liefert die Anzahl richtiger Antworten.
        showPortfolio(entry, color, { questions = entry.quiz } = {}) {
            return new Promise(resolve => {
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
                    m.append(actions(button(questions.length === 1 ? 'Zur Quizfrage'
                        : `Quiz starten (${questions.length} Fragen)`, () => ask(0, 0), true)));
                });
                const ask = (index, correct) => openModal(m => {
                    const q = questions[index];
                    m.append(el('p', 'quiz-progress', `${entry.name} · Frage ${index + 1} von ${questions.length}`));
                    m.append(el('p', 'quiz-question', q.frage));
                    const list = el('div', 'quiz-answers');
                    const explain = el('div', 'quiz-explain');
                    const last = index + 1 >= questions.length;
                    const next = button(last ? 'Weiter' : 'Nächste Frage', () => {
                        if (!last) ask(index + 1, correct);
                        else { closeModal(); resolve(correct); }
                    }, true);
                    next.hidden = true;
                    q.antworten.forEach((text, i) => {
                        const b = button(text, () => {
                            const right = i === q.richtig;
                            if (right) correct++;
                            [...list.children].forEach((other, j) => {
                                other.disabled = true;
                                if (j === q.richtig) other.classList.add('correct');
                            });
                            if (!right) b.classList.add('wrong');
                            explain.textContent = `${right ? '✅ Richtig! +5 Punkte. ' : '❌ Leider falsch. '}${q.erklaerung}`;
                            m.insertBefore(explain, next.parentElement);
                            next.hidden = false;
                            next.focus();
                        });
                        list.append(b);
                    });
                    m.append(list, actions(next));
                });
                showFriendbook();
            });
        },

        roundResult(player, gained, detail) {
            return ui.info(`${player.name}: +${gained} Punkte`, [detail, `Gesamt: ${player.score} Punkte`], 'Nächster Zug');
        },

        showPodium(players) {
            return new Promise(resolve => openModal(m => {
                const ranked = [...players].sort((a, b) => b.score - a.score);
                m.append(el('h2', '', ranked.length > 1 ? `🏆 ${ranked[0].name} gewinnt!` : '🏆 Spiel beendet!'));
                const list = el('ol', 'podium');
                ranked.forEach((p, i) => {
                    const li = el('li');
                    li.style.setProperty('--player', p.color);
                    li.append(el('span', 'medal', ['🥇', '🥈', '🥉', '🎖️'][i]), el('span', '', p.name),
                        el('strong', '', `${p.score} Punkte`));
                    list.append(li);
                });
                m.append(list);
                m.append(actions(
                    button('Zurück zum Scanner', () => { closeModal(); resolve('exit'); }),
                    button('Nochmal spielen', () => { closeModal(); resolve('again'); }, true)));
            }));
        },
    };
    return ui;
}

function shuffledNames() {
    const copy = [...FUNNY_NAMES];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function randomName(taken) {
    const free = FUNNY_NAMES.filter(n => !taken.includes(n));
    return free[Math.floor(Math.random() * free.length)] || FUNNY_NAMES[0];
}

// Glücksrad als SVG: Segmente im Uhrzeigersinn ab 12 Uhr
function wheelSvg(games) {
    const n = games.length;
    const r = 100;
    const parts = games.map((g, i) => {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
        const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const mid = (a0 + a1) / 2;
        const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
        const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
        const tx = r + r * 0.62 * Math.cos(mid), ty = r + r * 0.62 * Math.sin(mid);
        // Text radial ausrichten; in der unteren Hälfte um 180° drehen, damit er lesbar bleibt
        let rot = (mid * 180) / Math.PI + 90;
        if (rot > 90 && rot < 270) rot += 180;
        return `<path d="M${r} ${r}L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z" fill="${g.color}" stroke="#fff" stroke-width="2"/>
            <g transform="translate(${tx} ${ty}) rotate(${rot})">
              <text y="-4" text-anchor="middle" font-size="18">${g.icon}</text>
              <text y="12" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${g.title}</text>
            </g>`;
    }).join('');
    return `<svg viewBox="0 0 200 200" class="wheel" role="img" aria-label="Glücksrad">${parts}
        <circle cx="100" cy="100" r="14" fill="#fff" stroke="#18212d" stroke-width="3"/></svg>`;
}
