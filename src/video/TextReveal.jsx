import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export const TextReveal = ({ text, startFrame, style = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 12px",
        ...style,
      }}
    >
      {words.map((word, i) => {
        const delay = i * 3;
        const progress = spring({
          frame: localFrame - delay,
          fps,
          config: { damping: 30, stiffness: 200 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const y = interpolate(progress, [0, 1], [30, 0]);
        const blur = interpolate(progress, [0, 1], [8, 0]);

        return (
          <span
            key={i}
            style={{
              opacity,
              transform: `translateY(${y}px)`,
              filter: `blur(${blur}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
