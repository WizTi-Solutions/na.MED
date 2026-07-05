const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const jwt = require('jsonwebtoken');

// Middleware rápido para validar o token JWT localmente antes de entregar os exames
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

    jwt.verify(token, process.env.JWT_SECRET || 'secret_named_token', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
}

// Rota protegida que o front-end vai chamar
router.get('/meus-resultados', authenticateToken, examController.getPatientResults);

module.exports = router;