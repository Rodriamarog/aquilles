import db from '../src/db.js';

const cmd = process.argv[2];

const commands = {
  targets: () => {
    const rows = db.prepare(`
      SELECT id, title, phone, website, city, total_score, reviews_count, status, warmth
      FROM leads WHERE has_real_website = 0 AND phone IS NOT NULL
      ORDER BY reviews_count DESC
    `).all();
    console.log(`\n${rows.length} targets (phone + no real website):\n`);
    for (const r of rows) {
      const warmth = r.warmth ? ` [${r.warmth}]` : '';
      const fake = r.website ? ` (has: ${r.website})` : '';
      console.log(`  #${r.id} ${r.title} | ${r.phone} | ★${r.total_score} (${r.reviews_count} reviews) | ${r.status}${warmth}${fake}`);
    }
  },

  stats: () => {
    const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
    const byStatus = db.prepare('SELECT status, COUNT(*) as c FROM leads GROUP BY status').all();
    const byWarmth = db.prepare('SELECT warmth, COUNT(*) as c FROM leads WHERE warmth IS NOT NULL GROUP BY warmth').all();
    const targets = db.prepare('SELECT COUNT(*) as c FROM leads WHERE has_real_website = 0 AND phone IS NOT NULL').get().c;
    const noSite = db.prepare('SELECT COUNT(*) as c FROM leads WHERE website IS NULL AND phone IS NOT NULL').get().c;
    const fakeSite = targets - noSite;
    console.log(`\nTotal leads: ${total}`);
    console.log(`Targets: ${targets} (${noSite} no website + ${fakeSite} social/directory only)`);
    console.log(`\nBy status:`);
    byStatus.forEach(r => console.log(`  ${r.status}: ${r.c}`));
    if (byWarmth.length) {
      console.log(`\nBy warmth:`);
      byWarmth.forEach(r => console.log(`  ${r.warmth}: ${r.c}`));
    }
  },

  all: () => {
    const rows = db.prepare('SELECT id, title, phone, website, has_real_website, status FROM leads ORDER BY id').all();
    console.log(`\n${rows.length} leads:\n`);
    for (const r of rows) {
      const site = r.has_real_website ? '🌐' : r.website ? '📱' : '  ';
      console.log(`  ${site} #${r.id} ${r.title} | ${r.phone || 'no phone'} | ${r.status}`);
    }
  },
};

if (!cmd || !commands[cmd]) {
  console.log('Usage: node scripts/leads.js <command>');
  console.log('Commands: targets, stats, all');
  process.exit(1);
}

commands[cmd]();
