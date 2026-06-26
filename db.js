const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialiser les tables si elles n'existent pas
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        subcategory TEXT DEFAULT '',
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT DEFAULT 'Client',
        customer_email TEXT DEFAULT '',
        table_number TEXT DEFAULT '-',
        items JSONB NOT NULL,
        total INTEGER NOT NULL,
        payment JSONB,
        status TEXT DEFAULT 'nouvelle',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT DEFAULT '-',
        date TEXT NOT NULL,
        status TEXT DEFAULT 'en_attente',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Base de données initialisée ✓');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
