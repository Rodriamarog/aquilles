import { readFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const videosDir = join(root, 'videos');
const tmpDir = join(root, '.tmp-video');
const publicDir = join(root, 'public');
mkdirSync(videosDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/render-video.js <site-slug>');
  process.exit(1);
}

const sitePath = `file://${join(root, 'sites', `${slug}.html`)}`;
const siteHtml = readFileSync(join(root, 'sites', `${slug}.html`), 'utf-8');
const businessName = siteHtml.match(/<h1>(.*?)<\/h1>/)?.[1] || slug;

// Copy music to public dir for Remotion's staticFile()
const musicSrc = join(root, 'assets', 'bgm.mp3');
if (existsSync(musicSrc)) {
  cpSync(musicSrc, join(publicDir, 'bgm.mp3'));
}

console.log(`Generating video for "${businessName}"...\n`);

// Step 1: Capture screenshots with Playwright
const browser = await chromium.launch({ args: ['--disable-web-security'] });

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

  const sections = await page.evaluate(() => {
    const els = document.querySelectorAll('section, footer');
    return Array.from(els).map(el => ({
      top: el.offsetTop,
      height: el.offsetHeight,
    }));
  });

  const screenshotPath = join(publicDir, `${slug}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.close();
  return { path: screenshotPath, filename: `${slug}-${label}.png`, pageHeight, sections };
}

const desktop = await captureFullPage(1280, 800, 'desktop');
const mobile = await captureFullPage(390, 844, 'mobile');
await browser.close();

console.log(`  Desktop: ${desktop.sections.length} sections, ${desktop.pageHeight}px`);
console.log(`  Mobile: ${mobile.sections.length} sections, ${mobile.pageHeight}px\n`);

// Step 2: Bundle and render with Remotion
console.log('  Bundling Remotion project...');
const bundled = await bundle({
  entryPoint: join(root, 'src', 'video', 'index.jsx'),
  publicDir,
  webpackOverride: (config) => config,
});

const inputProps = {
  desktopScreenshot: desktop.filename,
  mobileScreenshot: mobile.filename,
  businessName,
  desktopPageHeight: desktop.pageHeight,
  mobilePageHeight: mobile.pageHeight,
  sectionTops: desktop.sections.map(s => s.top),
};

console.log('  Selecting composition...');
const composition = await selectComposition({
  serveUrl: bundled,
  id: 'Showcase',
  inputProps,
});

const outputPath = join(videosDir, `${slug}.mp4`);
console.log('  Rendering video...');
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps,
  chromiumOptions: { enableMultiProcessOnLinux: true },
});

console.log(`\nDone! Video saved to: videos/${slug}.mp4`);
