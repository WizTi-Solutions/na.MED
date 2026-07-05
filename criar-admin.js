require('dotenv').config();
const db = require('./src/config/database');
const bcrypt = require('bcryptjs'); // 🎯 Usa a biblioteca real do seu projeto para gerar o hash correto

async function criarAdminDefinitivo() {
    try {
        const usuarioNumero = '12345678901'; 
        const senhaPlana = '123456'; 

        // Gera o hash perfeitamente compatível com o seu backend
        const hashGarantido = await bcrypt.hash(senhaPlana, 10);

        // Limpa qualquer tentativa anterior
        await db.query('DELETE FROM users WHERE email = $1', [usuarioNumero]);

        const query = `
            INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, 'admin')
            RETURNING id, name, email;
        `;

        const { rows } = await db.query(query, ['Administrador na.MED', usuarioNumero, hashGarantido]);
        
        console.log('\n==================================================');
        console.log('🎉 ADMIN DEFINITIVO GERADO COM BCRYPTJS!');
        console.log('==================================================');
        console.log(`🔢 Usuário: ${rows[0].email}`);
        console.log(`🔑 Senha:   ${senhaPlana}`);
        console.log('==================================================\n');

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        process.exit();
    }
}

criarAdminDefinitivo();
