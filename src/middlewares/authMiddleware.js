const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token não fornecido.' });
    }

    try {
        // 🎯 IGUALDADE ABSOLUTA: Mesma chave e fallback do login!
        const segredo = process.env.JWT_SECRET || 'seu_segredo_super_secreto'; 
        
        const decoded = jwt.verify(token, segredo);
        req.user = decoded; 
        next();
    } catch (err) {
        console.log("❌ Erro na validação do JWT:", err.message);
        return res.status(403).json({ success: false, error: 'Token inválido ou expirado.' });
    }
}

module.exports = verificarToken;
