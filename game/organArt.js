// Eigene, einfache Comic-Figuren für die Organ-Steckbriefe (SVG, keine fremden Grafiken).
// Jede Figur = Organ-Silhouette + Augen + Mund. viewBox 0 0 120 120.

const SHAPES = {
    gehirn: `<path d="M22 66c-10-4-12-20-2-27 0-14 14-22 26-17 8-10 26-10 34 0 12-5 26 3 25 17 10 7 8 23-2 28-1 13-14 20-26 16-8 8-22 8-30 0-12 4-25-3-25-17z"/>
             <path d="M44 32c4 6 2 12-3 16M64 26c-2 8 2 14 8 16M86 44c-6 2-8 8-5 14M36 78c6-2 10 2 12 7" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3" stroke-linecap="round"/>`,
    herz: `<path d="M60 102C28 80 12 62 12 42c0-16 12-26 26-26 10 0 18 6 22 14 4-8 12-14 22-14 14 0 26 10 26 26 0 20-16 38-48 60z"/>`,
    lunge: `<path d="M54 30v40c0 14-8 26-22 26-12 0-18-10-18-24 0-20 10-40 24-46 8-3 16-2 16 4zM66 30v40c0 14 8 26 22 26 12 0 18-10 18-24 0-20-10-40-24-46-8-3-16-2-16 4z"/>
            <path d="M60 10v28M60 38c-3 4-6 6-6 6M60 38c3 4 6 6 6 6" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="5" stroke-linecap="round"/>`,
    leber: `<path d="M12 50c0-18 20-28 48-28 26 0 46 6 48 18 2 12-14 22-30 36-14 12-26 20-38 18C22 92 12 72 12 50z"/>`,
    magen: `<path d="M40 14c8 0 12 6 12 14v10c0 8 6 12 14 12 20 0 36 12 36 32 0 18-16 30-36 30-26 0-46-18-46-44 0-12 6-20 8-30V22c0-5 4-8 12-8z"/>`,
    duenndarm: `<circle cx="60" cy="60" r="44"/>
            <path d="M34 48c8-8 20 0 26-8s20-4 26 4M30 66c10-6 18 6 28 0s20-6 32 2M38 84c8-6 18 2 26-4s16-2 20 2" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="4" stroke-linecap="round"/>`,
    dickdarm: `<path d="M18 100V30c0-10 6-16 16-16h52c10 0 16 6 16 16v70h-18V34H36v66z"/>`,
    niere: `<path d="M64 14c22 0 40 20 40 46s-18 46-40 46c-16 0-26-10-26-22 0-8 6-12 6-24s-6-16-6-24c0-12 10-22 26-22z"/>`,
    harnblase: `<path d="M60 108c-24 0-42-16-42-40 0-26 18-46 42-46s42 20 42 46c0 24-18 40-42 40z"/>
            <path d="M48 18l-10-10M72 18l10-10" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="5" stroke-linecap="round"/>`,
};

const FACES = {
    // [Augen-y, Mund-y] je Figur, damit das Gesicht auf der Silhouette sitzt
    gehirn: [52, 72], herz: [48, 66], lunge: [62, 80], leber: [46, 62], magen: [74, 90],
    duenndarm: [52, 72], dickdarm: [54, 74], niere: [52, 72], harnblase: [60, 80],
};

export function organSvg(id, color) {
    const shape = SHAPES[id] || SHAPES.herz;
    const [eye, mouth] = FACES[id] || [50, 70];
    return `<svg viewBox="0 0 120 120" role="img" aria-hidden="true" class="organ-art">
        <g fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width="2.5" stroke-linejoin="round">${shape}</g>
        <g>
            <ellipse cx="48" cy="${eye}" rx="7" ry="8" fill="#fff" stroke="#222" stroke-width="2"/>
            <ellipse cx="72" cy="${eye}" rx="7" ry="8" fill="#fff" stroke="#222" stroke-width="2"/>
            <circle cx="50" cy="${eye + 2}" r="3.2" fill="#222"/>
            <circle cx="74" cy="${eye + 2}" r="3.2" fill="#222"/>
            <path d="M50 ${mouth}q10 9 20 0" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
            <circle cx="40" cy="${mouth - 4}" r="4" fill="#ff7b8a" opacity=".55"/>
            <circle cx="80" cy="${mouth - 4}" r="4" fill="#ff7b8a" opacity=".55"/>
        </g>
    </svg>`;
}
