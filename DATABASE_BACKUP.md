# 💾 Guia de Backup e Extração da Base de Dados

Este guia explica como fazer backup, extração e restauração da base de dados SQLite do projeto Despesas Webapp.

## 📍 Localização da Base de Dados

### Local (Desenvolvimento):
- **Caminho**: `backend/despesas.db`
- **Formato**: SQLite

### Produção (Render):
- **Caminho**: `/data/despesas.db`
- **Formato**: SQLite
- **Persistência**: Disk de 256 MB (plano gratuito)

## 🔄 Fazer Backup Local

### 1. Backup Simples (Cópia do Ficheiro)

```bash
# Navegar para o diretório backend
cd backend

# Criar diretório de backups (se não existir)
mkdir -p backups

# Fazer backup com timestamp
cp despesas.db backups/despesas_backup_$(date +%Y%m%d_%H%M%S).db

# Ou manualmente
cp despesas.db backups/despesas_backup.db
```

### 2. Backup via API (Usando Endpoint Existente)

O projeto já tem um endpoint de backup:

```bash
# Fazer login primeiro para obter token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"sua_password"}'

# Usar o token para fazer backup
curl -X GET http://localhost:3000/api/backup \
  -H "Authorization: Bearer SEU_TOKEN" \
  -o backups/despesas_backup.db
```

### 3. Backup Automático (Script)

Crie um script de backup automático:

```bash
# backup_db.sh
#!/bin/bash
cd backend
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR
cp despesas.db $BACKUP_DIR/despesas_backup_$(date +%Y%m%d_%H%M%S).db
# Manter apenas os últimos 7 backups
ls -t $BACKUP_DIR/despesas_backup_*.db | tail -n +8 | xargs rm --
echo "Backup concluído: $(date)"
```

## 📥 Extrair Base de Dados do Render

### Método 1: Via Render Dashboard

1. **Aceda ao dashboard do Render**
2. **Clique no serviço backend**
3. **Vá à secção "Shell"** (se disponível no plano)
4. **Execute**:
   ```bash
   cd /data
   cat despesas.db > /tmp/despesas_backup.db
   ```
5. **Descarregue o ficheiro** via interface ou SCP

### Método 2: Via SSH (Se Disponível)

```bash
# Conectar via SSH ao serviço Render
ssh render@seu-servico-render

# Fazer backup
cd /data
cp despesas.db despesas_backup_$(date +%Y%m%d).db

# Descarregar via SCP
scp render@seu-servico-render:/data/despesas_backup.db ./backups/
```

### Método 3: Via API Endpoint (Recomendado)

1. **Faça deploy do endpoint de backup** (já existe no projeto)
2. **Use a API em produção**:
   ```bash
   # Fazer login
   curl -X POST https://despesas-backend.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"seu@email.com","password":"sua_password"}'
   
   # Fazer backup
   curl -X GET https://despesas-backend.onrender.com/api/backup \
     -H "Authorization: Bearer SEU_TOKEN" \
     -o backups/despesas_production_backup.db
   ```

### Método 4: Via Render Console (Para Logs)

1. **No dashboard do Render**, clique no serviço backend
2. **Vá à secção "Logs"**
3. **Use o console temporário** para executar comandos:
   ```bash
   cd /data && sqlite3 despesas.db ".backup /tmp/backup.db"
   ```

## 📤 Exportar para Diferentes Formatos

### Exportar para SQL

```bash
cd backend/backups
sqlite3 despesas_backup.db dump.sql
```

### Exportar para CSV (Tabela Específica)

```bash
sqlite3 despesas_backup.db \
  "SELECT * FROM expenses" \
  -header -csv > expenses.csv

sqlite3 despesas_backup.db \
  "SELECT * FROM users" \
  -header -csv > users.csv
```

### Exportar para JSON (Via Script Node.js)

Crie um script `export_to_json.js`:

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('backups/despesas_backup.db');

// Exportar todas as tabelas
const tables = ['users', 'expenses', 'settings', 'account_shares'];
const exportData = {};

tables.forEach(table => {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  exportData[table] = rows;
});

fs.writeFileSync('backups/database_export.json', JSON.stringify(exportData, null, 2));
console.log('Exportação concluída: database_export.json');

db.close();
```

Execute:
```bash
node export_to_json.js
```

## 🔄 Restaurar Base de Dados

### Restaurar Backup Local

```bash
cd backend
# Fazer backup da base atual (por segurança)
cp despesas.db despesas_current_backup.db

# Restaurar do backup
cp backups/despesas_backup_20250108_120000.db despesas.db
```

### Restaurar no Render

#### Via API (Recomendado)

1. **Primeiro, extraia o backup** via endpoint `/api/backup`
2. **Depois, crie um endpoint de restore** (se necessário)

#### Via SSH (Se Disponível)

```bash
# Upload do backup para o Render
scp backups/despesas_backup.db render@seu-servico-render:/tmp/

