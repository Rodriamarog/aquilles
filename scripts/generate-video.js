import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const videosDir = join(root, 'videos');
const tmpDir = join(root, '.tmp-video');
mkdirSync(videosDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/generate-video.js <site-slug>');
  process.exit(1);
}

const sitePath = `file://${join(root, 'sites', `${slug}.html`)}`;
const siteHtml = readFileSync(join(root, 'sites', `${slug}.html`), 'utf-8');
const businessName = siteHtml.match(/<h1>(.*?)<\/h1>/)?.[1] || slug;
const musicPath = join(root, 'assets', 'bgm.mp3');

console.log(`Generating video for "${businessName}"...`);

const browser = await chromium.launch({ args: ['--disable-web-security'] });

// Capture map element separately (iframe doesn't render in fullPage screenshots)
console.log('  Capturing map...');
const mapScreenshot = join(tmpDir, `${slug}-map.png`);
const mapPage = await browser.newPage();
await mapPage.setViewportSize({ width: 1280, height: 800 });
await mapPage.goto(sitePath, { waitUntil: 'networkidle' });
const mapEl = mapPage.locator('.location-map');
await mapEl.scrollIntoViewIfNeeded();
await mapPage.waitForTimeout(4000);
await mapEl.screenshot({ path: mapScreenshot });
await mapPage.close();

