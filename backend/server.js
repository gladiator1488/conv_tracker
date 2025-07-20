require('dotenv').config(); // подключение .env

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

// Подключение к PostgreSQL через переменные из .env
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

// Root endpoint — проверка сервера
app.get('/', (req, res) => {
  res.send(`
    <h1>Conversion Tracker API</h1>
    <p>✅ Сервер работает</p>
    <p>БД: <strong>${pool.options.database}</strong> на <strong>${pool.options.host}:${pool.options.port}</strong></p>
    <p>Время сервера: ${new Date().toUTCString()}</p>
  `);
});

// Эндпоинт приёма событий
app.post('/api/collect', async (req, res) => {
  console.log('Received data:', req.body);
  let client;
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    client = await pool.connect();

    await client.query('BEGIN');
    for (const event of events) {
      await client.query(
        `INSERT INTO events (session_id, website_id, event_type, timestamp, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          event.session_id || event.client_id,
          process.env.WEBSITE_ID || 'default_site',
          event.event_type,
          new Date(event.timestamp || Date.now()),
          event.data || {}
        ]
      );
    }
    await client.query('COMMIT');
    res.status(200).json({ success: true, count: events.length });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error saving events:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) client.release();
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});
