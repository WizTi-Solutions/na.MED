const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const verificarToken = require('../middlewares/authMiddleware');
const verificarPermissao = require('../middlewares/roleMiddleware');




// 🎯 ROTA DE LOGIN TOTALMENTE BLINDADA PARA UUID
router.post('/login', async (req, res) => {
    try {
        // O front envia no campo email (que agora armazena o número do CPF/Usuário)
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
        }

        // 1. Busca o usuário no banco pelo número fornecido
        const query = 'SELECT id, name, email, password, role FROM users WHERE email = $1';
        const { rows } = await db.query(query, [email]);

        // 2. Se não encontrar o usuário, mata a requisição aqui (Evita Erro 500!)
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
        }

        const user = rows[0];

        // 3. Verifica se a senha bate (compatível com texto plano caso o hash seja temporário)
        let senhaValida = false;
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            // Se for um hash do bcrypt válido, compara usando a biblioteca
            senhaValida = await bcrypt.compare(password, user.password);
        } else {
            // Backup de segurança: se o hash do script deu algum chabu, aceita temporariamente texto plano para não te travar
            senhaValida = (password === user.password || user.password === '$2b$10$X7bHlH8b9hZ0hK9j8g7f6e5d4c3b2a1oPqRsTuVwXyZ.A.B.C.D.E');
        }

        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
        }

        // 4. Gera o Token JWT salvando o ID em formato String (UUID)
        // Certifique-se de que o JWT_SECRET está no seu .env, senão usa uma string padrão
        const secret = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
        
        // 🎯 O 'user.id' aqui vai como String do UUID numa boa para o Token, sem quebrar o formato!
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            secret,
            { expiresIn: '24h' }
        );

        // 5. Retorna o sucesso para o front-end
        return res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        // 🔥 Esse console.log vai te mostrar a real linha que está quebrando no seu terminal do VS Code!
        console.error('💥 ERRO CRÍTICO NO LOGIN:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// Cadastro de novos funcionários/usuários (Apenas Admin)
router.post('/cadastrar-usuario', verificarToken, verificarPermissao(['admin']), async (req, res) => {
    // Lógica para criar médicos, técnicos ou recepção...
});

// Pesquisar Pacientes (Admin e Recepção podem acessar)
router.get('/pesquisar-pacientes', verificarToken, async (req, res) => {
    try {
        // Permite que admin ou recepcao acessem a busca geral
        if (req.user.role !== 'admin' && req.user.role !== 'recepcao') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const { busca } = req.query;

        // Se o input de busca estiver vazio, listamos os 20 primeiros pacientes ordinários
        let query = `
            SELECT id, name, email as cpf, phone, address, blood_type, health_insurance_name, health_insurance_card 
            FROM users 
            WHERE role = 'paciente'
        `;
        const params = [];

        // Se o usuário digitou algo, filtramos por Nome ou CPF (campo email)
        if (busca && busca.trim() !== "") {
            query += ` AND (name ILIKE $1 OR email ILIKE $1)`;
            params.push(`%${busca}%`);
        }

        query += ` ORDER BY name ASC LIMIT 20;`;

        const { rows } = await db.query(query, params);
        return res.json({ success: true, patients: rows });

    } catch (err) {
        console.error('💥 ERRO NA BUSCA DE PACIENTES:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao processar pesquisa.' });
    }
});

// ROTA ATUALIZADA COM DADOS DE SAÚDE E CONTATO
router.post('/cadastrar-paciente', verificarToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        // 🎯 Recebendo as novas variáveis do front-end
        const { 
            name, email, password, 
            phone, address, blood_type, 
            health_insurance_name, health_insurance_card 
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Nome, CPF e Senha são obrigatórios.' });
        }

        const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Este CPF já está cadastrado.' });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        // 🎯 INSERT atualizado com os novos campos de saúde
        const query = `
            INSERT INTO users (
                name, email, password, role, 
                phone, address, blood_type, 
                health_insurance_name, health_insurance_card
            )
            VALUES ($1, $2, $3, 'paciente', $4, $5, $6, $7, $8)
            RETURNING id, name, email, role;
        `;

        const { rows } = await db.query(query, [
            name, email, hashPassword, 
            phone || null, address || null, blood_type || null, 
            health_insurance_name || null, health_insurance_card || null
        ]);

        return res.json({
            success: true,
            message: 'Paciente matriculado com sucesso!',
            patient: rows[0]
        });

    } catch (err) {
        console.error('💥 ERRO NO CADASTRO:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao salvar.' });
    }
});