async function captureFullPage(viewportWidth, viewportHeight, label) {
  console.log(`  Capturing ${label}...`);
  const page = await browser.newPage();
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.goto(sitePath, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.reveal { opacity: 1 !important; transform: none !important; transition: none !important; }' });

  // Replace map iframe with static image
  await page.evaluate((imgPath) => {
    const iframe = document.querySelector('.location-map iframe');
    if (iframe) {
      const img = document.createElement('img');
      img.src = imgPath;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      iframe.replaceWith(img);
    }
  }, `file://${mapScreenshot}`);
  await page.waitForTimeout(500);

  // Get section positions
  const sections = await page.evaluate(() => {
    const els = document.querySelectorAll('section, footer');
    return Array.from(els).map(el => ({
      top: el.offsetTop,
      height: el.offsetHeight,
    }));
  });

  const screenshotPath = join(tmpDir, `${slug}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.close();
  return { path: screenshotPath, pageHeight, viewportHeight, sections };
}

const desktop = await captureFullPage(1280, 800, 'desktop');
const mobile = await captureFullPage(390, 844, 'mobile');

console.log(`  Desktop: ${desktop.sections.length} sections, ${desktop.pageHeight}px`);
console.log(`  Mobile: ${mobile.sections.length} sections, ${mobile.pageHeight}px`);

// Build section-by-section keyframes
const PAUSE_PER_SECTION = 1.2;
const SCROLL_PER_TRANSITION = 1.0;
const PAUSE_START = 2.0;
const PAUSE_END = 2.0;

const numSections = desktop.sections.length;
const TOTAL = PAUSE_START + (numSections * PAUSE_PER_SECTION) + ((numSections - 1) * SCROLL_PER_TRANSITION) + PAUSE_END;

function buildKeyframes(name, sections, pageHeight, viewportHeight, screenWidth, originalWidth) {
  const scale = screenWidth / originalWidth;
  const maxScroll = pageHeight - viewportHeight;
  let time = PAUSE_START;
  let keyframes = [];

  for (let i = 0; i < sections.length; i++) {
    const scrollTo = Math.min(sections[i].top, maxScroll);
    const px = scrollTo * scale;
    const pctStart = (time / TOTAL) * 100;

    if (i === 0) {
      keyframes.push(`  0%, ${pctStart.toFixed(2)}% { transform: translateY(-${px}px); }`);
    } else {
      keyframes.push(`  ${pctStart.toFixed(2)}% { transform: translateY(-${px}px); }`);
    }

    time += PAUSE_PER_SECTION;
    const pctEndPause = (time / TOTAL) * 100;
    keyframes.push(`  ${pctEndPause.toFixed(2)}% { transform: translateY(-${px}px); }`);

    if (i < sections.length - 1) {
      time += SCROLL_PER_TRANSITION;
    }
  }

  keyframes.push(`  100% { transform: translateY(-${Math.min(sections[sections.length - 1].top, maxScroll) * scale}px); }`);

  return `@keyframes ${name} {\n${keyframes.join('\n')}\n}`;
}

const laptopW = 700;
const laptopH = 438;
const phoneW = 230;
const phoneH = 440;

const desktopKeyframes = buildKeyframes('scrollDesktop', desktop.sections, desktop.pageHeight, 800, laptopW, 1280);
const mobileKeyframes = buildKeyframes('scrollMobile', mobile.sections, mobile.pageHeight, 844, phoneW, 390);

const showcaseHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 1280px; height: 720px; overflow: hidden;
  background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f0f4f8 100%);
  display: flex; align-items: center; justify-content: center; gap: 40px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  position: relative;
}
body::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 50% 50% at 25% 50%, rgba(0,180,160,0.04), transparent),
    radial-gradient(ellipse 40% 40% at 75% 40%, rgba(0,120,200,0.03), transparent);
}

.laptop { position: relative; z-index: 1; }
.laptop-bezel {
  width: ${laptopW + 20}px; background: #2d2d2f;
  border-radius: 14px 14px 0 0; border: 2px solid #444;
  padding: 10px 10px 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1);
}
.laptop-screen {
  width: ${laptopW}px; height: ${laptopH}px;
  border-radius: 4px; overflow: hidden; position: relative; background: #000;
}
.laptop-screen img {
  position: absolute; top: 0; left: 0;
  width: ${laptopW}px; height: auto;
  animation: scrollDesktop ${TOTAL}s ease-in-out forwards;
}
.laptop-base {
  width: ${laptopW + 80}px; height: 16px;
  background: linear-gradient(180deg, #3a3a3e 0%, #2d2d2f 100%);
  margin: 0 auto; border-radius: 0 0 6px 6px; position: relative;
}
.laptop-base::before {
  content: ''; position: absolute; top: 2px; left: 50%; transform: translateX(-50%);
  width: 70px; height: 4px; background: #222; border-radius: 0 0 3px 3px;
}
.laptop-hinge {
  width: ${laptopW + 40}px; height: 3px;
  background: linear-gradient(180deg, #4a4a4e, #3a3a3e); margin: 0 auto;
}

.phone { position: relative; z-index: 1; }
.phone-frame {
  width: ${phoneW + 28}px; height: ${phoneH + 56}px;
  background: #2d2d2f; border-radius: 32px;
  border: 3px solid #444;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1);
}
.phone-frame::before {
  content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 50px; height: 5px; background: #444; border-radius: 3px; z-index: 2;
}
.phone-screen {
  width: ${phoneW}px; height: ${phoneH}px;
  border-radius: 20px; overflow: hidden; position: relative; background: #000;
}
.phone-screen img {
  position: absolute; top: 0; left: 0;
  width: ${phoneW}px; height: auto;
  animation: scrollMobile ${TOTAL}s ease-in-out forwards;
}

${desktopKeyframes}
${mobileKeyframes}
</style></head>
<body>
  <div class="laptop">
    <div class="laptop-bezel">
      <div class="laptop-screen">
        <img src="file://${desktop.path}" alt="">
      </div>
    </div>
    <div class="laptop-hinge"></div>
    <div class="laptop-base"></div>
  </div>
  <div class="phone">
    <div class="phone-frame">
      <div class="phone-screen">
        <img src="file://${mobile.path}" alt="">
      </div>
    </div>
  </div>
</body></html>`;

const showcasePath = join(tmpDir, `showcase-${slug}.html`);
writeFileSync(showcasePath, showcaseHtml);

// Record
console.log(`  Recording ${TOTAL.toFixed(1)}s video...`);
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const recPage = await context.newPage();
await recPage.goto(`file://${showcasePath}`, { waitUntil: 'load' });
await recPage.waitForTimeout(1000);
await recPage.waitForTimeout(TOTAL * 1000);

await context.close();
await browser.close();

// Encode with ffmpeg — add music if available
const rawVideo = await recPage.video().path();
const outputPath = join(videosDir, `${slug}.mp4`);

const hasMusic = existsSync(musicPath);
if (hasMusic) {
  console.log('  Adding background music...');
  execSync(`ffmpeg -y -i "${rawVideo}" -ss 18 -i "${musicPath}" -vf "fps=30" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k -af "afade=t=in:d=1,afade=t=out:st=${(TOTAL - 2).toFixed(1)}:d=2,volume=0.4" -shortest "${outputPath}"`, { stdio: 'pipe' });
} else {
  console.log('  No music file found at assets/bgm.mp3 — encoding without audio');
  execSync(`ffmpeg -y -i "${rawVideo}" -vf "fps=30" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -an "${outputPath}"`, { stdio: 'pipe' });
}

try { unlinkSync(rawVideo); } catch {}

console.log(`\nDone! Video saved to: videos/${slug}.mp4`);
console.log(`Duration: ~${TOTAL.toFixed(0)}s | Sections: ${numSections}`);
if (!hasMusic) console.log('Tip: Drop an mp3 at assets/bgm.mp3 to add background music');
