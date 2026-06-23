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
import { ServiceCards } from "./ServiceCards.jsx";

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

  // 30fps, ~22s = 660 frames
  // Scene 1: Intro text          0–100
  // Scene 2: Mockups reveal      80–240  (scroll hero + services)
  // Scene 3: Services zoom-in    220–370 (cards + cursor)
  // Scene 4: Mockups resume      350–520 (scroll map, language overlay)
  // Scene 5: Outro               500–660

  const S1_START = 0, S1_END = 100;
  const S2_START = 80, S2_END = 240;
  const S3_START = 220, S3_END = 370;
  const S4_START = 350, S4_END = 520;
  const S5_START = 500, S5_END = 660;

  const fade = (start, end) => interpolate(frame,
    [start, start + 20, end - 20, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scene1 = fade(S1_START, S1_END);
  const scene2 = fade(S2_START, S2_END);
  const scene3 = fade(S3_START, S3_END);
  const scene4 = fade(S4_START, S4_END);
  const scene5 = fade(S5_START, S5_END);

  // Mockups in scene 2 scroll only through hero → top of services
  const mockup2SectionTops = sectionTops.slice(0, 2);
  // Mockups in scene 4 scroll from location → CTA → footer
  const mockup4SectionTops = sectionTops.slice(3);

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

      {/* SCENE 2: Mockups — hero scroll */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: scene2,
        background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f0f4f8 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 50% 50% at 25% 50%, rgba(0,180,160,0.04), transparent), radial-gradient(ellipse 40% 40% at 75% 40%, rgba(0,120,200,0.03), transparent)",
        }} />
        <Mockups
          desktopScreenshot={desktopScreenshot}
          mobileScreenshot={mobileScreenshot}
          enterFrame={S2_START + 10}
          scrollStartFrame={S2_START + 40}
          scrollEndFrame={S2_END - 20}
          desktopPageHeight={desktopPageHeight}
          mobilePageHeight={mobilePageHeight}
          sectionTops={mockup2SectionTops}
        />
      </AbsoluteFill>

      {/* SCENE 3: Cards fly out of laptop */}
      {(() => {
        // Dim the mockups during card scene
        const mockupDim = interpolate(frame,
          [S3_START, S3_START + 20, S3_END - 20, S3_END],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const mockupBgOpacity = interpolate(frame,
          [S3_START, S3_START + 15],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <>
            {/* Dimmed mockups in background during card scene */}
            <AbsoluteFill style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: mockupDim * 0.15,
              background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f0f4f8 100%)",
              filter: "blur(3px)",
            }}>
              <Mockups
                desktopScreenshot={desktopScreenshot}
                mobileScreenshot={mobileScreenshot}
                enterFrame={S2_START + 10}
                scrollStartFrame={S2_START + 40}
                scrollEndFrame={S2_END - 20}
                desktopPageHeight={desktopPageHeight}
                mobilePageHeight={mobilePageHeight}
                sectionTops={mockup2SectionTops}
              />
            </AbsoluteFill>
            {/* White overlay to soften bg */}
            <AbsoluteFill style={{
              background: "rgba(250,250,250,0.85)",
              opacity: mockupBgOpacity,
            }} />
            {/* Cards flying out */}
            <ServiceCards
              enterFrame={S3_START + 10}
              exitFrame={S3_END - 25}
            />
          </>
        );
      })()}

      {/* SCENE 4: Mockups resume — map, CTA */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: scene4,
        background: "linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f0f4f8 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 50% 50% at 25% 50%, rgba(0,180,160,0.04), transparent), radial-gradient(ellipse 40% 40% at 75% 40%, rgba(0,120,200,0.03), transparent)",
        }} />
        <Mockups
          desktopScreenshot={desktopScreenshot}
          mobileScreenshot={mobileScreenshot}
          enterFrame={S4_START + 10}
          scrollStartFrame={S4_START + 30}
          scrollEndFrame={S4_END - 20}
          desktopPageHeight={desktopPageHeight}
          mobilePageHeight={mobilePageHeight}
          sectionTops={mockup4SectionTops}
        />
      </AbsoluteFill>

      {/* SCENE 4 overlay: language feature */}
      {(() => {
        const labelStart = S4_START + 60;
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

      {/* SCENE 5: Outro */}
      <AbsoluteFill style={{
        justifyContent: "center", alignItems: "center",
        opacity: scene5, padding: "0 100px",
      }}>
        <WordDrop
          text="¿Listo para recibir clientes?"
          startFrame={S5_START + 15}
          style={{
            fontSize: 60, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.03em", lineHeight: 1.15, textAlign: "center",
          }}
        />
      </AbsoluteFill>

      <Audio src={staticFile("bgm.mp3")} startFrom={18 * 30} volume={0.35} />
    </AbsoluteFill>
  );
};
