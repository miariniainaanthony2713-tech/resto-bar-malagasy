const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const { pool, initDB } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── Identifiants admin ───────────────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'restobar2024';

const sessions = new Map();
const crypto = require('crypto');

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return token;
}
function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (sessions.get(token) < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (isValidSession(token)) return next();
  res.status(401).json({ error: 'Non autorisé.' });
}

// ─── Multer (upload photos) ───────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'plat_' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Fichier non image'));
  }
});

// ─── Email ────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'ton.email@gmail.com',
    pass: process.env.EMAIL_PASS || 'ton_mot_de_passe_app'
  }
});

async function sendConfirmationEmail(reservation) {
  const dateStr = new Date(reservation.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  await transporter.sendMail({
    from: '"Resto Bar Malagasy" <' + (process.env.EMAIL_USER || 'ton.email@gmail.com') + '>',
    to: reservation.email,
    subject: 'Confirmation de votre réservation — Resto Bar Malagasy',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;color:#1A1A1A">
        <h2 style="color:#FF6B00">Resto Bar Malagasy</h2>
        <p>Bonjour <strong>${reservation.name}</strong>,</p>
        <p>Votre réservation a bien été reçue :</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #eee"><strong>Date</strong></td>
              <td style="padding:8px;border:1px solid #eee">${dateStr}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee"><strong>Téléphone</strong></td>
              <td style="padding:8px;border:1px solid #eee">${reservation.phone}</td></tr>
        </table>
        <p>Nous vous confirmerons votre réservation dans les meilleurs délais.</p>
        <p style="color:#999;font-size:12px">Resto Bar Malagasy · Antananarivo</p>
      </div>
    `
  });
}

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Admin login ──────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ token: createSession() });
  } else {
    res.status(401).json({ error: 'Identifiants incorrects.' });
  }
});
app.post('/api/admin/logout', (req, res) => {
  sessions.delete(req.headers['x-admin-token']);
  res.json({ ok: true });
});
app.get('/api/admin/check', (req, res) => {
  res.json({ valid: isValidSession(req.headers['x-admin-token']) });
});

// ════════════════════════════════════════════════════════════════
// COMMANDES
// ════════════════════════════════════════════════════════════════

app.get('/api/orders', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(rows.map(dbToOrder));
});

app.post('/api/orders', async (req, res) => {
  const { customerName, customerEmail, tableNumber, items, payment } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Panier vide.' });

  const total = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  const id = Date.now().toString();

  await pool.query(
    `INSERT INTO orders (id, customer_name, customer_email, table_number, items, total, payment, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'nouvelle')`,
    [id, customerName||'Client', customerEmail||'', tableNumber||'-',
     JSON.stringify(items), total, JSON.stringify(payment||null)]
  );

  const order = { id, customerName: customerName||'Client', customerEmail: customerEmail||'',
    tableNumber: tableNumber||'-', items, total, payment: payment||null,
    status: 'nouvelle', createdAt: new Date().toISOString() };

  io.emit('new-order', order);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
    [req.body.status, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
  const order = dbToOrder(rows[0]);
  io.emit('order-updated', order);
  res.json(order);
});

function dbToOrder(row) {
  return {
    id: row.id,
    orderNumber: String(row.order_number || 0).padStart(4, '0'),
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    tableNumber: row.table_number,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    total: row.total,
    payment: typeof row.payment === 'string' ? JSON.parse(row.payment) : row.payment,
    status: row.status,
    createdAt: row.created_at
  };
}

// Route publique — suivi de commande par numéro
app.get('/api/track/:orderNumber', async (req, res) => {
  const num = req.params.orderNumber.replace(/^#/, '').replace(/^0+/, '') || '0';
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE order_number=$1',
    [parseInt(num, 10)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Commande introuvable.' });
  const o = dbToOrder(rows[0]);
  // On renvoie uniquement les infos nécessaires (pas l'email)
  res.json({
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    tableNumber: o.tableNumber,
    items: o.items,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt
  });
});

// ════════════════════════════════════════════════════════════════
// MENU
// ════════════════════════════════════════════════════════════════

app.get('/api/menu', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu ORDER BY category, created_at');
  res.json(rows.map(dbToMenu));
});

app.post('/api/menu', requireAuth, upload.single('image'), async (req, res) => {
  const { name, price, category, subcategory } = req.body;
  if (!name || !price || !category)
    return res.status(400).json({ error: 'Champs manquants.' });

  const id = Date.now().toString();
  const image = req.file ? '/uploads/' + req.file.filename : '';
  await pool.query(
    'INSERT INTO menu (id, category, subcategory, name, price, image) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, category, subcategory||'', name.trim().toUpperCase(), Number(price), image]
  );

  const { rows } = await pool.query('SELECT * FROM menu ORDER BY category, created_at');
  io.emit('menu-updated', rows.map(dbToMenu));
  res.status(201).json(dbToMenu(rows.find(r => r.id === id)));
});

app.patch('/api/menu/:id', requireAuth, upload.single('image'), async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM menu WHERE id=$1', [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: 'Introuvable.' });

  const item = existing[0];
  const name  = req.body.name ? req.body.name.trim().toUpperCase() : item.name;
  const price = req.body.price ? Number(req.body.price) : item.price;
  const cat   = req.body.category || item.category;
  const sub   = req.body.subcategory !== undefined ? req.body.subcategory : item.subcategory;
  let image   = item.image;

  if (req.file) {
    if (image) { const old = path.join(__dirname, 'public', image); if (fs.existsSync(old)) fs.unlinkSync(old); }
    image = '/uploads/' + req.file.filename;
  }

  await pool.query(
    'UPDATE menu SET name=$1, price=$2, category=$3, subcategory=$4, image=$5 WHERE id=$6',
    [name, price, cat, sub, image, req.params.id]
  );

  const { rows } = await pool.query('SELECT * FROM menu ORDER BY category, created_at');
  io.emit('menu-updated', rows.map(dbToMenu));
  res.json(dbToMenu(rows.find(r => r.id === req.params.id)));
});

app.delete('/api/menu/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });

  if (rows[0].image) {
    const imgPath = path.join(__dirname, 'public', rows[0].image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  await pool.query('DELETE FROM menu WHERE id=$1', [req.params.id]);
  const { rows: menu } = await pool.query('SELECT * FROM menu ORDER BY category, created_at');
  io.emit('menu-updated', menu.map(dbToMenu));
  res.json({ deleted: true });
});

function dbToMenu(row) {
  return { id: row.id, category: row.category, subcategory: row.subcategory,
    name: row.name, price: row.price, image: row.image };
}

// ════════════════════════════════════════════════════════════════
// RÉSERVATIONS
// ════════════════════════════════════════════════════════════════

app.get('/api/reservations', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
  res.json(rows.map(dbToRes));
});

app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, date } = req.body;
  if (!name || !email || !date)
    return res.status(400).json({ error: 'Champs manquants.' });

  const id = Date.now().toString();
  await pool.query(
    'INSERT INTO reservations (id, name, email, phone, date, status) VALUES ($1,$2,$3,$4,$5,\'en_attente\')',
    [id, name.trim(), email.trim(), phone||'-', date]
  );

  const reservation = { id, name: name.trim(), email: email.trim(),
    phone: phone||'-', date, status: 'en_attente', createdAt: new Date().toISOString() };

  io.emit('new-reservation', reservation);

  try { await sendConfirmationEmail(reservation); }
  catch(err) { console.error('Email non envoyé :', err.message); }

  res.status(201).json(reservation);
});

app.patch('/api/reservations/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE reservations SET status=$1 WHERE id=$2 RETURNING *',
    [req.body.status, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
  const r = dbToRes(rows[0]);
  io.emit('reservation-updated', r);
  res.json(r);
});

function dbToRes(row) {
  return { id: row.id, name: row.name, email: row.email,
    phone: row.phone, date: row.date, status: row.status, createdAt: row.created_at };
}

// ════════════════════════════════════════════════════════════════
// TICKET EMAIL
// ════════════════════════════════════════════════════════════════

app.post('/api/send-ticket', async (req, res) => {
  const { email, order, total } = req.body;
  if (!email || !order) return res.status(400).json({ error: 'Données manquantes.' });

  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const itemsRows = order.items.map(i =>
    `<tr><td style="padding:8px 0;border-bottom:1px dashed #eee;font-size:13px">${i.quantity} × ${i.name}</td>
         <td style="text-align:right;padding:8px 0;border-bottom:1px dashed #eee;font-size:13px">${(i.price*i.quantity).toLocaleString('fr-FR')} Ar</td></tr>`
  ).join('');

  try {
    await transporter.sendMail({
      from: '"Resto Bar Malagasy" <' + (process.env.EMAIL_USER || 'ton.email@gmail.com') + '>',
      to: email,
      subject: '🧾 Votre ticket — Resto Bar Malagasy',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#1A1A1A">
          <div style="background:#1A1A1A;padding:20px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="color:#FF6B00;margin:0">RESTO BAR</h2>
            <h3 style="color:#fff;margin:4px 0;font-weight:400">MALAGASY</h3>
            <p style="color:#aaa;font-size:12px;margin:4px 0">${date}</p>
          </div>
          <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
            <p>Bonjour <strong>${order.customerName || 'Client'}</strong>, merci pour votre commande !</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0"><tbody>${itemsRows}</tbody></table>
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px;padding:10px 0;border-top:2px solid #1A1A1A">
              <span>TOTAL</span><span style="color:#FF6B00">${Number(total).toLocaleString('fr-FR')} Ar</span>
            </div>
            <p style="text-align:center;font-size:12px;color:#999;margin-top:20px">Merci de votre visite ! 🍽️</p>
          </div>
        </div>`
    });
    res.json({ sent: true });
  } catch(err) {
    console.error('Ticket email non envoyé :', err.message);
    res.status(500).json({ error: 'Erreur envoi email.' });
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('Client connecté :', socket.id);
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Serveur démarré  : http://localhost:${PORT}`);
    console.log(`Page admin       : http://localhost:${PORT}/admin.html`);
  });
}).catch(err => {
  console.error('Erreur base de données :', err.message);
  // Démarrer quand même sans DB pour le développement local
  server.listen(PORT, () => {
    console.log(`Serveur démarré (sans DB) : http://localhost:${PORT}`);
  });
});
