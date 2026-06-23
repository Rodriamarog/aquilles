import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'sites');
mkdirSync(outDir, { recursive: true });

const template = readFileSync(join(root, 'src', 'template.html'), 'utf-8');

function cleanPhone(phone) {
  return phone.replace(/[^0-9]/g, '');
}

function displayRating(score) {
  if (!score || score < 4.0) return '4.5';
  return score.toString();
}

function displayReviews(count) {
  if (!count || count < 5) return '20';
  return count.toString();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const leads = db.prepare(`
  SELECT * FROM leads
  WHERE has_real_website = 0 AND phone IS NOT NULL
  ORDER BY reviews_count DESC
`).all();

console.log(`Generating sites for ${leads.length} leads...\n`);

for (const lead of leads) {
  const address = [lead.street, lead.city, lead.state].filter(Boolean).join(', ');
  const phoneClean = cleanPhone(lead.phone);
  const slug = slugify(lead.title);

  const html = template
    .replaceAll('{{BUSINESS_NAME}}', lead.title)
    .replaceAll('{{PHONE}}', lead.phone)
    .replaceAll('{{PHONE_CLEAN}}', phoneClean)
    .replaceAll('{{CITY}}', lead.city || 'Tijuana')
    .replaceAll('{{ADDRESS}}', address)
    .replaceAll('{{ADDRESS_ENCODED}}', encodeURIComponent(lead.title + ', ' + address))
    .replaceAll('{{RATING}}', displayRating(lead.total_score))
    .replaceAll('{{REVIEWS_COUNT}}', displayReviews(lead.reviews_count))
    .replaceAll('{{YEARS}}', '10')
    .replaceAll('{{GOOGLE_MAPS_URL}}', lead.google_maps_url || '#');

  const filename = `${slug}.html`;
  writeFileSync(join(outDir, filename), html);
  console.log(`  ${filename}`);
}

console.log(`\nDone! ${leads.length} sites generated in sites/`);
