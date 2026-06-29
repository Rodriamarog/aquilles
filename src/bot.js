import { createRequire } from 'module';
import { readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import db from './db.js';

const require = createRequire(import.meta.url);
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Config
const conf = readFileSync(join(root, 'app.conf'), 'utf-8');
const INITIAL_PITCH = conf.match(/INITIAL_PITCH\s*=\s*"([^"]+)"/)?.[1]?.trim();
if (!INITIAL_PITCH) throw new Error('INITIAL_PITCH not found in app.conf');

const OPENER = 'Buen dia';
const VIDEO_TEASE = 'Los de diseño grafico les prepararon un pequeño video demostrativo';
const DAILY_LIMIT = 5;
const BETWEEN_LEADS_MS = 5 * 60 * 1000;
const TRIGGER_PORT = 3876;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function typeAndSend(chatId, message) {
  const chat = await client.getChatById(chatId);
  await chat.sendStateTyping();
  await sleep(2000 + message.length * 30);
  await chat.clearState();
  await client.sendMessage(chatId, message);
}

function toChatId(phoneNormalized) {
  return phoneNormalized + '@c.us';
}

// Prepared statements
const stmtInsertMsg = db.prepare(`INSERT INTO messages (lead_id, direction, body) VALUES (?, ?, ?)`);
const stmtSetContacted = db.prepare(`UPDATE leads SET status = 'contacted', updated_at = datetime('now') WHERE id = ?`);
const stmtSetPitched = db.prepare(`UPDATE leads SET status = 'pitched', video_path = NULL, updated_at = datetime('now') WHERE id = ?`);
const stmtFindByChatId = db.prepare(`SELECT * FROM leads WHERE phone_normalized = ?`);

function findLeadByChatId(chatId) {
  return stmtFindByChatId.get(chatId.replace('@c.us', '')) || null;
}

async function sendDailyBatch(client) {
  const leads = db.prepare(`
    SELECT * FROM leads
    WHERE status = 'pending' AND video_path IS NOT NULL
      AND has_real_website = 0 AND phone_normalized IS NOT NULL
      AND (on_whatsapp IS NULL OR on_whatsapp = 1)
    ORDER BY on_whatsapp DESC, title ASC LIMIT ?
  `).all(DAILY_LIMIT);

  if (leads.length === 0) {
    console.log('[bot] No pending leads with videos ready. Nothing sent today.');
    return;
  }

  console.log(`[bot] Sending opener to ${leads.length} leads (5 min apart)...`);
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    if (!lead.phone_normalized) {
      console.error(`  ✗ ${lead.title}: no normalized phone, skipping`);
      continue;
    }
    try {
      const numberId = await client.getNumberId(lead.phone_normalized);
      if (!numberId) {
        console.error(`  ✗ ${lead.title}: not on WhatsApp`);
        continue;
      }
      const chatId = numberId._serialized;
      await typeAndSend(chatId, OPENER);
      stmtInsertMsg.run(lead.id, 'sent', OPENER);
      stmtSetContacted.run(lead.id);
      console.log(`  → ${lead.title} (${lead.phone})`);
    } catch (err) {
      console.error(`  ✗ ${lead.title}: ${err.message}`);
    }
    if (i < leads.length - 1) {
      console.log(`[bot] Waiting 5 minutes before next lead...`);
      await sleep(BETWEEN_LEADS_MS);
    }
  }
  console.log('[bot] Batch done.');
}

