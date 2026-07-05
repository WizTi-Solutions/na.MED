const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

// 1. Cadastrar Especialidade
router.post('/specialties', async (req, res) => {
    const { name, duration_minutes } = req.body;
    try {
        const query = 'INSERT INTO specialties (name, duration_minutes) VALUES ($1, $2) RETURNING *';
        const { rows } = await db.query(query, [name, duration_minutes]);
        res.status(201).json({ success: true, specialty: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Especialidade já cadastrada ou erro interno.' });
    }
});

// 2. Listar Especialidades
router.get('/specialties', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM specialties ORDER BY name ASC');
        res.json({ success: true, specialties: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Cadastrar Tipo de Exame
router.post('/exam-types', async (req, res) => {
    const { name, duration_minutes, responsible_role } = req.body;
    try {
        const query = 'INSERT INTO exam_types (name, duration_minutes, responsible_role) VALUES ($1, $2, $3) RETURNING *';
        const { rows } = await db.query(query, [name, duration_minutes, responsible_role]);
        res.status(201).json({ success: true, examType: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Exame já cadastrado ou erro interno.' });
    }
});

// 4. Listar Tipos de Exames
router.get('/exam-types', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM exam_types ORDER BY name ASC');
        res.json({ success: true, examTypes: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Cadastrar Profissional com Especialidades ou Exames
router.post('/professionals', async (req, res) => {
    const { name, role, specialties, exams } = req.body; // specialties e exams devem ser arrays de IDs
    try {
        await db.query('BEGIN');

        // Insere o profissional
        const profQuery = 'INSERT INTO professionals (name, role) VALUES ($1, $2) RETURNING *';
        const profResult = await db.query(profQuery, [name, role]);
        const professionalId = profResult.rows[0].id;

        // Se for médico e tiver especialidades selecionadas
        if (role === 'medico' && specialties && specialties.length > 0) {
            for (let specId of specialties) {
                await db.query('INSERT INTO professional_specialties (professional_id, specialty_id) VALUES ($1, $2)', [professionalId, specId]);
            }
        }

        // Se tiver exames selecionados (para técnicos/biomédicos)
        if (role !== 'medico' && exams && exams.length > 0) {
            for (let examId of exams) {
                await db.query('INSERT INTO professional_exams (professional_id, exam_type_id) VALUES ($1, $2)', [professionalId, examId]);
            }
        }

        await db.query('COMMIT');
        res.status(201).json({ success: true, professional: profResult.rows[0] });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao cadastrar profissional.' });
    }
});

// 6. Listar Profissionais com seus respectivos vínculos
router.get('/professionals', async (req, res) => {
    try {
        const query = `
            SELECT p.*,
                COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '[]') as specialties,
                COALESCE(json_agg(DISTINCT et.name) FILTER (WHERE et.name IS NOT NULL), '[]') as exams
            FROM professionals p
            LEFT JOIN professional_specialties ps ON p.id = ps.professional_id
            LEFT JOIN specialties s ON ps.specialty_id = s.id
            LEFT JOIN professional_exams pe ON p.id = pe.professional_id
            LEFT JOIN exam_types et ON pe.exam_type_id = et.id
            GROUP BY p.id
            ORDER BY p.name ASC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, professionals: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. Excluir Profissional
router.delete('/professionals/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // O ON DELETE CASCADE que colocamos no banco já vai apagar os vínculos automaticamente!
        const result = await db.query('DELETE FROM professionals WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Profissional não encontrado.' });
        }
        res.json({ success: true, message: 'Profissional excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Excluir Especialidade
router.delete('/specialties/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM specialties WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Especialidade não encontrada.' });
        }
        res.json({ success: true, message: 'Especialidade excluída com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. Excluir Tipo de Exame
router.delete('/exam-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM exam_types WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de exame não encontrado.' });
        }
        res.json({ success: true, message: 'Tipo de exame excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. Atualizar Especialidade
router.put('/specialties/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, duration_minutes } = req.body;
        const query = 'UPDATE specialties SET name = $1, duration_minutes = $2 WHERE id = $3 RETURNING *';
        const result = await db.query(query, [name, duration_minutes, id]);
        res.json({ success: true, message: 'Especialidade atualizada com sucesso!', specialty: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 11. Atualizar Tipo de Exame
router.put('/exam-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, duration_minutes, responsible_role } = req.body;
        const query = 'UPDATE exam_types SET name = $1, duration_minutes = $2, responsible_role = $3 WHERE id = $4 RETURNING *';
        const result = await db.query(query, [name, duration_minutes, responsible_role, id]);
        res.json({ success: true, message: 'Exame atualizado com sucesso!', examType: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 12. Atualizar Profissional (Limpa os vínculos antigos e cria os novos)
router.put('/professionals/:id', async (req, res) => {
    const { id } = req.params;
    const { name, role, specialties, exams } = req.body;
    try {
        await db.query('BEGIN');

        // Atualiza os dados básicos do profissional
        await db.query('UPDATE professionals SET name = $1, role = $2 WHERE id = $3', [name, role, id]);

        // Limpa todos os vínculos antigos nas tabelas pivô
        await db.query('DELETE FROM professional_specialties WHERE professional_id = $1', [id]);
        await db.query('DELETE FROM professional_exams WHERE professional_id = $1', [id]);

        // Insere os novos vínculos conforme a função atual
        if (role === 'medico' && specialties && specialties.length > 0) {
            for (let specId of specialties) {
                await db.query('INSERT INTO professional_specialties (professional_id, specialty_id) VALUES ($1, $2)', [id, specId]);
            }
        }
        if (role !== 'medico' && exams && exams.length > 0) {
            for (let examId of exams) {
                await db.query('INSERT INTO professional_exams (professional_id, exam_type_id) VALUES ($1, $2)', [id, examId]);
            }
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Profissional atualizado com sucesso!' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
