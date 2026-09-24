window.__ModuleLoader__.load({ id: "@ohamlab/skill-free-model", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject(
    "sidebar.brand.name",
    () => ctx.slots.register(
      {
        name: "sidebar.brand.name",
        registrant: "@ohamlab/harness-brand"
      },
      OhamBrandName
    )
  );
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      {
        name: "shell.overlay",
        id: "oham-floating-fish",
        registrant: "@ohamlab/harness-brand"
      },
      FloatingFishOverlay
    )
  );
}
function OhamBrandName() {
  return (0, import_react.createElement)("span", {
    style: {
      fontFamily: "inherit",
      fontWeight: 600,
      fontSize: "15px",
      letterSpacing: "0.02em",
      background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text"
    }
  }, "OhamLab Harness");
}
var FISH_KEYFRAMES = `
@keyframes oham-fish-swim {
  0%   { transform: translate(-120px, 30vh) scaleX(1); }
  25%  { transform: translate(30vw, 15vh) scaleX(1); }
  45%  { transform: translate(70vw, 50vh) scaleX(1); }
  50%  { transform: translate(105vw, 45vh) scaleX(1); }
  50.1%{ transform: translate(-120px, 60vh) scaleX(-1); }
  75%  { transform: translate(40vw, 70vh) scaleX(-1); }
  95%  { transform: translate(105vw, 25vh) scaleX(-1); }
  100% { transform: translate(-120px, 30vh) scaleX(1); }
}
@keyframes oham-fish-bob {
  0%, 100% { margin-top: 0; }
  50%      { margin-top: -12px; }
}
@keyframes oham-bubble-rise {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-100px) scale(0.3); opacity: 0; }
}
@keyframes oham-burst-bubbles {
  0%   { transform: scale(1) translateY(0); opacity: 1; }
  100% { transform: scale(0.3) translateY(-80px); opacity: 0; }
}
`;
var styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  if (typeof document === "undefined") return;
  styleInjected = true;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@ohamlab/harness-brand";
  tag.textContent = FISH_KEYFRAMES;
  document.head.appendChild(tag);
}
function Bubble({ x, y, size, delay, id }) {
  return (0, import_react.createElement)("div", {
    key: `bubble-${id}`,
    style: {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      backgroundColor: "rgba(147, 197, 253, 0.6)",
      border: "1px solid rgba(96, 165, 250, 0.4)",
      animation: `oham-bubble-rise 2s ease-out ${delay}ms forwards`,
      pointerEvents: "none"
    }
  });
}
function BurstBubble({ x, y, size, id }) {
  return (0, import_react.createElement)("div", {
    key: `burst-${id}`,
    style: {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      background: "rgba(236, 72, 153, 0.8)",
      border: "1px solid rgba(196, 30, 58, 0.6)",
      animation: `oham-burst-bubbles 1.5s ease-out forwards`,
      pointerEvents: "none"
    }
  });
}
var MEDIUM_FISH_SVG = (0, import_react.createElement)(
  "svg",
  {
    width: 56,
    height: 32,
    viewBox: "0 0 56 32",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  },
  (0, import_react.createElement)("ellipse", { cx: 26, cy: 16, rx: 18, ry: 10, fill: "url(#fishGrad)" }),
  (0, import_react.createElement)("path", {
    d: "M38 16 L50 4 L46 16 L50 28 Z",
    fill: "#60a5fa",
    opacity: 0.9
  }),
  (0, import_react.createElement)("circle", { cx: 12, cy: 12, r: 2.5, fill: "#1e293b" }),
  (0, import_react.createElement)("circle", { cx: 11, cy: 11, r: 0.8, fill: "#fff" }),
  (0, import_react.createElement)("path", {
    d: "M22 4 Q26 0 30 4",
    stroke: "#818cf8",
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)("path", {
    d: "M22 28 Q26 32 30 28",
    stroke: "#818cf8",
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)("path", {
    d: "M5 16 Q8 18 5 20",
    stroke: "#475569",
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)(
    "defs",
    null,
    (0, import_react.createElement)(
      "linearGradient",
      {
        id: "fishGrad",
        x1: "5",
        y1: "4",
        x2: "45",
        y2: "26",
        gradientUnits: "userSpaceOnUse"
      },
      (0, import_react.createElement)("stop", { offset: "0%", stopColor: "#93c5fd" }),
      (0, import_react.createElement)("stop", { offset: "50%", stopColor: "#818cf8" }),
      (0, import_react.createElement)("stop", { offset: "100%", stopColor: "#c084fc" })
    )
  )
);
var BIG_FISH_SVG = (0, import_react.createElement)(
  "svg",
  {
    width: 88,
    height: 52,
    viewBox: "0 0 88 52",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  },
  (0, import_react.createElement)("ellipse", { cx: 42, cy: 24, rx: 35, ry: 18, fill: "url(#bigFishGrad)" }),
  (0, import_react.createElement)("path", {
    d: "M70 26 L84 14 L80 26 L84 38 Z",
    fill: "#ec4899",
    opacity: 0.95
  }),
  (0, import_react.createElement)("circle", { cx: 28, cy: 20, r: 5, fill: "#1e293b" }),
  (0, import_react.createElement)("circle", { cx: 27, cy: 19, r: 1, fill: "#fff" }),
  (0, import_react.createElement)("path", {
    d: "M44 8 Q48 0 52 8",
    stroke: "#f472b6",
    strokeWidth: 3,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)("path", {
    d: "M44 44 Q48 48 52 44",
    stroke: "#f472b6",
    strokeWidth: 2.5,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)("path", {
    d: "M12 26 Q16 30 12 34",
    stroke: "#f472b6",
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round"
  }),
  (0, import_react.createElement)(
    "defs",
    null,
    (0, import_react.createElement)(
      "linearGradient",
      {
        id: "bigFishGrad",
        x1: "8",
        y1: "10",
        x2: "75",
        y2: "40",
        gradientUnits: "userSpaceOnUse"
      },
      (0, import_react.createElement)("stop", { offset: "0%", stopColor: "#f472b6" }),
      (0, import_react.createElement)("stop", { offset: "50%", stopColor: "#ec4899" }),
      (0, import_react.createElement)("stop", { offset: "100%", stopColor: "#c084fc" })
    )
  )
);
function FloatingFishOverlay() {
  injectStyles();
  const [fish1, setFish1] = (0, import_react.useState)({ x: -60, y: window.innerHeight * 0.35, speed: 1, direction: 1 });
  const [fish2, setFish2] = (0, import_react.useState)({ x: -100, y: window.innerHeight * 0.45, speed: 0.7, direction: 1 });
  const [bubbles, setBubbles] = (0, import_react.useState)([]);
  let bubbleIdCounter = 0;
  const [speedBoost, setSpeedBoost] = (0, import_react.useState)(false);
  const [boostEndTime, setBoostEndTime] = (0, import_react.useState)(0);
  const fish1Ref = (0, import_react.useRef)(null);
  const fish2Ref = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const updatePositions = () => {
      const now = Date.now();
      const elapsed = now - (boostEndTime || 0);
      const effectiveSpeed1 = speedBoost && elapsed < 3e3 ? fish1.speed * 2.5 : fish1.speed;
      const effectiveSpeed2 = speedBoost && elapsed < 3e3 ? fish2.speed * 2.5 : fish2.speed;
      setFish1((prev) => {
        const newX = prev.x + effectiveSpeed1 * prev.direction;
        const newDirection = newX > window.innerWidth + 60 ? -1 : prev.direction;
        return { ...prev, x: newX, direction: newDirection };
      });
      setFish2((prev) => {
        const newX = prev.x + effectiveSpeed2 * prev.direction;
        const newDirection = newX > window.innerWidth + 88 ? -1 : prev.direction;
        return { ...prev, x: newX, direction: newDirection };
      });
      const dist = Math.hypot(fish1.x - fish2.x, fish1.y - fish2.y);
      if (dist < 80 && !speedBoost) {
        createCollisionBubbles(fish1.x + 28, fish1.y + 16);
      }
      requestAnimationFrame(updatePositions);
    };
    const raf = requestAnimationFrame(updatePositions);
    return () => cancelAnimationFrame(raf);
  }, [fish1, fish2, speedBoost, boostEndTime]);
  const createCollisionBubbles = (centerX, centerY) => {
    const burstBubbles = Array.from({ length: 12 }, (_, i) => ({
      id: bubbleIdCounter++,
      x: centerX,
      y: centerY,
      size: Math.random() * 20 + 12,
      type: "burst",
      delay: 0
    }));
    setBubbles((prev) => [...prev, ...burstBubbles]);
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.type !== "burst"));
    }, 1500);
  };
  (0, import_react.useEffect)(() => {
    const interval = setInterval(() => {
      if (speedBoost) {
        setBubbles((prev) => {
          const newBubble = {
            id: bubbleIdCounter++,
            x: fish2.x + 44,
            y: fish2.y + 26,
            size: Math.random() * 8 + 4,
            type: "rise",
            delay: Math.random() * 200
          };
          return [...prev.slice(-10), newBubble];
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [fish2, speedBoost]);
  const handleFishClick = () => {
    setSpeedBoost(true);
    setBoostEndTime(Date.now());
    const burst1 = Array.from({ length: 6 }, (_, i) => ({
      id: bubbleIdCounter++,
      x: fish1.x + 28 + (Math.random() - 0.5) * 30,
      y: fish1.y + 16 + (Math.random() - 0.5) * 15,
      size: Math.random() * 14 + 6,
      type: "burst",
      delay: Math.random() * 200
    }));
    const burst2 = Array.from({ length: 6 }, (_, i) => ({
      id: bubbleIdCounter++,
      x: fish2.x + 44 + (Math.random() - 0.5) * 30,
      y: fish2.y + 26 + (Math.random() - 0.5) * 15,
      size: Math.random() * 14 + 6,
      type: "burst",
      delay: Math.random() * 200
    }));
    setBubbles((prev) => [...prev, ...burst1, ...burst2]);
    setTimeout(() => setSpeedBoost(false), 3e3);
  };
  const fish1Anim = speedBoost ? "oham-fish-swim 6s linear infinite, oham-fish-bob 1s ease-in-out infinite" : "oham-fish-swim 28s linear infinite, oham-fish-bob 3s ease-in-out infinite";
  const fish2Anim = speedBoost ? "oham-fish-swim 10s linear infinite, oham-fish-bob 1.5s ease-in-out infinite" : "oham-fish-swim 22s linear infinite, oham-fish-bob 2.5s ease-in-out infinite";
  const collisionDistance = 80;
  const areFishClose = Math.hypot(fish1.x - fish2.x, fish1.y - fish2.y) < collisionDistance;
  return (0, import_react.createElement)(
    "div",
    {
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden"
      }
    },
    ...bubbles.map(
      (b, i) => b.type === "burst" ? BurstBubble({ x: b.x, y: b.y, size: b.size, id: b.id }) : Bubble({ x: b.x, y: b.y, size: b.size, id: b.id })
    ),
    // Render original medium fish (interactive)
    (0, import_react.createElement)(
      "div",
      {
        ref: fish1Ref,
        style: {
          position: "absolute",
          left: `${fish1.x}px`,
          top: `${fish1.y}px`,
          animation: fish1Anim,
          pointerEvents: "auto",
          // Allow clicks
          cursor: "pointer",
          filter: speedBoost ? "drop-shadow(0 4px 12px rgba(96,165,250,0.5))" : "drop-shadow(0 2px 8px rgba(96,165,250,0.35))"
        },
        onClick: handleFishClick
      },
      MEDIUM_FISH_SVG
    ),
    // Render big companion fish
    (0, import_react.createElement)(
      "div",
      {
        ref: fish2Ref,
        style: {
          position: "absolute",
          left: `${fish2.x}px`,
          top: `${fish2.y}px`,
          animation: fish2Anim,
          filter: speedBoost ? "drop-shadow(0 6px 16px rgba(236,72,153,0.5))" : "drop-shadow(0 3px 10px rgba(236,72,153,0.3))"
        }
      },
      BIG_FISH_SVG
    ),
    ...bubbles.filter((b) => b.type === "rise" && b.id % 3 === 0).map((b, i) => Bubble({ x: b.x, y: b.y, size: b.size, id: b.id }))
  );
}
return module.exports; } });
