import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const ICONS = [
  <svg key="0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-4.97 0-9-2.24-9-5v-4c0-2.76 4.03-5 9-5s9 2.24 9 5v4c0 2.76-4.03 5-9 5z"></path><path d="M12 8V2"></path><path d="M8 4l4-2 4 2"></path></svg>,
  <svg key="1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  <svg key="2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"></path><path d="M5.5 6.5L12 3l6.5 3.5"></path><path d="M3 12h18"></path><circle cx="12" cy="12" r="9"></circle></svg>,
  <svg key="3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
  <svg key="4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"></path></svg>,
  <svg key="5" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"></path></svg>,
];

const CARDS = [
  { title: "Limpieza Dental", desc: "Limpieza profesional para mantener tus dientes y encías en perfecto estado." },
  { title: "Ortodoncia", desc: "Tratamientos de alineación dental con brackets tradicionales e invisibles." },
  { title: "Implantes Dentales", desc: "Recupera piezas perdidas con implantes de titanio de última generación." },
  { title: "Blanqueamiento", desc: "Sonrisa más brillante con nuestro tratamiento de blanqueamiento profesional." },
  { title: "Endodoncia", desc: "Tratamientos de conducto para salvar piezas dentales dañadas." },
  { title: "Odontopediatría", desc: "Atención dental especializada para los más pequeños del hogar." },
];

const CARD_W = 420;
const CARD_H = 280;
const CARD_GAP = 60;
const CANVAS_W = 1280;
const CANVAS_H = 720;
const FRAMES_PER_CARD = 18;

const PRIMARY = "oklch(0.45 0.12 175)";
const PRIMARY_BG = "oklch(0.97 0.02 175)";
const BORDER = "oklch(0.92 0.005 260)";
const TEXT_COLOR = "oklch(0.20 0.02 260)";
const TEXT_MUTED = "oklch(0.50 0.01 260)";

const LAPTOP_CENTER_X = (CANVAS_W / 2) - 135;
const LAPTOP_CENTER_Y = CANVAS_H / 2;
const LAPTOP_SCALE = 0.15;

export const ServiceCards = ({ enterFrame, exitFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - enterFrame;

  if (localFrame < -5 || frame > exitFrame + 30) return null;

  // Enter: cards fly in from laptop
  const enterP = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.9 },
  });

  // Exit: cards fly back to laptop
  const exitLocal = frame - exitFrame;
  const exitP = exitLocal >= 0 ? spring({
    frame: exitLocal,
    fps,
    config: { damping: 22, stiffness: 120 },
  }) : 0;

  const flyT = exitLocal >= 0 ? 1 - exitP : enterP;

  // Carousel scroll — after enter completes, start sliding
  const carouselStartFrame = enterFrame + 18;
  const carouselFrame = frame - carouselStartFrame;
  const totalSlideFrames = FRAMES_PER_CARD * (CARDS.length - 1);

  let carouselProgress = 0;
  if (carouselFrame > 0 && carouselFrame < totalSlideFrames) {
    const currentSlide = Math.floor(carouselFrame / FRAMES_PER_CARD);
    const slideT = (carouselFrame % FRAMES_PER_CARD) / FRAMES_PER_CARD;
    const eased = slideT * slideT * (3 - 2 * slideT);
    carouselProgress = currentSlide + eased;
  } else if (carouselFrame >= totalSlideFrames) {
    carouselProgress = CARDS.length - 1;
  }

  const carouselX = -carouselProgress * (CARD_W + CARD_GAP);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute",
        top: (CANVAS_H - CARD_H) / 2,
        display: "flex",
        gap: CARD_GAP,
        transform: `translateX(${(CANVAS_W - CARD_W) / 2 + carouselX}px)`,
      }}>
        {CARDS.map((card, i) => {
          // Each card: fly from laptop to its carousel slot
          const staggerP = spring({
            frame: localFrame - i * 2,
            fps,
            config: { damping: 22, stiffness: 100, mass: 0.9 },
          });
          const cardFlyT = exitLocal >= 0 ? (1 - exitP) : staggerP;

          const finalX = i * (CARD_W + CARD_GAP);
          const startX = LAPTOP_CENTER_X - (CANVAS_W - CARD_W) / 2;
          const startY = LAPTOP_CENTER_Y - (CANVAS_H - CARD_H) / 2;

          const x = interpolate(cardFlyT, [0, 1], [startX - finalX, 0]);
          const y = interpolate(cardFlyT, [0, 1], [startY, 0]);
          const scale = interpolate(cardFlyT, [0, 1], [LAPTOP_SCALE, 1]);
          const opacity = interpolate(cardFlyT, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

          // Highlight current card in carousel
          const distFromCenter = Math.abs(carouselProgress - i);
          const isActive = distFromCenter < 0.5 && flyT > 0.8;

          return (
            <div key={i} style={{
              width: CARD_W,
              height: CARD_H,
              flexShrink: 0,
              background: "white",
              borderRadius: 24,
              border: `1.5px solid ${isActive ? "oklch(0.80 0.06 175)" : BORDER}`,
              boxShadow: isActive
                ? "0 8px 32px oklch(0.20 0.02 260 / 0.12)"
                : "0 2px 8px oklch(0.20 0.02 260 / 0.04)",
              padding: "32px 30px",
              transform: `translate(${x}px, ${y}px) scale(${scale})`,
              opacity,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: PRIMARY_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                color: PRIMARY,
              }}>
                {ICONS[i]}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: TEXT_COLOR,
                marginBottom: 10,
                letterSpacing: "-0.02em",
              }}>
                {card.title}
              </div>
              <div style={{
                fontSize: 15,
                color: TEXT_MUTED,
                lineHeight: 1.6,
              }}>
                {card.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
