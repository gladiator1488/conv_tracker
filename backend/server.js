const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

// Настройки
app.use(cors({
  origin: 'https://bridgex.ru/', // Можно указать конкретный домен, например: 'https://your-tilda-site.tilda.ws'
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

// Подключение к PostgreSQL
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'conversions',
  password: 'test',
  port: 5432,
});

// Создание таблицы (выполнить один раз)
// async function createTable() {
//   try {
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS events (
//         id SERIAL PRIMARY KEY,
//         session_id VARCHAR(36) NOT NULL,
//         website_id VARCHAR(50) NOT NULL,
//         event_type VARCHAR(50) NOT NULL,
//         timestamp TIMESTAMPTZ DEFAULT NOW(),
//         data JSONB
//       );
//     `);
//     console.log('Table created');
//   } catch (err) {
//     console.error('Error creating table:', err);
//   }
// }
// createTable();

// Root endpoint - подтверждение работы сервера
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Conversion Tracker API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        h1 {
          color: #2c3e50;
        }
        .status {
          color: #27ae60;
          font-weight: bold;
        }
        code {
          background: #f4f4f4;
          padding: 2px 5px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <h1>Conversion Tracker API</h1>
      <p class="status">Server is running successfully!</p>
      <p>This service collects and stores conversion events in PostgreSQL database.</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li><code>POST /api/collect</code> - Submit conversion events (accepts JSON)</li>
        <li><code>GET /</code> - This status page</li>
      </ul>
      <p>Database connection: <strong>${pool.options.database}</strong> on <strong>${pool.options.host}:${pool.options.port}</strong></p>
      <p>Server time: ${new Date().toUTCString()}</p>
    </body>
    </html>
  `);
});

// Эндпоинт для приема данных
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
          event.session_id,
          event.website_id,
          event.event_type,
          new Date(event.timestamp || Date.now()),
          event.data || {}
        ]
      );
    }
    await client.query('COMMIT');
    client.release();

    res.status(200).json({ success: true, count: events.length });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    console.error('Error saving events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the status page at: http://localhost:${PORT}`);
});