const bcrypt = require('bcryptjs');

// Gere o hash para a sua password desejada
const password = process.argv[2] || 'admin123'; // Use: node generate-hash.js sua_senha
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUse este hash no comando SQL:');
console.log(`INSERT INTO users (email, password, status, role, created_at) VALUES ('seuemail@exemplo.com', '${hash}', 'approved', 'admin', CURRENT_TIMESTAMP);`);
