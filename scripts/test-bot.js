import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db.js';

const require = createRequire(import.meta.url);
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const conf = readFileSync(join(root, 'app.conf'), 'utf-8');
const INITIAL_PITCH = conf.match(/INITIAL_PITCH\s*=\s*"([^"]+)"/)?.[1]?.trim();

const TEST_NUMBER = '526633824933';
const testLead    = db.prepare('SELECT video_path FROM leads WHERE video_path IS NOT NULL LIMIT 1').get();
if (!testLead) { console.error('No videos ready yet'); process.exit(1); }
const TEST_VIDEO  = join(root, testLead.video_path);
let CHAT_ID       = TEST_NUMBER + '@c.us';
let pitched       = false;

const VIDEO_TEASE = 'Los de diseño grafico les prepararon un pequeño video jaja';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function typeAndSend(chatId, message) {
  const chat = await client.getChatById(chatId);
  await chat.sendStateTyping();
  await sleep(2000 + message.length * 30);
  await chat.clearState();
  await client.sendMessage(chatId, message);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('[test] Scan the QR code');
});

client.on('ready', async () => {
  console.log('[test] Ready — resolving number', TEST_NUMBER);
  const numberId = await client.getNumberId(TEST_NUMBER);
  if (!numberId) {
    console.error('[test] Number not found on WhatsApp:', TEST_NUMBER);
    process.exit(1);
  }
  CHAT_ID = numberId._serialized;
  console.log('[test] Sending opener to', CHAT_ID);
  await typeAndSend(CHAT_ID, 'Buen dia');
  console.log('[test] Opener sent. Reply to trigger the pitch sequence.');
});

client.on('message', async (msg) => {
  if (msg.from !== CHAT_ID) return;
  if (pitched) return;
  pitched = true;
  console.log('[test] Got reply:', msg.body);

  await sleep(10000);

  await typeAndSend(CHAT_ID, INITIAL_PITCH);
  console.log('[test] Pitch sent.');

  await sleep(5000);

  await typeAndSend(CHAT_ID, VIDEO_TEASE);
  console.log('[test] Video tease sent.');

  await sleep(5000);

  const chat = await client.getChatById(CHAT_ID);
  await chat.sendStateTyping();
  await sleep(2000);
  await chat.clearState();
  const media = MessageMedia.fromFilePath(TEST_VIDEO);
  await client.sendMessage(CHAT_ID, media);
  console.log('[test] Video sent. Test complete — Ctrl+C to exit.');
});

client.initialize();
