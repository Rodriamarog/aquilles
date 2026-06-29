import db from '../src/db.js';

const PHONE_ID = '1078215982040649';
const TOKEN = 'EAAQZCGTS0O7EBRZAyVEWHjhyD1AnSZC9m8FNKpZAuWtqAzt6z1BB3QwoVW9pRtWvdk7ucqmbpCk3Y0qVVada32ZCtc4Gk5C2Upukphq0RdnrUYXEDhEaNaTZCqoy7DdW5PQGEq7ng3Ke8CrnSJ215lA6qoqCqyr8Yz671eDVYN2vZAO0mCb2AjO0wqBlrpHQAZDZD';

const leads = db.prepare(`
  SELECT id, title, phone_normalized FROM leads
  WHERE phone_normalized IS NOT NULL AND has_real_website = 0
  ORDER BY title ASC
`).all();

console.log(`Checking ${leads.length} numbers...`);

const BATCH = 50;
let onWhatsapp = 0;
let notOnWhatsapp = 0;

const stmtUpdate = db.prepare(`UPDATE leads SET on_whatsapp = ? WHERE id = ?`);

for (let i = 0; i < leads.length; i += BATCH) {
  const batch = leads.slice(i, i + BATCH);
  const contacts = batch.map(l => '+' + l.phone_normalized);

  const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ blocking: 'wait', contacts, force_check: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`API error on batch ${i}-${i+BATCH}:`, err);
    continue;
  }

  const data = await res.json();
  const resultMap = {};
  for (const c of (data.contacts || [])) {
    resultMap[c.input] = c.status === 'valid';
  }

  for (const lead of batch) {
    const key = '+' + lead.phone_normalized;
    const isValid = resultMap[key] ?? false;
    stmtUpdate.run(isValid ? 1 : 0, lead.id);
    if (isValid) {
      onWhatsapp++;
      console.log(`  ✓ ${lead.title} (${lead.phone_normalized})`);
    } else {
      notOnWhatsapp++;
      console.log(`  ✗ ${lead.title}`);
    }
  }

  if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 1000));
}

console.log(`\nDone: ${onWhatsapp} on WhatsApp, ${notOnWhatsapp} not.`);
