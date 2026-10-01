// Inline SVG illustrations for the "choose a mode" cards.
// Colours come from CSS variables so they follow the theme and palette.

export const leaderboardArt = `
<svg viewBox="0 0 220 140" class="mode-art" aria-hidden="true">
  <rect x="10" y="10" width="200" height="120" rx="14" fill="var(--surface-2)"/>
  <g font-family="inherit" font-weight="700" font-size="13">
    <rect x="22" y="22" width="176" height="28" rx="8" fill="var(--accent)"/>
    <circle cx="38" cy="36" r="8" fill="var(--gold)"/>
    <text x="35" y="40" font-size="10" fill="#4a3300">1</text>
    <rect x="54" y="31" width="70" height="10" rx="5" fill="var(--accent-ink)" opacity=".9"/>
    <text x="186" y="41" text-anchor="end" fill="var(--accent-ink)">42</text>

    <rect x="22" y="56" width="176" height="28" rx="8" fill="var(--surface)"/>
    <circle cx="38" cy="70" r="8" fill="var(--silver)"/>
    <text x="35" y="74" font-size="10" fill="#333">2</text>
    <rect x="54" y="65" width="56" height="10" rx="5" fill="var(--text)" opacity=".55"/>
    <text x="186" y="75" text-anchor="end" fill="var(--text)">37</text>

    <rect x="22" y="90" width="176" height="28" rx="8" fill="var(--surface)"/>
    <circle cx="38" cy="104" r="8" fill="var(--bronze)"/>
    <text x="35" y="108" font-size="10" fill="#3a1d00">3</text>
    <rect x="54" y="99" width="80" height="10" rx="5" fill="var(--text)" opacity=".55"/>
    <text x="186" y="109" text-anchor="end" fill="var(--text)">29</text>
  </g>
</svg>`;

export const scoreboardArt = `
<svg viewBox="0 0 220 140" class="mode-art" aria-hidden="true">
  <rect x="10" y="10" width="200" height="120" rx="14" fill="var(--surface-2)"/>
  <path d="M42 34 h36 v22 c0 14 -10 22 -18 26 c-8 -4 -18 -12 -18 -26z" fill="var(--accent)"/>
  <circle cx="60" cy="52" r="7" fill="var(--accent-ink)" opacity=".85"/>
  <path d="M142 34 h36 v22 c0 14 -10 22 -18 26 c-8 -4 -18 -12 -18 -26z" fill="var(--accent-2)"/>
  <path d="M154 46 h12 v12 h-12z" fill="var(--accent-2-ink)" opacity=".85"/>
  <text x="110" y="70" text-anchor="middle" font-family="inherit" font-weight="800" font-size="30" fill="var(--text)">2 : 1</text>
  <rect x="38" y="96" width="44" height="8" rx="4" fill="var(--text)" opacity=".45"/>
  <rect x="138" y="96" width="44" height="8" rx="4" fill="var(--text)" opacity=".45"/>
  <rect x="46" y="110" width="28" height="6" rx="3" fill="var(--text)" opacity=".25"/>
  <rect x="146" y="110" width="28" height="6" rx="3" fill="var(--text)" opacity=".25"/>
</svg>`;
