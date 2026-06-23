import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

const LAPTOP_W = 660;
const LAPTOP_H = 413;
const PHONE_W = 210;
const PHONE_H = 410;

export const Mockups = ({
  desktopScreenshot,
  mobileScreenshot,
  enterFrame,
  scrollStartFrame,
  scrollEndFrame,
  desktopPageHeight,
  mobilePageHeight,
  sectionTops,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 28, stiffness: 120 },
  });

  const scale = interpolate(enterProgress, [0, 1], [0.85, 1]);
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const y = interpolate(enterProgress, [0, 1], [40, 0]);

  // Section-by-section scroll
  const desktopMaxScroll = desktopPageHeight - 800;
  const mobileMaxScroll = mobilePageHeight - 844;
  const desktopScale = LAPTOP_W / 1280;
  const mobileScale = PHONE_W / 390;

  const sections = sectionTops || [0];
  const scrollDuration = scrollEndFrame - scrollStartFrame;
  const framesPerSection = scrollDuration / Math.max(sections.length, 1);
  const pauseFrames = Math.floor(framesPerSection * 0.35);
  const scrollFrames = Math.ceil(framesPerSection * 0.65);

  let desktopY = 0;
  let mobileY = 0;

  if (frame >= scrollStartFrame && sections.length > 1) {
    const scrollLocalFrame = Math.min(frame - scrollStartFrame, scrollDuration);
    const sectionIndex = Math.min(
      Math.floor(scrollLocalFrame / framesPerSection),
      sections.length - 1
    );
    const sectionLocalFrame = scrollLocalFrame - sectionIndex * framesPerSection;

    const currentTop = sections[sectionIndex];
    const nextTop = sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : currentTop;

    let t = 0;
    if (sectionLocalFrame > pauseFrames) {
      const raw = (sectionLocalFrame - pauseFrames) / scrollFrames;
      t = Math.min(raw, 1);
      t = t * t * (3 - 2 * t); // smoothstep
    }

    const desktopPos = currentTop + (nextTop - currentTop) * t;
    const mobilePos = currentTop + (nextTop - currentTop) * t;

    desktopY = Math.min(desktopPos, desktopMaxScroll) * desktopScale;
    mobileY = Math.min(mobilePos * (mobilePageHeight / desktopPageHeight), mobileMaxScroll) * mobileScale;
  }

  // Fade out at the very end
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity: opacity * fadeOut,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      {/* Laptop */}
      <div>
        <div
          style={{
            width: LAPTOP_W + 20,
            background: "#2d2d2f",
            borderRadius: "14px 14px 0 0",
            border: "2px solid #444",
            padding: "10px 10px 8px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              width: LAPTOP_W,
              height: LAPTOP_H,
              borderRadius: 4,
              overflow: "hidden",
              position: "relative",
              background: "#000",
            }}
          >
            <Img
              src={staticFile(desktopScreenshot)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: LAPTOP_W,
                transform: `translateY(-${desktopY}px)`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: LAPTOP_W + 40,
            height: 3,
            background: "linear-gradient(180deg, #4a4a4e, #3a3a3e)",
            margin: "0 auto",
          }}
        />
        <div
          style={{
            width: LAPTOP_W + 80,
            height: 16,
            background: "linear-gradient(180deg, #3a3a3e 0%, #2d2d2f 100%)",
            margin: "0 auto",
            borderRadius: "0 0 6px 6px",
          }}
        />
      </div>

      {/* Phone */}
      <div
        style={{
          width: PHONE_W + 28,
          height: PHONE_H + 56,
          background: "#2d2d2f",
          borderRadius: 32,
          border: "3px solid #444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 50,
            height: 5,
            background: "#444",
            borderRadius: 3,
            zIndex: 2,
          }}
        />
        <div
          style={{
            width: PHONE_W,
            height: PHONE_H,
            borderRadius: 20,
            overflow: "hidden",
            position: "relative",
            background: "#000",
          }}
        >
          <Img
            src={staticFile(mobileScreenshot)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: PHONE_W,
              transform: `translateY(-${mobileY}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
