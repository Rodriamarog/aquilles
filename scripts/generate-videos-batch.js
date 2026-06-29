import { mkdirSync, existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import db from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const videosDir = join(root, 'videos');
const tmpDir = join(root, '.tmp-video');
const publicDir = join(root, 'public');
mkdirSync(videosDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const LIMIT = parseInt(process.argv[2]) || 500;

const leads = db.prepare(`
  SELECT * FROM leads
  WHERE status = 'pending' AND has_real_website = 0 AND phone IS NOT NULL AND video_path IS NULL
  ORDER BY title ASC
  LIMIT ?
`).all(LIMIT);

if (leads.length === 0) {
  console.log('No leads to process.');
  process.exit(0);
}

console.log(`Processing ${leads.length} leads...\n`);

// Copy music once
const musicSrc = join(root, 'assets', 'bgm.mp3');
if (existsSync(musicSrc)) cpSync(musicSrc, join(publicDir, 'bgm.mp3'));

// Bundle Remotion once
console.log('Bundling Remotion project...');
const bundleDir = await bundle({
  entryPoint: join(root, 'src', 'video', 'index.jsx'),
  publicDir,
  webpackOverride: (config) => config,
});
console.log('Bundle ready.\n');

// Copy music into bundle dir too so staticFile() can find it
if (existsSync(musicSrc)) cpSync(musicSrc, join(bundleDir, 'bgm.mp3'));

// Launch Playwright once
const browser = await chromium.launch({ args: ['--disable-web-security'] });

const updateVideoPath = db.prepare(`UPDATE leads SET video_path = ?, updated_at = datetime('now') WHERE id = ?`);

async function captureScreenshots(slug) {
  const sitePath = `file://${join(root, 'sites', `${slug}.html`)}`;

  // Capture map
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
    const sections = await page.evaluate(() =>
      Array.from(document.querySelectorAll('section, footer')).map(el => ({
        top: el.offsetTop,
        height: el.offsetHeight,
      }))
    );
    const filename = `${slug}-${label}.png`;
    // Remotion serves static files from bundleDir/public/
    await page.screenshot({ path: join(bundleDir, 'public', filename), fullPage: true });
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.close();
    return { filename, pageHeight, sections };
  }

  const desktop = await captureFullPage(1280, 800, 'desktop');
  const mobile = await captureFullPage(390, 844, 'mobile');
  return { desktop, mobile };
}

let success = 0, skipped = 0, failed = 0;

for (const lead of leads) {
  const slug = slugify(lead.title);
  const sitePath = join(root, 'sites', `${slug}.html`);
  const num = success + skipped + failed + 1;

  if (!existsSync(sitePath)) {
    console.log(`  [${num}/${leads.length}] SKIP ${lead.title} (no site file)`);
    skipped++;
    continue;
  }

  console.log(`  [${num}/${leads.length}] ${lead.title}`);
  try {
    const { desktop, mobile } = await captureScreenshots(slug);
    console.log(`    screenshots done (desktop ${desktop.pageHeight}px, mobile ${mobile.pageHeight}px)`);

    const inputProps = {
      desktopScreenshot: desktop.filename,
      mobileScreenshot: mobile.filename,
      businessName: lead.title,
      desktopPageHeight: desktop.pageHeight,
      mobilePageHeight: mobile.pageHeight,
      sectionTops: desktop.sections.map(s => s.top),
    };

    const composition = await selectComposition({ serveUrl: bundleDir, id: 'Showcase', inputProps });
    const outputPath = join(videosDir, `${slug}.mp4`);
    await renderMedia({
      composition,
      serveUrl: bundleDir,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: { enableMultiProcessOnLinux: true },
    });

    updateVideoPath.run(join('videos', `${slug}.mp4`), lead.id);
    console.log(`    → videos/${slug}.mp4`);
    success++;
  } catch (err) {
    console.error(`    FAIL: ${err.message}`);
    failed++;
  }
}

await browser.close();
console.log(`\nDone: ${success} rendered, ${skipped} skipped, ${failed} failed`);
