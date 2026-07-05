const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verificarToken = require('../middlewares/authMiddleware');

// 🛡️ Middleware interno para garantir que só Admin mexe nas configurações
const eAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado. Requer nível Administrador.' });
    }
    next();
};

// ➕ SALVAR OU ATUALIZAR GRADE HORÁRIA
router.post('/slots', verificarToken, eAdmin, async (req, res) => {
    try {
        const { specialty, doctor_name, day_of_week, start_time, end_time, interval_minutes } = req.body;

        const query = `
            INSERT INTO clinic_slots_config (specialty, doctor_name, day_of_week, start_time, end_time, interval_minutes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [specialty, doctor_name || null, day_of_week, start_time, end_time, interval_minutes]);
        res.json({ success: true, message: 'Regra de horário salva!', config: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🛑 BLOQUEAR DATA/AGENDA
router.post('/block', verificarToken, eAdmin, async (req, res) => {
    try {
        const { block_date, start_time, end_time, specialty, reason } = req.body;

        const query = `
            INSERT INTO clinic_blocks (block_date, start_time, end_time, specialty, reason)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [block_date, start_time || null, end_time || null, specialty || null, reason]);
        res.json({ success: true, message: 'Agenda bloqueada com sucesso para o período!', block: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔍 ATUALIZAR EM src/routes/configRoutes.js: LISTAR CONFIGURAÇÕES ATIVAS E PERMISSÕES
router.get('/active-rules', verificarToken, async (req, res) => {
    try {
        const slots = await db.query('SELECT * FROM clinic_slots_config');
        const blocks = await db.query('SELECT * FROM clinic_blocks WHERE block_date >= CURRENT_DATE');
        
        // 🎯 Query inteligente trazendo o Nome e Cargo do funcionário vinculado!
        const permissionsQuery = `
            SELECT cp.id, cp.allowed_doctor_name, u.name as user_name, u.role as user_role 
            FROM custom_permissions cp
            JOIN users u ON cp.user_id = u.id
        `;
        const permissions = await db.query(permissionsQuery);
        
        res.json({ 
            success: true, 
            slots: slots.rows, 
            blocks: blocks.rows, 
            custom_permissions: permissions.rows 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🗑️ ADICIONAR EM src/routes/configRoutes.js: DELETAR PERMISSÃO CUSTOMIZADA
router.delete('/delegate-permission/:id', verificarToken, eAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM custom_permissions WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Privilégio de acesso revogado com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🗑️ DELETAR UMA REGRA DE HORÁRIO/SLOT
router.delete('/slots/:id', verificarToken, eAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM clinic_slots_config WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Grade operacional removida.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🗑️ DELETAR/LIBERAR UM BLOQUEIO DE DATA
router.delete('/block/:id', verificarToken, eAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM clinic_blocks WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Data liberada para agendamentos!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Vincular permissão personalizada para um funcionário
router.post('/delegate-permission', verificarToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Acesso restrito.' });

    const { user_id, allowed_doctor_name } = req.body;

    try {
        const query = `
            INSERT INTO custom_permissions (user_id, allowed_doctor_name) 
            VALUES ($1, $2) 
            RETURNING *
        `;
        const { rows } = await db.query(query, [user_id, allowed_doctor_name]);
        res.json({ success: true, message: 'Permissão customizada atribuída com sucesso!', data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔍 ROTA PARA LISTAR OS USUÁRIOS DO SISTEMA (Para popular o painel de acessos)
router.get('/system-users', verificarToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso restrito.' });
    }
    try {
        const query = `
            SELECT id, name, role, email as cpf 
            FROM users 
            WHERE LOWER(role) IN ('admin', 'recepcao', 'medico', 'tecnico')
            ORDER BY name ASC
        `;
        const { rows } = await db.query(query);
        
        // 🎯 O RASTREADOR AQUI: Vai te mostrar no terminal se o banco achou alguém!
        console.log("👥 USUÁRIOS ENCONTRADOS NO BANCO:", rows);
        
        return res.json({ success: true, users: rows });
    } catch (err) {
        console.error('💥 Erro ao listar usuários do sistema:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});
module.exports = router;