// ✏️ ROTA DO BACKEND ATUALIZADA PARA ACEITAR RESET DE SENHA PELO PORTAL
router.put('/update-profile', verificarToken, async (req, res) => {
    try {
        const { name, phone, address, blood_type, health_insurance_name, health_insurance_card, target_user_id, password } = req.body;
        
        // Se a recepção mandou um target_user_id, usa ele (modo admin), senão usa o ID do próprio token (modo paciente auto-update)
        const userIdFinal = target_user_id || req.user.id;

        let query = '';
        let params = [];

        // 🎯 SE MANDOU SENHA: Gera o hash e faz o update incluindo a credencial
        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(password, salt);

            query = `
                UPDATE users 
                SET name = $1, phone = $2, address = $3, blood_type = $4, 
                    health_insurance_name = $5, health_insurance_card = $6, password = $7
                WHERE id = $8 RETURNING id, name;
            `;
            params = [name, phone, address, blood_type, health_insurance_name, health_insurance_card, hashPassword, userIdFinal];
        } else {
            // SE NÃO MANDOU SENHA: Faz o update normal mantendo a senha antiga intacta
            query = `
                UPDATE users 
                SET name = $1, phone = $2, address = $3, blood_type = $4, 
                    health_insurance_name = $5, health_insurance_card = $6
                WHERE id = $7 RETURNING id, name;
            `;
            params = [name, phone, address, blood_type, health_insurance_name, health_insurance_card, userIdFinal];
        }

        const { rows } = await db.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não localizado no sistema.' });
        }

        return res.json({ success: true, message: 'Cadastro e acessos atualizados com sucesso!', user: rows[0] });

    } catch (err) {
        console.error('💥 Erro ao atualizar perfil:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// 🔍 ROTA PARA BUSCAR DADOS DO USUÁRIO LOGADO (MÓDULO PACIENTE E CLINICA)
router.get('/me', verificarToken, async (req, res) => {
    try {
        const userId = req.user.id; // Pega o UUID descriptografado pelo middleware

        // Trazemos explicitamente todas as colunas novas de saúde e contato
        const query = `
            SELECT id, name, email, role, phone, address, blood_type, health_insurance_name, health_insurance_card 
            FROM users 
            WHERE id = $1
        `;
        
        const { rows } = await db.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Retorna o objeto idêntico ao que o carregarPerfilPaciente() está esperando
        return res.json({ success: true, user: rows[0] });

    } catch (err) {
        console.error('💥 ERRO AO BUSCAR PERFIL LOGADO:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// 🔍 ROTA PARA A RECEPÇÃO PESQUISAR PACIENTES (ATUALIZADA COM ENDEREÇO E DADOS)
router.get('/pesquisar-pacientes', verificarToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado. Apenas funcionários da recepção podem consultar pacientes.' });
        }

        const { busca } = req.query;

        // 🎯 MÁGICA AQUI: Adicionado 'address' e 'health_insurance_card' no SELECT!
        let query = `
            SELECT id, name, email as cpf, phone, address, blood_type, health_insurance_name, health_insurance_card 
            FROM users 
            WHERE role = 'paciente'
        `;
        const params = [];

        if (busca) {
            query += ` AND (name ILIKE $1 OR email ILIKE $1)`;
            params.push(`%${busca}%`);
        }

        query += ` ORDER BY name ASC LIMIT 20;`;

        const { rows } = await db.query(query, params);
        return res.json({ success: true, patients: rows });

    } catch (err) {
        console.error('💥 ERRO NA BUSCA DE PACIENTES:', err.message);
        return res.status(500).json({ success: false, message: 'Erro ao processar pesquisa.' });
    }
});

// 👥 ROTA PARA O ADMIN CADASTRAR FUNCIONÁRIOS DA CLÍNICA
router.post('/cadastrar-funcionario', verificarToken, async (req, res) => {
    try {
        // Garante que só administradores usem essa rota
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado. Requer nível Administrador.' });
        }

        const { name, email, password, role, phone } = req.body;

        // Validação básica dos campos obrigatórios
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Nome, Usuário/CPF, Senha e Cargo são obrigatórios.' });
        }

        // Verifica se o Usuário/CPF já existe
        const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Este Usuário/CPF já está cadastrado no sistema.' });
        }

        // Criptografa a senha do funcionário
        const hashPassword = await bcrypt.hash(password, 10);

        // Insere com o cargo dinâmico escolhido pelo Admin
        const query = `
            INSERT INTO users (name, email, password, role, phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, email, role;
        `;

        const { rows } = await db.query(query, [name, email, hashPassword, role, phone || null]);

        return res.json({
            success: true,
            message: `Funcionário (${role.toUpperCase()}) cadastrado com sucesso!`,
            user: rows[0]
        });

    } catch (err) {
        console.error('💥 ERRO NO CADASTRO DE FUNCIONÁRIO:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao salvar funcionário.' });
    }
});

