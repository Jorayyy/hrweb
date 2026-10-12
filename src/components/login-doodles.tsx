type Doodle = {
  icon: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  rotate: number;
};

const DOODLES: Doodle[] = [
  // — big feature doodles —
  { icon: "user", x: 9, y: 15, size: 82, duration: 26, delay: 0, opacity: 0.24, rotate: -8 },
  { icon: "trophy", x: 85, y: 11, size: 70, duration: 22, delay: 3, opacity: 0.2, rotate: 10 },
  { icon: "wallet", x: 13, y: 63, size: 62, duration: 28, delay: 1.5, opacity: 0.18, rotate: 6 },
  { icon: "target", x: 89, y: 61, size: 64, duration: 24, delay: 5, opacity: 0.22, rotate: -6 },
  { icon: "video-camera", x: 47, y: 7, size: 58, duration: 30, delay: 2, opacity: 0.16, rotate: 4 },
  { icon: "suitcase", x: 71, y: 83, size: 64, duration: 27, delay: 4, opacity: 0.19, rotate: 8 },
  { icon: "trend-up", x: 5, y: 90, size: 56, duration: 25, delay: 6, opacity: 0.17, rotate: -10 },
  { icon: "star", x: 93, y: 33, size: 54, duration: 29, delay: 1, opacity: 0.18, rotate: 12 },
  { icon: "user-add", x: 29, y: 85, size: 80, duration: 31, delay: 2.5, opacity: 0.2, rotate: -3 },
  { icon: "stopwatch", x: 61, y: 45, size: 48, duration: 23, delay: 3.5, opacity: 0.15, rotate: 5 },
  { icon: "tick", x: 21, y: 39, size: 46, duration: 21, delay: 7, opacity: 0.14, rotate: -12 },
  { icon: "search", x: 79, y: 47, size: 44, duration: 26, delay: 4.5, opacity: 0.16, rotate: 9 },
  { icon: "thumbs-up", x: 41, y: 63, size: 42, duration: 24, delay: 8, opacity: 0.15, rotate: -5 },
  { icon: "zap", x: 95, y: 78, size: 40, duration: 28, delay: 6.5, opacity: 0.17, rotate: 7 },
  { icon: "shield", x: 55, y: 22, size: 40, duration: 25, delay: 5.5, opacity: 0.14, rotate: 14 },
  { icon: "sync", x: 37, y: 45, size: 38, duration: 27, delay: 9, opacity: 0.13, rotate: -9 },
  { icon: "send", x: 66, y: 66, size: 36, duration: 22, delay: 7.5, opacity: 0.14, rotate: 3 },
  // — smaller filler marks for density —
  { icon: "user-female", x: 18, y: 26, size: 30, duration: 19, delay: 2, opacity: 0.12, rotate: 15 },
  { icon: "user-male", x: 74, y: 27, size: 28, duration: 21, delay: 4, opacity: 0.12, rotate: -14 },
  { icon: "tick", x: 33, y: 70, size: 26, duration: 20, delay: 6, opacity: 0.11, rotate: 8 },
  { icon: "zap", x: 88, y: 50, size: 24, duration: 23, delay: 3, opacity: 0.11, rotate: -6 },
  { icon: "star", x: 12, y: 45, size: 26, duration: 22, delay: 5, opacity: 0.11, rotate: 10 },
  { icon: "send", x: 50, y: 90, size: 28, duration: 24, delay: 1, opacity: 0.12, rotate: -8 },
  { icon: "zap", x: 27, y: 10, size: 22, duration: 25, delay: 8, opacity: 0.13, rotate: 5 },
  { icon: "tick", x: 64, y: 12, size: 20, duration: 26, delay: 2.5, opacity: 0.12, rotate: -12 },
  { icon: "star", x: 44, y: 33, size: 18, duration: 20, delay: 9, opacity: 0.13, rotate: 6 },
  { icon: "send", x: 82, y: 72, size: 20, duration: 21, delay: 6.5, opacity: 0.12, rotate: -5 },
  { icon: "tick", x: 6, y: 72, size: 24, duration: 23, delay: 7, opacity: 0.11, rotate: 12 },
  { icon: "zap", x: 97, y: 20, size: 22, duration: 19, delay: 4.5, opacity: 0.12, rotate: -10 },
  { icon: "star", x: 58, y: 78, size: 26, duration: 25, delay: 3.5, opacity: 0.11, rotate: 9 },
  { icon: "send", x: 3, y: 33, size: 24, duration: 22, delay: 5.5, opacity: 0.12, rotate: -7 },
];

export function LoginDoodles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-white">
      {DOODLES.map((d, i) => (
        <div
          key={i}
          className="absolute bg-current"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            ["--rot" as string]: `${d.rotate}deg`,
            transform: "translate(-50%, -50%)",
            animation: `doodle-float ${d.duration}s ease-in-out ${d.delay}s infinite`,
            maskImage: `url(/doodles/${d.icon}.svg)`,
            WebkitMaskImage: `url(/doodles/${d.icon}.svg)`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      ))}
    </div>
  );
}
