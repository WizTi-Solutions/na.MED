const { Pool } = require('pg');
require('dotenv').config();

// Configuração do Pool de conexões usando variáveis de ambiente
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'named_db',
    password: process.env.DB_PASSWORD || 'suasenha',
    port: process.env.DB_PORT || 5432,
    max: 10, // Máximo de conexões simultâneas no pool
    idleTimeoutMillis: 30000 // Tempo para fechar conexões inativas
});

// Testar a conexão assim que o app iniciar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erro ao conectar no PostgreSQL:', err.message);
    } else {
        console.log('✅ Banco de Dados PostgreSQL conectado com sucesso!');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};