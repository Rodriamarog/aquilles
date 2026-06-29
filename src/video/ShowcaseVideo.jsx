import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
  Audio,
  staticFile,
} from "remotion";
import { Mockups } from "./Mockups.jsx";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const WordDrop = ({ text, startFrame, style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px", ...style }}>
      {words.map((word, i) => {
        const delay = startFrame + i * 4;
        const progress = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 140, mass: 0.8 } });
        return (
          <span key={i} style={{
            display: "inline-block",
            opacity: interpolate(progress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(progress, [0, 1], [-60, 0])}px)`,
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const ShowcaseVideo = ({
  desktopScreenshot,
  mobileScreenshot,
  businessName,
  desktopPageHeight = 3644,
  mobilePageHeight = 5142,
  sectionTops = [0, 720, 1400, 2100, 2800, 3400],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 30fps, 14s = 420 frames
  // Scene 1: Intro text          0–100
  // Scene 2: Mockups full scroll 80–420

  const S1_START = 0, S1_END = 100;
  const S2_START = 80, S2_END = 420;

  const fade = (start, end) => interpolate(frame,
    [start, start + 20, end - 20, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scene1 = fade(S1_START, S1_END);
  const scene2 = fade(S2_START, S2_END);

  const mockupEnter = spring({ frame: frame - S2_START, fps, config: { damping: 28, stiffness: 120 } });
  const mockupScale = interpolate(mockupEnter, [0, 1], [0.85, 1]);
  const mockupY = interpolate(mockupEnter, [0, 1], [40, 0]);

  // Language overlay mid-scroll
  const labelStart = S2_START + 180;

  return (
    <AbsoluteFill style={{ background: "#fafafa", fontFamily: FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* SCENE 1: Intro */}
      <AbsoluteFill style={{
        justifyContent: "center", alignItems: "center",
        opacity: scene1, padding: "0 100px",
      }}>
        <WordDrop
          text={`Hola ${businessName}, te hicimos un sitio web`}
          startFrame={15}
          style={{
            fontSize: 52, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.03em", lineHeight: 1.2, textAlign: "center",
          }}
        />
      </AbsoluteFill>

      {/* SCENE 2: Mockups — full scroll */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: scene2,
        background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f0f4f8 100%)",
      }}>
        {/* Animated wavy lines */}
        <svg style={{ position: "absolute", inset: 0, width: 1280, height: 720, pointerEvents: "none" }}>
          {[
            { y: 120, amplitude: 30, frequency: 0.008, speed: 0.06, color: "rgba(13,148,136,0.12)", width: 2 },
            { y: 200, amplitude: 25, frequency: 0.006, speed: 0.05, color: "rgba(13,148,136,0.08)", width: 1.5 },
            { y: 360, amplitude: 35, frequency: 0.007, speed: 0.04, color: "rgba(59,130,246,0.10)", width: 2 },
            { y: 500, amplitude: 20, frequency: 0.009, speed: 0.07, color: "rgba(59,130,246,0.07)", width: 1.5 },
            { y: 600, amplitude: 28, frequency: 0.005, speed: 0.055, color: "rgba(13,148,136,0.09)", width: 1.8 },
            { y: 50, amplitude: 22, frequency: 0.01, speed: 0.065, color: "rgba(99,102,241,0.06)", width: 1.2 },
            { y: 670, amplitude: 18, frequency: 0.011, speed: 0.045, color: "rgba(99,102,241,0.05)", width: 1 },
          ].map((wave, i) => {
            const t = frame * wave.speed;
            const points = [];
            for (let x = -20; x <= 1300; x += 5) {
              const py = wave.y + Math.sin(x * wave.frequency + t) * wave.amplitude + Math.sin(x * wave.frequency * 0.5 + t * 1.3) * wave.amplitude * 0.4;
              points.push(`${x},${py}`);
            }
            return (
              <polyline
                key={i}
                points={points.join(" ")}
                fill="none"
                stroke={wave.color}
                strokeWidth={wave.width}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div style={{ transform: `translateY(${mockupY}px) scale(${mockupScale})` }}>
          <Mockups
            desktopScreenshot={desktopScreenshot}
            mobileScreenshot={mobileScreenshot}
            enterFrame={S2_START + 10}
            scrollStartFrame={S2_START + 40}
            scrollEndFrame={S2_END - 30}
            desktopPageHeight={desktopPageHeight}
            mobilePageHeight={mobilePageHeight}
            sectionTops={sectionTops}
          />
        </div>
      </AbsoluteFill>

      {/* Language overlay during scroll */}
      {(() => {
        const labelFadeIn = interpolate(frame, [labelStart, labelStart + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const labelFadeOut = interpolate(frame, [labelStart + 100, labelStart + 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const labelY = interpolate(
          spring({ frame: frame - labelStart, fps, config: { damping: 24, stiffness: 160 } }),
          [0, 1], [20, 0]
        );
        return (
          <AbsoluteFill style={{
            justifyContent: "flex-end", alignItems: "center", paddingBottom: 44,
            opacity: labelFadeIn * labelFadeOut, pointerEvents: "none",
          }}>
            <div style={{
              transform: `translateY(${labelY}px)`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
                Se adapta al idioma del cliente
              </span>
              <span style={{ fontSize: 28 }}>🇺🇸</span>
              <span style={{ fontSize: 22, color: "#94a3b8" }}>/</span>
              <span style={{ fontSize: 28 }}>🇲🇽</span>
            </div>
          </AbsoluteFill>
        );
      })()}

      <Audio src={staticFile("bgm.mp3")} startFrom={18 * 30} volume={0.35} />
    </AbsoluteFill>
  );
};
