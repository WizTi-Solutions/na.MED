//require('dotenv').config();
const cors = require('cors');
const express = require('express');
const path = require('path');
const db = require('../src/config/database');

const app = express(); // 🎯 Agora o app é inicializado antes de qualquer uso!
app.use(cors());
const PORT = process.env.PORT || 3000;

const authRoutes = require('../src/routes/authRoutes');
const examRoutes = require('../src/routes/examRoutes');
const appointmentRoutes = require('../src/routes/appointmentRoutes');
const catalogRoutes = require('../src/routes/catalogRoutes'); // Ajuste este também
const configRoutes = require('../src/routes/configRoutes');   // Ajuste este também

// 1. MIDDLEWARES BÁSICOS (Sempre primeiro!)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. DESATIVAR TRAVAS DE SEGURANÇA LOCALMENTE (Precisa rodar antes dos arquivos estáticos!)
app.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Security-Policy');
    res.removeHeader('X-WebKit-CSP');
    next();
});

// 3. ARQUIVOS ESTÁTICOS (Apontando corretamente para a raiz)
app.use(express.static(path.join(__dirname, '../public')));

// 4. ROTAS DA API (Usando os caminhos corrigidos com ../)
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/catalog', require('../src/routes/catalogRoutes'));
app.use('/api/config', require('../src/routes/configRoutes'));

// Rota base de teste
app.get('/api/health', (req, res) => {
    res.json({ status: 'server running', project: 'NAMED' });
});

// 5. INICIALIZAÇÃO DO SERVIDOR
//app.listen(PORT, () => {
    console.log(`🚀 Servidor voando na porta ${PORT}`);
    
    // TRUQUE PARA MANTER O PROCESSO ATIVO NO WINDOWS (Evita o clean exit do dotenvx)
    setInterval(() => {
        // Um timer vazio de 1 hora apenas para manter o Event Loop ocupado
    }, 1000 * 60 * 60);
//});

module.exports = app;
