const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Agora ele lê a string completa que achamos
  ssl: {
    rejectUnauthorized: false // Obrigatório para o Supabase
  }
});

pool.on('connect', () => {
  console.log('✅ Conectado ao banco de dados Supabase com sucesso!');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};