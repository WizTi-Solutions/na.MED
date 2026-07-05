const db = require('../config/database');

exports.getPatientResults = async (req, res) => {
    // req.user vem do middleware de autenticação (JWT) contendo o ID do paciente logado
    const patientId = req.user.id;

    try {
        const queryText = `
            SELECT id, test_name, file_url, released_at 
            FROM test_results 
            WHERE patient_id = $1 
            ORDER BY released_at DESC
        `;
        const { rows } = await db.query(queryText, [patientId]);

        res.json({ success: true, results: rows });
    } catch (err) {
        console.error('Erro ao buscar exames:', err.message);
        res.status(500).json({ error: 'Erro interno ao buscar resultados.' });
    }
};
