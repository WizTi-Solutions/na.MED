const db = require('../config/database');

const verificarPermissao = (rolesPermitidas) => {
    return async (req, res, next) => {
        const { role, id: userId, name: userName } = req.user;

        // 1. Admin sempre tem passe livre para tudo
        if (role === 'admin') return next();

        // 2. Verifica se o perfil básico está na lista de permissões da rota
        if (rolesPermitidas.includes(role)) {
            return next();
        }

        // 3. Se for um Técnico tentando ver filtros ou dados de outro Médico na Dashboard
        if (role === 'tecnico' && req.query.medico) {
            try {
                const medicoAlvo = req.query.medico;
                
                // Verifica no banco se existe uma regra liberando este técnico para este médico
                const query = `SELECT id FROM custom_permissions WHERE user_id = $1 AND allowed_doctor_name = $2`;
                const { rows } = await db.query(query, [userId, medicoAlvo]);

                if (rows.length > 0) {
                    return next(); // Permissão personalizada válida encontrada!
                }
            } catch (err) {
                console.error('Erro ao checar permissão customizada:', err.message);
            }
        }

        return res.status(403).json({ success: false, message: 'Acesso negado para o seu perfil operacional.' });
    };
};

module.exports = verificarPermissao;