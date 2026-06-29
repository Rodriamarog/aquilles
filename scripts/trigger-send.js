const PORT = 3876;

const res = await fetch(`http://127.0.0.1:${PORT}/send`, { method: 'POST' });
const text = await res.text();
console.log(`[trigger] ${res.status}: ${text.trim()}`);