async function deliverPitch(client, lead) {
  console.log(`[bot] Pitching ${lead.title}...`);
  try {
    const numberId = await client.getNumberId(lead.phone_normalized);
    if (!numberId) { console.error(`  ✗ ${lead.title}: not on WhatsApp`); return; }
    const chatId = numberId._serialized;
    await sleep(10000);

    await typeAndSend(chatId, INITIAL_PITCH);
    stmtInsertMsg.run(lead.id, 'sent', INITIAL_PITCH);

    await sleep(5000);

    await typeAndSend(chatId, VIDEO_TEASE);
    stmtInsertMsg.run(lead.id, 'sent', VIDEO_TEASE);

    await sleep(5000);

    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    await sleep(2000);
    await chat.clearState();
    const videoAbsPath = join(root, lead.video_path);
    const media = MessageMedia.fromFilePath(videoAbsPath);
    await client.sendMessage(chatId, media);
    stmtInsertMsg.run(lead.id, 'sent', '[video]');

    stmtSetPitched.run(lead.id);
    try { unlinkSync(videoAbsPath); } catch {}
    console.log(`  → Pitched and video deleted for ${lead.title}`);
  } catch (err) {
    console.error(`  ✗ Pitch failed for ${lead.title}: ${err.message}`);
  }
}

// WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('[bot] Scan the QR code above with WhatsApp');
});

client.on('ready', () => {
  console.log('[bot] Client is ready — waiting for manual trigger');

  let sending = false;
  http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/send') {
      if (sending) {
        res.writeHead(409).end('Batch already in progress\n');
        return;
      }
      res.writeHead(200).end('Batch started\n');
      sending = true;
      await sendDailyBatch(client);
      sending = false;
    } else if (req.method === 'POST' && req.url === '/test') {
      res.writeHead(200).end('Test message sending...\n');
      try {
        const numberId = await client.getNumberId('526633824933');
        if (!numberId) { console.error('[test] Number not found on WhatsApp'); return; }
        await typeAndSend(numberId._serialized, 'Buen dia (test)');
        console.log('[test] Message sent to 526633824933');
      } catch (err) {
        console.error('[test] Failed:', err.message);
      }
    } else if (req.method === 'POST' && req.url === '/send-one') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        const { phone } = JSON.parse(body);
        const lead = db.prepare(`SELECT * FROM leads WHERE phone_normalized = ?`).get(phone);
        if (!lead) { res.writeHead(404).end('Lead not found\n'); return; }
        res.writeHead(200).end(`Sending to ${lead.title}...\n`);
        try {
          const numberId = await client.getNumberId(phone);
          if (!numberId) { console.error(`[send-one] ${lead.title}: not on WhatsApp`); return; }
          await typeAndSend(numberId._serialized, OPENER);
          stmtInsertMsg.run(lead.id, 'sent', OPENER);
          stmtSetContacted.run(lead.id);
          console.log(`[send-one] → ${lead.title}`);
        } catch (err) {
          console.error(`[send-one] Failed: ${err.message}`);
        }
      });
    } else if (req.method === 'POST' && req.url === '/pitch-one') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        const { phone } = JSON.parse(body);
        const lead = db.prepare(`SELECT * FROM leads WHERE phone_normalized = ?`).get(phone);
        if (!lead) { res.writeHead(404).end('Lead not found\n'); return; }
        res.writeHead(200).end(`Pitching ${lead.title}...\n`);
        await deliverPitch(client, lead);
      });
    } else {
      res.writeHead(404).end('Not found\n');
    }
  }).listen(TRIGGER_PORT, '127.0.0.1', () => {
    console.log(`[bot] Trigger server listening on http://127.0.0.1:${TRIGGER_PORT}/send`);
  });
});

client.on('message', async (msg) => {
  if (msg.fromMe) return;
  console.log(`[bot] Incoming message from ${msg.from}: "${msg.body}"`);

  const lead = findLeadByChatId(msg.from);
  if (!lead) {
    console.log(`[bot] No lead found for ${msg.from}`);
    return;
  }

  stmtInsertMsg.run(lead.id, 'received', msg.body);
  console.log(`[bot] Reply from ${lead.title}: "${msg.body}"`);

  if (lead.status === 'contacted') {
    await deliverPitch(client, lead);
  }
});

client.on('auth_failure', (msg) => console.error('[bot] Auth failure:', msg));
client.on('disconnected', (reason) => console.log('[bot] Disconnected:', reason));

client.initialize();
