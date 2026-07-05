const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // O Vercel usará a string do Supabase aqui
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};