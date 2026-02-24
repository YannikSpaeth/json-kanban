const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3210;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'board.json');
const INDEX_FILE = path.join(ROOT, 'index.html');

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      updatedAt: new Date().toISOString(),
      lists: [
        { id: uid(), title: 'To Do', taskIds: [] },
        { id: uid(), title: 'Doing', taskIds: [] },
        { id: uid(), title: 'Done', taskIds: [] }
      ],
      tasks: {}
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function readBoard() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeBoard(board) {
  board.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(board, null, 2), 'utf8');
}

function send(res, status, data, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/') {
    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/board') {
    return send(res, 200, readBoard());
  }

  if (req.method === 'POST' && url.pathname === '/api/board') {
    try {
      const incoming = await collectBody(req);
      if (!incoming || !Array.isArray(incoming.lists) || typeof incoming.tasks !== 'object') {
        return send(res, 400, { error: 'Invalid board format' });
      }
      writeBoard(incoming);
      return send(res, 200, { ok: true, updatedAt: incoming.updatedAt });
    } catch (e) {
      return send(res, 400, { error: 'Invalid JSON body' });
    }
  }

  return send(res, 404, { error: 'Not found' });
});

ensureDataFile();
server.listen(PORT, () => {
  console.log(`JSON Kanban running: http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
