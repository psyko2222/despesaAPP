const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

const driveSectionRegex = /\s*{\/\* 6. Backup Automático Google Drive \*\/\}.*?drive_backup_enabled: 0 \}\)\);\s*\}\}\s*className="text-xs text-red-600 dark:text-red-400 hover:underline"\s*>\s*Desligar\s*<\/button>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>/s;

const match = code.match(driveSectionRegex);
let driveSection = "";
if (match) {
  driveSection = match[0];
  code = code.replace(driveSectionRegex, '');
} else {
  console.log('drive section not found');
}

const targetTab2 = /<h3 className="font-semibold text-gray-800 dark:text-gray-200\s*mb-2">Backup<\/h3>/;
const manualBackupCode = `
              <div className="flex gap-2 mb-4">
                 <Button onClick={() => handleDriveBackup('semanal')} disabled={exporting} className="w-full" variant="outline">
                    Testar Backup Semanal
                 </Button>
                 <Button onClick={() => handleDriveBackup('mensal')} disabled={exporting} className="w-full" variant="outline">
                    Testar Backup Mensal
                 </Button>
              </div>
`;

if (driveSection) {
  // modify driveSection slightly if we want to change title
  driveSection = driveSection.replace(/6. Backup Automático Google Drive/, 'Backup Automático Google Drive');
  
  const insertion = `<h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Google Drive</h3>` + 
                    driveSection + manualBackupCode + 
                    `\n<h3 className="font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-2">Backup Local</h3>`;
                    
  code = code.replace(targetTab2, insertion);
}

// Add the handleDriveBackup function
const funcCode = `
  const handleDriveBackup = async (type: 'semanal' | 'mensal') => {
    setExporting(true);
    try {
      const res = await fetch('/api/google/manual-backup', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (res.ok) {
        setSaveSuccess(data.message || \`Backup \${type} gravado com sucesso no Google Drive!\`);
        setTimeout(() => setSaveSuccess(''), 5000);
      } else {
        alert(data.error || 'Erro ao realizar backup');
      }
    } catch (e) {
      alert('Erro de ligacao ao servidor.');
    }
    setExporting(false);
  };

  const handleExport = async () => {
`;
code = code.replace(/const handleExport = async \(\) => {/, funcCode);

fs.writeFileSync('src/components/SettingsScreen.tsx', code);

