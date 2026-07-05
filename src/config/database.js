const { Pool } = require('pg');

// Log de depuração (Remova após resolver!)
console.log('--- Depuração do Banco ---');
console.log('URL detectada:', process.env.DATABASE_URL ? 'Sim, encontrada' : 'NÃO ENCONTRADA');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