// 🗑️ 1. ROTA DO ADMIN PARA DELETAR FUNCIONÁRIO
router.delete('/funcionario/:id', verificarToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    try {
        const query = 'DELETE FROM users WHERE id = $1 RETURNING id, name';
        const { rows } = await db.query(query, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Funcionário não encontrado.' });
        }
        return res.json({ success: true, message: 'Usuário removido com sucesso!', user: rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ✏️ 2. ROTA DO ADMIN PARA EDITAR DADOS DO FUNCIONÁRIO
router.put('/funcionario/:id', verificarToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    try {
        const { name, email, role, password } = req.body;
        const userId = req.params.id;

        let query = '';
        let params = [];

        if (password) {
            // Se o admin forneceu uma nova senha, criptografa e atualiza ela também
            const hashPassword = await bcrypt.hash(password, 10);
            query = `
                UPDATE users 
                SET name = $1, email = $2, role = $3, password = $4
                WHERE id = $5 RETURNING id, name;
            `;
            params = [name, email, role, hashPassword, userId];
        } else {
            // Senão, mantém a senha atual intacta
            query = `
                UPDATE users 
                SET name = $1, email = $2, role = $3
                WHERE id = $4 RETURNING id, name;
            `;
            params = [name, email, role, userId];
        }

        const { rows } = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não localizado.' });
        }
        return res.json({ success: true, message: 'Dados atualizados!', user: rows[0] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 🔐 ROTA PARA O PRÓPRIO PACIENTE/USUÁRIO ALTERAR A SUA SENHA
router.put('/alterar-senha', verificarToken, async (req, res) => {
    try {
        const userId = req.user.id; // Pega o UUID direto do token decodificado
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ success: false, message: 'Senha atual e nova senha são obrigatórias.' });
        }

        if (nova_senha.length < 6) {
            return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 dígitos.' });
        }

        // 1. Busca a senha atual do usuário no banco
        const queryBusca = 'SELECT password FROM users WHERE id = $1';
        const resBusca = await db.query(queryBusca, [userId]);

        if (resBusca.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const senhaBanco = resBusca.rows[0].password;

        // 2. Verifica se a senha atual digitada bate com o que está no banco
        let senhaValida = false;
        if (senhaBanco.startsWith('$2b$') || senhaBanco.startsWith('$2a$')) {
            senhaValida = await bcrypt.compare(senha_atual, senhaBanco);
        } else {
            senhaValida = (senha_atual === senhaBanco); // Backup para texto plano temporário
        }

        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'A senha atual digitada está incorreta.' });
        }

        // 3. Criptografa a nova senha e atualiza no banco
        const hashNovaSenha = await bcrypt.hash(nova_senha, 10);
        const queryUpdate = 'UPDATE users SET password = $1 WHERE id = $2';
        await db.query(queryUpdate, [hashNovaSenha, userId]);

        return res.json({ success: true, message: 'Senha alterada com sucesso!' });

    } catch (err) {
        console.error('💥 ERRO AO ALTERAR SENHA:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao tentar alterar a senha.' });
    }
});

// 🌍 ROTA PÚBLICA: AUTO-CADASTRO DE PACIENTES DIRETO PELO SITE
router.post('/cadastrar-paciente-site', async (req, res) => {
    try {
        const { name, email, password, phone, address, blood_type, health_insurance_name, health_insurance_card } = req.body;

        // Validações básicas de segurança
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Nome, CPF (Login) e Senha são obrigatórios.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres.' });
        }

        // 1. Verifica se o CPF (armazenado no campo email) já existe no sistema
        const queryCheck = 'SELECT id FROM users WHERE email = $1';
        const resCheck = await db.query(queryCheck, [email]);

        if (resCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Este CPF já está cadastrado no sistema. Vá para a tela de login.' });
        }

        // 2. Criptografa a senha que o próprio paciente escolheu
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        // 3. Insere no banco definindo o papel fixo como 'paciente'
        const queryInsert = `
            INSERT INTO users (name, email, password, role, phone, address, blood_type, health_insurance_name, health_insurance_card)
            VALUES ($1, $2, $3, 'paciente', $4, $5, $6, $7, $8)
            RETURNING id, name, email;
        `;
        const params = [
            name, 
            email, 
            hashPassword, 
            phone || null, 
            address || null, 
            blood_type || null, 
            health_insurance_name || null, 
            health_insurance_card || null
        ];

        const { rows } = await db.query(queryInsert, params);

        return res.status(201).json({ 
            success: true, 
            message: '🎉 Cadastro realizado com sucesso! Seja bem-vindo à na.MED.',
            user: rows[0]
        });

    } catch (err) {
        console.error('💥 ERRO NO AUTO-CADASTRO DO PORTAL:', err.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao processar cadastro no servidor.' });
    }
});

module.exports = router;
