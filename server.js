const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── Chemins des fichiers de données ────────────────────────────────────────
const ORDERS_FILE       = path.join(__dirname, 'data', 'orders.json');
const MENU_FILE         = path.join(__dirname, 'data', 'menu.json');
const RESERVATIONS_FILE = path.join(__dirname, 'data', 'reservations.json');
const UPLOADS_DIR       = path.join(__dirname, 'public', 'uploads');

// ─── Utilitaires lecture / écriture JSON ────────────────────────────────────
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf-8');
  return raw ? JSON.parse(raw) : [];
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Configuration Multer (upload photos) ───────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'plat_' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Fichier non image'));
  }
});

// ─── Configuration email (Nodemailer / Gmail) ────────────────────────────────
// Remplace EMAIL et PASSWORD par tes vraies informations.
// Pour Gmail, crée un "mot de passe d'application" dans les paramètres Google.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'miariniainaanthony2713@gmail.com',
    pass: process.env.EMAIL_PASS || 'hncxvqddnfcgarze'
  }
});

async function sendConfirmationEmail(reservation) {
  const dateStr = new Date(reservation.date).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  await transporter.sendMail({
    from: '"Resto Bar Malagasy" <miariniainaanthony2713@gmail.com>',
    to: reservation.email,
    subject: 'Confirmation de votre réservation — Resto Bar Malagasy',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;color:#1A1A1A">
        <h2 style="color:#FF6B00">Resto Bar Malagasy</h2>
        <p>Bonjour <strong>${reservation.name}</strong>,</p>
        <p>Votre réservation a bien été reçue. Voici le récapitulatif :</p>
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

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — COMMANDES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/orders', (req, res) => res.json(readJSON(ORDERS_FILE)));

app.post('/api/orders', (req, res) => {
  const { customerName, tableNumber, items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Panier vide.' });

  const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const order = {
    id: Date.now().toString(),
    customerName: customerName?.trim() || 'Client',
    tableNumber: tableNumber?.trim() || '-',
    items, total,
    payment: req.body.payment || null,
    status: 'nouvelle',
    createdAt: new Date().toISOString()
  };

  const orders = readJSON(ORDERS_FILE);
  orders.unshift(order);
  writeJSON(ORDERS_FILE, orders);
  io.emit('new-order', order);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Introuvable.' });
  order.status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  io.emit('order-updated', order);
  res.json(order);
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — MENU
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/menu', (req, res) => res.json(readJSON(MENU_FILE)));

// Ajouter un plat (avec photo)
app.post('/api/menu', upload.single('image'), (req, res) => {
  const { name, price, category, subcategory } = req.body;
  if (!name || !price || !category)
    return res.status(400).json({ error: 'Champs manquants.' });

  const item = {
    id: Date.now().toString(),
    category,
    subcategory: subcategory || '',
    name: name.trim().toUpperCase(),
    price: Number(price),
    image: req.file ? '/uploads/' + req.file.filename : ''
  };

  const menu = readJSON(MENU_FILE);
  menu.push(item);
  writeJSON(MENU_FILE, menu);
  io.emit('menu-updated', readJSON(MENU_FILE));
  res.status(201).json(item);
});

// Modifier un plat (avec ou sans nouvelle photo)
app.patch('/api/menu/:id', upload.single('image'), (req, res) => {
  const menu = readJSON(MENU_FILE);
  const item = menu.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable.' });

  if (req.body.name)        item.name        = req.body.name.trim().toUpperCase();
  if (req.body.price)       item.price       = Number(req.body.price);
  if (req.body.category)    item.category    = req.body.category;
  if (req.body.subcategory !== undefined) item.subcategory = req.body.subcategory;
  if (req.file) {
    // Supprimer l'ancienne image si elle existe
    if (item.image) {
      const old = path.join(__dirname, 'public', item.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    item.image = '/uploads/' + req.file.filename;
  }

  writeJSON(MENU_FILE, menu);
  io.emit('menu-updated', readJSON(MENU_FILE));
  res.json(item);
});

// Supprimer un plat
app.delete('/api/menu/:id', (req, res) => {
  let menu = readJSON(MENU_FILE);
  const item = menu.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Introuvable.' });

  if (item.image) {
    const imgPath = path.join(__dirname, 'public', item.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  menu = menu.filter(m => m.id !== req.params.id);
  writeJSON(MENU_FILE, menu);
  io.emit('menu-updated', menu);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — RÉSERVATIONS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/reservations', (req, res) => res.json(readJSON(RESERVATIONS_FILE)));

app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, date } = req.body;
  if (!name || !email || !date)
    return res.status(400).json({ error: 'Champs manquants.' });

  const reservation = {
    id: Date.now().toString(),
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || '-',
    date,
    status: 'en_attente',
    createdAt: new Date().toISOString()
  };

  const reservations = readJSON(RESERVATIONS_FILE);
  reservations.unshift(reservation);
  writeJSON(RESERVATIONS_FILE, reservations);
  io.emit('new-reservation', reservation);

  // Envoi de l'email de confirmation (non bloquant)
  try {
    await sendConfirmationEmail(reservation);
  } catch (err) {
    console.error('Email non envoyé :', err.message);
  }

  res.status(201).json(reservation);
});

app.patch('/api/reservations/:id', (req, res) => {
  const reservations = readJSON(RESERVATIONS_FILE);
  const r = reservations.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Introuvable.' });
  r.status = req.body.status;
  writeJSON(RESERVATIONS_FILE, reservations);
  io.emit('reservation-updated', r);
  res.json(r);
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('Client connecté :', socket.id);
});

// ─── Démarrage ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré  : http://localhost:${PORT}`);
  console.log(`Page admin       : http://localhost:${PORT}/admin.html`);
});