# Restaurar no servidor
ssh render@seu-servico-render
cd /data
cp despesas.db despesas_before_restore.db
cp /tmp/despesas_backup.db despesas.db
```

## 🤖 Automatização de Backups

### Backup Automático Local (Cron Job)

```bash
# Adicionar ao crontab (crontab -e)
# Executar backup diariamente às 2h da manhã
0 2 * * * cd /caminho/para/webapp/backend && ./backup_db.sh
```

### Backup Automático no Render

#### Opção 1: Usar Cron Jobs do Render

1. **No dashboard do Render**, crie um "Cron Job"
2. **Configure para chamar o endpoint `/api/backup`**
3. **Armazene o resultado** num serviço de storage (ex: Render Disk)

#### Opção 2: Script de Backup no Backend

Adicione ao `package.json`:
```json
{
  "scripts": {
    "backup": "node scripts/backup.js"
  }
}
```

Crie `scripts/backup.js`:
```javascript
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../despesas.db');
const backupDir = path.join(__dirname, '../backups');

// Criar diretório de backups
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Fazer backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `despesas_backup_${timestamp}.db`);

fs.copyFileSync(dbPath, backupPath);
console.log(`Backup criado: ${backupPath}`);

// Limpar backups antigos (manter últimos 7)
const files = fs.readdirSync(backupDir)
  .filter(file => file.startsWith('despesas_backup_'))
  .sort()
  .reverse();

if (files.length > 7) {
  files.slice(7).forEach(file => {
    fs.unlinkSync(path.join(backupDir, file));
    console.log(`Backup antigo removido: ${file}`);
  });
}
```

## 🔍 Verificar Integridade da Base de Dados

```bash
cd backend/backups
sqlite3 despesas_backup.db "PRAGMA integrity_check;"
```

Deve retornar: `ok`

## 📊 Ver Informações da Base de Dados

```bash
# Ver tamanho do ficheiro
ls -lh despesas.db

# Ver número de registos por tabela
sqlite3 despesas.db "SELECT COUNT(*) FROM users;"
sqlite3 despesas.db "SELECT COUNT(*) FROM expenses;"
sqlite3 despesas.db "SELECT COUNT(*) FROM settings;"

# Ver estrutura das tabelas
sqlite3 despesas.db ".schema"

# Ver todas as tabelas
sqlite3 despesas.db ".tables"
```

## 🌐 Backup em Produção (Render)

### Estratégia Recomendada:

1. **Backup Automático Diário**:
   - Usar Cron Job do Render para chamar `/api/backup`
   - Armazenar no Render Disk ou serviço externo

2. **Backup Manual Semanal**:
   - Fazer download manual via API endpoint
   - Armazenar localmente ou em cloud storage

3. **Backup antes de grandes alterações**:
   - Sempre fazer backup antes de migrations ou alterações estruturais

### Exemplo de Script de Backup Produção:

```javascript
// scripts/production_backup.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'https://despesas-backend.onrender.com';
const BACKUP_DIR = path.join(__dirname, '../backups/production');

// Criar diretório
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Fazer login e obter token
// (implementar lógica de autenticação)

// Fazer download do backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `despesas_production_${timestamp}.db`);

const file = fs.createWriteStream(backupPath);
https.get(`${BACKEND_URL}/api/backup`, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log(`Backup de produção salvo: ${backupPath}`);
  });
});
```

## 💡 Boas Práticas

1. **Backup Regular**: Faça backups diários ou semanais
2. **Backup antes de alterações**: Sempre antes de migrations ou grandes mudanças
3. **Testar restores**: Verifique regularmente se os backups podem ser restaurados
4. **Armazenamento seguro**: Mantenha backups em locais diferentes
5. **Documentação**: Mantenha registo dos backups e datas
6. **Compressão**: Para bases grandes, considere compressão dos backups
7. **Encriptação**: Para dados sensíveis, considere encriptar os backups

## 🆘 Solução de Problemas

### Base de Dados Corrompida

```bash
# Tentar recuperar
sqlite3 despesas.db ".recover" | sqlite3 recovered.db

# Se não funcionar, restaurar do backup mais recente
cp backups/despesas_backup_ultimo.db despesas.db
```

### Ficheiro de Backup Não Abre

```bash
# Verificar se é realmente SQLite
file despesas_backup.db

# Deve mostrar: SQLite 3.x database

# Tentar abrir com sqlite3
sqlite3 despesas_backup.db ".tables"
```

### Permissões no Render

Se tiver problemas de permissões no Render:
```bash
# No console do Render
chmod 644 /data/despesas.db
```

## 🎯 Resumo

### Backup Local Rápido:
```bash
cd backend
cp despesas.db backups/despesas_backup_$(date +%Y%m%d).db
```

### Backup Produção via API:
```bash
curl -X GET https://despesas-backend.onrender.com/api/backup \
  -H "Authorization: Bearer SEU_TOKEN" \
  -o backups/despesas_production.db
```

### Restaurar:
```bash
cd backend
cp despesas.db despesas_backup.db
cp backups/despesas_backup.db despesas.db
```

Com este guia, pode gerir facilmente os backups da base de dados SQLite do projeto.