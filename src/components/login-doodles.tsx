type Doodle = {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  rotate: number;
  art: React.ReactNode;
};

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DOT = (
  <g {...S} strokeWidth={3}>
    <path d="M32 32 h0.01" />
  </g>
);

const SPARK = (
  <g {...S} strokeWidth={2}>
    <path d="M32 14 C33 26 38 31 50 32 C38 33 33 38 32 50 C31 38 26 33 14 32 C26 31 31 26 32 14 Z" />
  </g>
);

const SQUIGGLE = (
  <g {...S} strokeWidth={2.4}>
    <path d="M8 40 C14 22 22 58 30 40 C38 22 46 58 54 40 C58 30 62 34 70 30" />
  </g>
);

const DASHES = (
  <g {...S} strokeWidth={2.6}>
    <path d="M12 24 l10 -4M20 40 l12 -2M34 20 l8 -6M40 44 l10 0M52 28 l8 -4" />
  </g>
);

const RING = (
  <g {...S} strokeWidth={2.4}>
    <path d="M18 32 C18 22 46 22 46 32 C46 44 18 44 18 32 Z" />
  </g>
);

const DOODLES: Doodle[] = [
  // — big feature doodles —
  {
    x: 9, y: 15, size: 82, duration: 26, delay: 0, opacity: 0.24, rotate: -8,
    art: (
      <g {...S}>
        <path d="M14 46 C13 20 55 20 55 46" />
        <rect x="5" y="42" width="15" height="24" rx="7" />
        <rect x="51" y="42" width="15" height="24" rx="7" />
        <path d="M58 64 C60 70 54 74 44 74 L38 74" />
        <circle cx="34" cy="74" r="3.5" />
      </g>
    ),
  },
  {
    x: 85, y: 11, size: 70, duration: 22, delay: 3, opacity: 0.2, rotate: 10,
    art: (
      <g {...S}>
        <path d="M11 15 L59 15 C66 15 68 18 68 24 L68 40 C68 47 65 49 58 49 L34 49 L18 64 L18 49 L12 49 C6 49 4 46 4 40 L4 24 C4 17 5 15 11 15 Z" />
        <path d="M20 29 h12M20 38 h26" />
      </g>
    ),
  },
  {
    x: 13, y: 63, size: 62, duration: 28, delay: 1.5, opacity: 0.18, rotate: 6,
    art: (
      <g {...S}>
        <path d="M13 27 L45 27 L45 44 C45 52 39 58 29 58 C19 58 13 52 13 44 Z" />
        <path d="M45 31 C54 31 56 34 56 39 C56 44 53 47 45 47" />
        <path d="M21 11 C20 6 24 4 22 -1M30 11 C29 3 34 2 32 -4M39 11 C38 6 42 4 40 -1" />
      </g>
    ),
  },
  {
    x: 89, y: 61, size: 64, duration: 24, delay: 5, opacity: 0.22, rotate: -6,
    art: (
      <g {...S}>
        <path d="M34 10 C20 10 9 21 9 35 C9 49 20 60 34 60 C48 60 60 50 60 36 C60 22 48 10 34 10 Z" />
        <path d="M34 36 L34 21M34 36 L46 44" />
        <path d="M26 8 h16" />
      </g>
    ),
  },
  {
    x: 47, y: 7, size: 58, duration: 30, delay: 2, opacity: 0.16, rotate: 4,
    art: (
      <g {...S}>
        <path d="M52 12 C30 8 12 24 14 44 C16 60 40 66 54 52 C44 54 34 48 33 38 C32 26 44 18 52 12 Z" />
        <path d="M12 16 l1.5 4.5L18 22l-4.5 1.5L12 28l-1.5-4.5L6 22l4.5-1.5Z" />
      </g>
    ),
  },
  {
    x: 71, y: 83, size: 64, duration: 27, delay: 4, opacity: 0.19, rotate: 8,
    art: (
      <g {...S}>
        <path d="M15 17 L53 17 L53 45 L15 45 Z" />
        <path d="M7 45 L61 45 L67 59 L1 59 Z" />
        <path d="M24 31 h22" />
      </g>
    ),
  },
  {
    x: 5, y: 90, size: 56, duration: 25, delay: 6, opacity: 0.17, rotate: -10,
    art: (
      <g {...S}>
        <path d="M11 60 L11 33M26 60 L26 15M41 60 L41 45M56 60 L56 8" />
        <path d="M5 64 L62 64" />
      </g>
    ),
  },
  {
    x: 93, y: 33, size: 54, duration: 29, delay: 1, opacity: 0.18, rotate: 12,
    art: (
      <g {...S}>
        <path d="M34 12 C24 12 16 20 16 30 C16 40 24 48 34 48 C44 48 52 40 52 30 C52 20 44 12 34 12 Z" />
        <path d="M34 30 C34 26 38 24 41 27 C44 30 41 36 34 40 C27 36 24 30 27 27 C30 24 34 26 34 30 Z" />
        <path d="M34 6 v6M34 54 v6M8 30 h6M54 30 h6M15 11 l4 4M49 45 l4 4M53 11 l-4 4M19 45 l-4 4" />
      </g>
    ),
  },
  {
    x: 29, y: 85, size: 80, duration: 31, delay: 2.5, opacity: 0.2, rotate: -3,
    art: (
      <g {...S}>
        <path d="M7 45 L64 45 L54 31 L25 31 L16 45 Z" />
        <path d="M25 31 L25 15 L52 15 L52 31" />
        <path d="M22 54 C21 49 27 49 26 54 C25 59 31 59 30 54 C29 49 35 49 34 54 C33 59 39 59 38 54 C37 49 43 49 42 54 C41 59 47 59 46 54" />
        <path d="M64 40 h7" />
      </g>
    ),
  },
  {
    x: 61, y: 45, size: 48, duration: 23, delay: 3.5, opacity: 0.15, rotate: 5,
    art: (
      <g {...S}>
        <path d="M32 12 C18 12 8 22 8 34 C8 46 18 56 32 56 C46 56 56 46 56 34 C56 22 46 12 32 12 Z" />
        <path d="M24 30 c1 -3 5 -3 6 0M38 30 c1 -3 5 -3 6 0" />
        <path d="M24 40 C30 48 38 48 44 40" />
        <path d="M32 6 v6M32 56 v6M6 34 h6M52 34 h6" />
      </g>
    ),
  },
  {
    x: 21, y: 39, size: 46, duration: 21, delay: 7, opacity: 0.14, rotate: -12,
    art: (
      <g {...S}>
        <path d="M17 8 L47 8 C50 8 51 10 51 13 L51 53 C51 56 50 58 47 58 L17 58 C14 58 13 56 13 53 L13 13 C13 10 14 8 17 8 Z" />
        <path d="M27 49 h10" />
        <path d="M21 18 h22" />
      </g>
    ),
  },
  {
    x: 79, y: 47, size: 44, duration: 26, delay: 4.5, opacity: 0.16, rotate: 9,
    art: (
      <g {...S}>
        <path d="M8 18 L40 18 C46 18 48 21 48 27 L48 38 C48 44 45 47 39 47 L21 47 L10 57 L11 47 L9 47 C4 47 2 44 2 38 L2 27 C2 21 3 18 8 18 Z" />
        <path d="M28 32 L48 24 L50 33 L30 41 Z" />
      </g>
    ),
  },
  {
    x: 41, y: 63, size: 42, duration: 24, delay: 8, opacity: 0.15, rotate: -5,
    art: (
      <g {...S}>
        <path d="M9 40 L55 40 L47 27 L17 27 Z" />
        <path d="M15 27 L15 16 L49 16 L49 27" />
        <path d="M13 44 h5M47 44 h5" />
        <path d="M23 21 h14" />
      </g>
    ),
  },
  {
    x: 95, y: 78, size: 40, duration: 28, delay: 6.5, opacity: 0.17, rotate: 7,
    art: (
      <g {...S}>
        <path d="M32 10 C34 24 40 30 54 32 C40 34 34 40 32 54 C30 40 24 34 10 32 C24 30 30 24 32 10 Z" />
      </g>
    ),
  },
  {
    x: 55, y: 22, size: 40, duration: 25, delay: 5.5, opacity: 0.14, rotate: 14,
    art: (
      <g {...S}>
        <path d="M16 20 h24 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-12 l-9 7 v-7 h-3 a6 6 0 0 1 -6 -6 v-10 a6 6 0 0 1 6 -6 z" />
      </g>
    ),
  },
  {
    x: 37, y: 45, size: 38, duration: 27, delay: 9, opacity: 0.13, rotate: -9,
    art: (
      <g {...S}>
        <path d="M10 44 L26 20 L40 38 L50 26 L60 44 Z" />
        <circle cx="26" cy="20" r="2.5" />
        <circle cx="50" cy="26" r="2.5" />
      </g>
    ),
  },
  {
    x: 66, y: 66, size: 36, duration: 22, delay: 7.5, opacity: 0.14, rotate: 3,
    art: (
      <g {...S}>
        <path d="M20 44 C10 44 8 30 18 28 C18 16 36 16 36 28 C48 26 48 44 36 44 Z" />
        <path d="M28 44 v10M22 56 h12" />
      </g>
    ),
  },
  // — filler squiggles / marks for density —
  { x: 18, y: 26, size: 30, duration: 19, delay: 2, opacity: 0.12, rotate: 15, art: SQUIGGLE },
  { x: 74, y: 27, size: 28, duration: 21, delay: 4, opacity: 0.12, rotate: -14, art: SQUIGGLE },
  { x: 33, y: 70, size: 26, duration: 20, delay: 6, opacity: 0.11, rotate: 8, art: SQUIGGLE },
  { x: 88, y: 50, size: 24, duration: 23, delay: 3, opacity: 0.11, rotate: -6, art: DASHES },
  { x: 12, y: 45, size: 26, duration: 22, delay: 5, opacity: 0.11, rotate: 10, art: DASHES },
  { x: 50, y: 90, size: 28, duration: 24, delay: 1, opacity: 0.12, rotate: -8, art: RING },
  { x: 27, y: 10, size: 22, duration: 25, delay: 8, opacity: 0.13, rotate: 5, art: SPARK },
  { x: 64, y: 12, size: 20, duration: 26, delay: 2.5, opacity: 0.12, rotate: -12, art: SPARK },
  { x: 44, y: 33, size: 18, duration: 20, delay: 9, opacity: 0.13, rotate: 6, art: DOT },
  { x: 82, y: 72, size: 20, duration: 21, delay: 6.5, opacity: 0.12, rotate: -5, art: SPARK },
  { x: 6, y: 72, size: 24, duration: 23, delay: 7, opacity: 0.11, rotate: 12, art: RING },
  { x: 97, y: 20, size: 22, duration: 19, delay: 4.5, opacity: 0.12, rotate: -10, art: DOT },
  { x: 58, y: 78, size: 26, duration: 25, delay: 3.5, opacity: 0.11, rotate: 9, art: SQUIGGLE },
  { x: 3, y: 33, size: 24, duration: 22, delay: 5.5, opacity: 0.12, rotate: -7, art: DASHES },
];

export function LoginDoodles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-white">
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="doodle-rough" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {DOODLES.map((d, i) => (
        <svg
          key={i}
          viewBox="0 0 80 80"
          width={d.size}
          height={d.size}
          className="absolute"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            opacity: d.opacity,
            ["--rot" as string]: `${d.rotate}deg`,
            transform: "translate(-50%, -50%)",
            animation: `doodle-float ${d.duration}s ease-in-out ${d.delay}s infinite`,
          }}
        >
          <g filter="url(#doodle-rough)">{d.art}</g>
        </svg>
      ))}
    </div>
  );
}
