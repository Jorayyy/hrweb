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

/* Hand-drawn sketch paths: fill none, round caps, deliberately wobbly. */
const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DOODLES: Doodle[] = [
  {
    x: 8, y: 16, size: 76, duration: 26, delay: 0, opacity: 0.22, rotate: -8,
    art: (
      <g {...S}>
        <path d="M14 44v-8a22 22 0 0 1 44 0v8" />
        <rect x="6" y="40" width="14" height="22" rx="6" />
        <rect x="52" y="40" width="14" height="22" rx="6" />
        <path d="M58 62v4a8 8 0 0 1-8 8H40" />
        <circle cx="36" cy="74" r="3" />
      </g>
    ),
  },
  {
    x: 84, y: 12, size: 64, duration: 22, delay: 3, opacity: 0.18, rotate: 10,
    art: (
      <g {...S}>
        <path d="M12 16h52a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H34L18 66V50h-6a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z" />
        <path d="M24 30h10M24 38h24" />
      </g>
    ),
  },
  {
    x: 14, y: 62, size: 58, duration: 28, delay: 1.5, opacity: 0.16, rotate: 6,
    art: (
      <g {...S}>
        <path d="M14 26h30v18a15 15 0 0 1-30 0z" />
        <path d="M44 30h6a8 8 0 0 1 0 16h-6" />
        <path d="M22 10v-6M30 10v-9M38 10v-6" />
      </g>
    ),
  },
  {
    x: 88, y: 60, size: 62, duration: 24, delay: 5, opacity: 0.2, rotate: -6,
    art: (
      <g {...S}>
        <circle cx="34" cy="36" r="24" />
        <path d="M34 36V20M34 36l12 8" />
        <path d="M26 8h16" />
      </g>
    ),
  },
  {
    x: 46, y: 8, size: 54, duration: 30, delay: 2, opacity: 0.14, rotate: 4,
    art: (
      <g {...S}>
        <path d="M50 12a24 24 0 1 0 0 48 20 20 0 0 1 0-48z" />
        <path d="M14 16l1.5 4.5L20 22l-4.5 1.5L14 28l-1.5-4.5L8 22l4.5-1.5z" />
      </g>
    ),
  },
  {
    x: 70, y: 82, size: 60, duration: 27, delay: 4, opacity: 0.17, rotate: 8,
    art: (
      <g {...S}>
        <path d="M16 18h36v26H16z" />
        <path d="M8 44h52l6 12H2z" />
        <path d="M24 30h20" />
      </g>
    ),
  },
  {
    x: 6, y: 88, size: 52, duration: 25, delay: 6, opacity: 0.15, rotate: -10,
    art: (
      <g {...S}>
        <path d="M10 58V34M24 58V18M38 58V42M52 58V10" />
        <path d="M6 62h52" />
      </g>
    ),
  },
  {
    x: 92, y: 34, size: 50, duration: 29, delay: 1, opacity: 0.16, rotate: 12,
    art: (
      <g {...S}>
        <circle cx="32" cy="32" r="12" />
        <circle cx="32" cy="32" r="5" />
        <path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" />
      </g>
    ),
  },
  {
    x: 30, y: 84, size: 78, duration: 31, delay: 2.5, opacity: 0.18, rotate: -3,
    art: (
      <g {...S}>
        <path d="M8 44h56v-14l-10-12H26L16 30H8z" />
        <path d="M26 30h24" />
        <circle cx="22" cy="52" r="6" />
        <circle cx="52" cy="52" r="6" />
        <path d="M64 40h6" />
      </g>
    ),
  },
  {
    x: 60, y: 44, size: 46, duration: 23, delay: 3.5, opacity: 0.13, rotate: 5,
    art: (
      <g {...S}>
        <circle cx="32" cy="30" r="16" />
        <path d="M32 14V6M32 54v-8M8 30h8M48 30h8M14 12l6 6M44 42l6 6M50 12l-6 6M20 42l-6 6" />
        <circle cx="26" cy="28" r="1.5" />
        <circle cx="38" cy="28" r="1.5" />
        <path d="M26 36a8 8 0 0 0 12 0" />
      </g>
    ),
  },
  {
    x: 22, y: 38, size: 44, duration: 21, delay: 7, opacity: 0.12, rotate: -12,
    art: (
      <g {...S}>
        <rect x="18" y="8" width="28" height="48" rx="5" />
        <path d="M28 48h8" />
        <path d="M24 18h16" />
      </g>
    ),
  },
  {
    x: 78, y: 46, size: 42, duration: 26, delay: 4.5, opacity: 0.14, rotate: 9,
    art: (
      <g {...S}>
        <path d="M8 20h32a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H22l-10 8v-8H8a5 5 0 0 1-5-5V25a5 5 0 0 1 5-5z" />
        <path d="M28 34h20a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-8l-7 6v-6" />
      </g>
    ),
  },
  {
    x: 40, y: 62, size: 40, duration: 24, delay: 8, opacity: 0.13, rotate: -5,
    art: (
      <g {...S}>
        <path d="M10 40h44v-6l-8-10H18l-8 10z" />
        <path d="M16 24v-6h32v6" />
        <path d="M14 44h4M44 44h4" />
      </g>
    ),
  },
  {
    x: 94, y: 76, size: 38, duration: 28, delay: 6.5, opacity: 0.15, rotate: 7,
    art: (
      <g {...S}>
        <path d="M32 10l6 14 15 2-11 11 3 15-13-7-13 7 3-15L11 26l15-2z" />
      </g>
    ),
  },
];

export function LoginDoodles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-white">
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
          {d.art}
        </svg>
      ))}
    </div>
  );
}
