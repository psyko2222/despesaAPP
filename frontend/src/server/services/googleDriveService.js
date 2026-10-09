const { google } = require('googleapis');
const { Readable } = require('stream');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/google/callback` 
  : 'https://despesa-app.vercel.app/api/google/callback';

const FOLDER_NAME = 'Backup DespesasAPP';

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Para receber refresh token
    prompt: 'consent', // Forçar consentimento para garantir refresh token sempre
    scope: ['https://www.googleapis.com/auth/drive.file'], // Permissão apenas para ficheiros criados pela app
    state: state
  });
}

async function getTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Retorna o ID da pasta. Se não existir, cria.
async function getOrCreateFolder(drive) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
  const res = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  
  // Criar pasta
  const fileMetadata = { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
  const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
  return folder.data.id;
}

async function uploadBackup(refreshToken, fileContent, fileName) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const folderId = await getOrCreateFolder(drive);
  
  const fileMetadata = { name: fileName, parents: [folderId] };
  const media = {
    mimeType: 'application/json',
    body: Readable.from(Buffer.from(fileContent, 'utf-8'))
  };
  
  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
  
  return res.data.id;
}

async function rotateBackups(refreshToken, prefix, maxToKeep) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const folderId = await getOrCreateFolder(drive);
  
  // Procurar backups com este prefixo (ex: "backup semanal")
  const query = `'${folderId}' in parents and name contains '${prefix}' and trashed=false`;
  const res = await drive.files.list({ q: query, spaces: 'drive', orderBy: 'createdTime desc', fields: 'files(id, name, createdTime)' });
  
  const files = res.data.files || [];
  
  if (files.length > maxToKeep) {
    // Manter apenas maxToKeep (ex: manter 2, apagar o resto)
    const filesToDelete = files.slice(maxToKeep);
    for (const f of filesToDelete) {
      await drive.files.delete({ fileId: f.id });
    }
  }
}

module.exports = {
  getAuthUrl,
  getTokens,
  uploadBackup,
  rotateBackups
};
