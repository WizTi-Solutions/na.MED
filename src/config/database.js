const { Pool } = require('pg');

// 🎯 ESSA É A CHAVE: Forçar a leitura da variável de ambiente da Vercel
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para Supabase/nuvem
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};