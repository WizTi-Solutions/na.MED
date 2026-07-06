const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken'); 
const verificarToken = require('../middlewares/authMiddleware');
const verificarPermissao = require('../middlewares/roleMiddleware');

// 📑 1. HISTÓRICO DO PACIENTE (Apenas uma rota, protegida)
router.get('/my-appointments', verificarToken, async (req, res) => {
    try {
        const patient_id = req.user.id; 
        const query = `
            SELECT id, doctor_name, specialty, appointment_date, status 
            FROM appointments 
            WHERE patient_id = $1 
            ORDER BY appointment_date DESC
        `;
        const { rows } = await db.query(query, [patient_id]);
        res.json({ success: true, appointments: rows });
    } catch (err) {
        console.error('Erro no histórico:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔬 2. LAUDOS E DOCUMENTOS DO PACIENTE
router.get('/my-documents', verificarToken, async (req, res) => {
    try {
        const patientId = req.user.id; 
        
        // Convertemos explicitamente para o tipo correto caso haja divergência entre UUID/INT/VARCHAR
        const query = `
            SELECT d.id, d.file_name, d.file_path, d.uploaded_at, a.specialty
            FROM patient_documents d
            LEFT JOIN appointments a ON d.appointment_id = a.id
            WHERE CAST(d.patient_id AS TEXT) = CAST($1 AS TEXT)
            ORDER BY d.uploaded_at DESC
        `;
        const { rows } = await db.query(query, [patientId]);
        res.json({ success: true, documents: rows });
    } catch (err) {
        console.error('Erro nos documentos:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ➕ CRIAR NOVO AGENDAMENTO (Corrigido)
router.post('/', verificarToken, async (req, res) => {
    try {
        const { patient_id, doctor_name, specialty, appointment_date } = req.body;

        // 🛡️ Validações
        if (!patient_id || !doctor_name || !specialty || !appointment_date) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
        }

        // 🛡️ Segurança: Admin não pode ser o paciente
        if (patient_id === req.user.id && req.user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'O admin não pode ser o paciente!' });
        }

        // 🛡️ Trava de duplicidade
        const checkQuery = `
            SELECT id FROM appointments 
            WHERE doctor_name = $1 AND appointment_date = $2 AND status != 'Cancelado'
        `;
        const checkRes = await db.query(checkQuery, [doctor_name, appointment_date]);

        if (checkRes.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Este horário já está ocupado.' });
        }

        // 🚀 Inserção Correta (Agora usando a variável patient_id)
        const insertQuery = `
            INSERT INTO appointments (patient_id, doctor_name, specialty, appointment_date, status)
            VALUES ($1, $2, $3, $4, 'Agendado')
            RETURNING *
        `;
        
        // Aqui o patient_id está correto agora!
        const { rows } = await db.query(insertQuery, [patient_id, doctor_name, specialty, appointment_date]);
        
        res.json({ success: true, appointment: rows[0] });

    } catch (err) {
        console.error('Erro ao criar agendamento:', err.message);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar no banco.' });
    }
});

// 📅 4. LISTA COMPLETA DA CLÍNICA (Com filtro por data do calendário)
router.get('/all-appointments', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ success: false, message: 'Não autorizado.' });

        
const secretKey = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
        
        jwt.verify(token, secretKey, async (err, decodedUser) => {
            if (err) return res.status(403).json({ success: false, message: 'Token expirado.' });

            const { data } = req.query; 
            
            let query = `
                SELECT 
                    a.id,
                    a.patient_id, 
                    a.doctor_name, 
                    a.specialty, 
                    a.appointment_date, 
                    a.status,
                    u.name as patient_name
                FROM appointments a
                JOIN users u ON a.patient_id = u.id
            `;
            
            const queryParams = [];

            if (data) {
                query += ` WHERE DATE(a.appointment_date) = $1`;
                queryParams.push(data);
            }

            query += ` ORDER BY a.appointment_date ASC`;
            
            const { rows } = await db.query(query, queryParams);
            res.json({ success: true, appointments: rows });
        });

    } catch (error) {
        console.error('Erro na rota da clínica:', error);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});

// 🗑️ 5. EXCLUIR / CANCELAR AGENDAMENTO
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'Não autorizado.' });

        const query = 'DELETE FROM appointments WHERE id = $1 RETURNING *';
        const { rows } = await db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
        }

        res.json({ success: true, message: 'Agendamento cancelado com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

const upload = require('../middlewares/uploadMiddleware');

// 📤 ROTA PARA A CLÍNICA FAZER UPLOAD DE LAUDOS (PDF)
// O campo do arquivo no formulário deve se chamar 'laudo'
router.post('/upload-document', upload.single('laudo'), async (req, res) => {
    try {
        const { patient_id, appointment_id, file_name } = req.body;

        // Valida se o arquivo realmente foi enviado
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF foi enviado.' });
        }

        if (!patient_id) {
            return res.status(400).json({ success: false, message: 'ID do paciente é obrigatório.' });
        }

        // Caminho relativo que será salvo no banco e acessado pelo front
        // Ex: /uploads/laudo-171987456123.pdf
        // O arquivo físico vai para public/uploads, mas a URL pública corta o "public"
const filePath = `/uploads/${req.file.filename}`;
        const finalFileName = file_name || req.file.originalname;

        const query = `
            INSERT INTO patient_documents (patient_id, appointment_id, file_name, file_path, uploaded_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;

        // Passamos o appointment_id (pode ser null se for um documento avulso)
        const { rows } = await db.query(query, [patient_id, appointment_id || null, finalFileName, filePath]);

        res.json({ 
            success: true, 
            message: 'Laudo anexado com sucesso!', 
            document: rows[0] 
        });

    } catch (err) {
        console.error('Erro no upload de documento:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 📂 BUSCAR ARQUIVOS JÁ ENVIADOS DO PACIENTE (TABELA CORRIGIDA PARA O POSTGRES)
router.get('/patient-documents/:patientId', verificarToken, async (req, res) => {
    try {
        const { patientId } = req.params;

        // 🎯 MÁGICA AQUI: Mudamos para buscar da tabela 'patient_documents' que guarda os PDFs reais!
        const query = `
            SELECT id, file_name, file_path, uploaded_at 
            FROM patient_documents
            WHERE CAST(patient_id AS TEXT) = CAST($1 AS TEXT)
            ORDER BY uploaded_at DESC
        `;
        
        const { rows } = await db.query(query, [patientId]);
        
        return res.json({ success: true, documents: rows });
    } catch (error) {
        console.error('💥 Erro ao buscar documentos do paciente:', error.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao buscar históricos.' });
    }
});

// Rota de listagem da clínica (Modificada para restringir médicos e técnicos)
router.get('/all-appointments', verificarToken, verificarPermissao(['recepcao', 'medico', 'tecnico']), async (req, res) => {
    const { role, name: userName } = req.user;
    const { data, medico } = req.query;

    let query = `SELECT a.*, u.name as patient_name FROM appointments a JOIN users u ON a.patient_id = u.id`;
    const params = [];

    // 🎯 Se for Médico ou Técnico sem parâmetros, eles enxergam estritamente as suas próprias agendas!
    if (role === 'medico') {
        query += ` WHERE a.doctor_name = $1`;
        params.push(userName);
    } else if (role === 'tecnico') {
        // Se o técnico informou um médico filtrado e passou pelo middleware, filtramos por ele
        if (medico) {
            query += ` WHERE a.doctor_name = $1`;
            params.push(medico);
        } else {
            // Senão, ele só vê os procedimentos dele mesmo (onde ele é o técnico responsável)
            query += ` WHERE a.doctor_name = $1`;
            params.push(userName);
        }
    }

    // Adiciona o filtro de data depois se ele existir...
    // Executa a query e retorna
});
module.exports = router;
