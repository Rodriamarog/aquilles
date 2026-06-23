import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const NOT_REAL_WEBSITE_DOMAINS = [
  'facebook.com',
  'm.facebook.com',
  'instagram.com',
  'doctoralia.com.mx',
  'doctoranytime.mx',
  'sites.google.com',
  'wa.me',
  'linktr.ee',
  'i.mtr.bio',
  'canva.site',
  'ueniweb.com',
];

function hasRealWebsite(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return !NOT_REAL_WEBSITE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

const file = readdirSync(root).find(f => f.startsWith('dataset_crawler') && f.endsWith('.json'));
if (!file) {
  console.error('No dataset file found');
  process.exit(1);
}

const leads = JSON.parse(readFileSync(join(root, file), 'utf-8'));

const insert = db.prepare(`
  INSERT OR IGNORE INTO leads (title, phone, website, street, city, state, country_code,
    categories, category_name, total_score, reviews_count, google_maps_url, has_real_website)
  VALUES (@title, @phone, @website, @street, @city, @state, @countryCode,
    @categories, @categoryName, @totalScore, @reviewsCount, @url, @hasRealWebsite)
`);

const importAll = db.transaction((leads) => {
  let imported = 0;
  for (const lead of leads) {
    const result = insert.run({
      ...lead,
      categories: JSON.stringify(lead.categories || []),
      website: lead.website || null,
      phone: lead.phone || null,
      hasRealWebsite: hasRealWebsite(lead.website) ? 1 : 0,
    });
    if (result.changes > 0) imported++;
  }
  return imported;
});

const imported = importAll(leads);

// Update existing rows that weren't re-inserted
const updateExisting = db.prepare('UPDATE leads SET has_real_website = @hasRealWebsite WHERE website = @website');
const updateNull = db.prepare('UPDATE leads SET has_real_website = 0 WHERE website IS NULL');
db.transaction(() => {
  updateNull.run();
  for (const lead of leads) {
    if (lead.website) {
      updateExisting.run({
        website: lead.website,
        hasRealWebsite: hasRealWebsite(lead.website) ? 1 : 0,
      });
    }
  }
})();

const total = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
const targets = db.prepare('SELECT COUNT(*) as count FROM leads WHERE has_real_website = 0 AND phone IS NOT NULL').get().count;
const noSite = db.prepare('SELECT COUNT(*) as count FROM leads WHERE website IS NULL AND phone IS NOT NULL').get().count;
const fakeSite = targets - noSite;

console.log(`Imported ${imported} new leads (${total} total in DB)`);
console.log(`${targets} targets (phone + no real website)`);
console.log(`  ${noSite} with no website at all`);
console.log(`  ${fakeSite} with only social media / directory listing`);
