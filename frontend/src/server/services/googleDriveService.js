const { google } = require('googleapis');
const { Readable } = require('stream');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/google/callback` 
  : 'https://despesa-app.vercel.app/api/google/callback';

const PARENT_FOLDER_NAME = 'Backup Despesas APP';

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    state: state
  });
}

async function getTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getOrCreateFolder(drive, folderName, parentId = null) {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const res = await drive.files.list({ q: query, spaces: 'drive', fields: 'files(id, name)' });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  
  const fileMetadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
  return folder.data.id;
}

async function uploadBackup(refreshToken, fileContent, fileName, targetFolder) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const parentFolderId = await getOrCreateFolder(drive, PARENT_FOLDER_NAME);
  const targetFolderId = await getOrCreateFolder(drive, targetFolder, parentFolderId);
  
  const fileMetadata = { name: fileName, parents: [targetFolderId] };
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

async function rotateBackups(refreshToken, targetFolder, maxToKeep) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const parentFolderId = await getOrCreateFolder(drive, PARENT_FOLDER_NAME);
  const targetFolderId = await getOrCreateFolder(drive, targetFolder, parentFolderId);
  
  const query = `'${targetFolderId}' in parents and trashed=false`;
  const res = await drive.files.list({ q: query, spaces: 'drive', orderBy: 'createdTime desc', fields: 'files(id, name, createdTime)' });
  
  const files = res.data.files || [];
  
  if (files.length > maxToKeep) {
    const filesToDelete = files.slice(maxToKeep);
    for (const f of filesToDelete) {
      await drive.files.delete({ fileId: f.id });
    }
  }
}

async function listBackups(refreshToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Obter ou verificar a pasta principal
  const parentFolderQuery = `mimeType='application/vnd.google-apps.folder' and name='${PARENT_FOLDER_NAME}' and trashed=false`;
  const parentRes = await drive.files.list({ q: parentFolderQuery, spaces: 'drive', fields: 'files(id, name)' });

  if (!parentRes.data.files || parentRes.data.files.length === 0) {
    return [];
  }

  const parentFolderId = parentRes.data.files[0].id;

  // Listar todas as subpastas dentro da pasta principal (ex: eliminados, semanal, mensal)
  const subfoldersQuery = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const subfoldersRes = await drive.files.list({ q: subfoldersQuery, spaces: 'drive', fields: 'files(id, name)' });
  const subfolders = subfoldersRes.data.files || [];

  const folderNames = { [parentFolderId]: 'Geral' };
  subfolders.forEach(sf => {
    folderNames[sf.id] = sf.name;
  });

  const allFolderIds = [parentFolderId, ...subfolders.map(sf => sf.id)];
  const parentConditions = allFolderIds.map(id => `'${id}' in parents`).join(' or ');
  const filesQuery = `(${parentConditions}) and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;

  const filesRes = await drive.files.list({
    q: filesQuery,
    spaces: 'drive',
    orderBy: 'createdTime desc',
    fields: 'files(id, name, parents, size, createdTime, modifiedTime)'
  });

  return (filesRes.data.files || []).map(f => {
    const parentId = f.parents ? f.parents[0] : null;
    return {
      id: f.id,
      name: f.name,
      folder: folderNames[parentId] || 'Geral',
      size: f.size ? parseInt(f.size, 10) : 0,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime
    };
  });
}

async function downloadBackup(refreshToken, fileId) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const res = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'text' }
  );

  let content = res.data;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (e) {
      // Manter como string se não for JSON válido
    }
  }
  return content;
}

module.exports = {
  getAuthUrl,
  getTokens,
  uploadBackup,
  rotateBackups,
  listBackups,
  downloadBackup
};
