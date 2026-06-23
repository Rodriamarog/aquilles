import { Composition } from "remotion";
import { ShowcaseVideo } from "./ShowcaseVideo.jsx";

export const RemotionRoot = () => {
  const fps = 30;
  const durationInSeconds = 22;

  return (
    <Composition
      id="Showcase"
      component={ShowcaseVideo}
      durationInFrames={fps * durationInSeconds}
      fps={fps}
      width={1280}
      height={720}
      defaultProps={{
        desktopScreenshot: "",
        mobileScreenshot: "",
        businessName: "Dental Shine",
      }}
    />
  );
};
