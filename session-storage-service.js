const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SessionStorageService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucketName = 'whatsapp-sessions';
    
    if (this.supabaseUrl && this.supabaseServiceKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
      this.useCloudStorage = true;
      console.log('☁️ Using Supabase Storage for sessions');
    } else {
      this.useCloudStorage = false;
      console.log('💾 Using local file storage for sessions');
    }
  }

  // Get session file path
  getSessionPath(userId, sessionId, filename) {
    return `sessions/${userId}/${sessionId}/${filename}`;
  }

  // Upload session file to cloud storage
  async uploadSessionFile(userId, sessionId, filename, content) {
    if (!this.useCloudStorage) {
      return this.saveLocalFile(userId, sessionId, filename, content);
    }

    try {
      const filePath = this.getSessionPath(userId, sessionId, filename);
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, content, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) throw error;
      console.log(`☁️ Uploaded: ${filePath}`);
      return data;
    } catch (error) {
      console.error(`❌ Error uploading ${filename}:`, error);
      // Fallback to local storage
      return this.saveLocalFile(userId, sessionId, filename, content);
    }
  }

  // Download session file from cloud storage
  async downloadSessionFile(userId, sessionId, filename) {
    if (!this.useCloudStorage) {
      return this.loadLocalFile(userId, sessionId, filename);
    }

    try {
      const filePath = this.getSessionPath(userId, sessionId, filename);
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) throw error;
      
      const content = await data.text();
      console.log(`☁️ Downloaded: ${filePath}`);
      return content;
    } catch (error) {
      console.error(`❌ Error downloading ${filename}:`, error);
      // Fallback to local storage
      return this.loadLocalFile(userId, sessionId, filename);
    }
  }

  // List session files
  async listSessionFiles(userId, sessionId) {
    if (!this.useCloudStorage) {
      return this.listLocalFiles(userId, sessionId);
    }

    try {
      const folderPath = `sessions/${userId}/${sessionId}/`;
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folderPath);

      if (error) throw error;
      return data.map(file => file.name);
    } catch (error) {
      console.error(`❌ Error listing files for session ${sessionId}:`, error);
      return this.listLocalFiles(userId, sessionId);
    }
  }

  // Delete session file
  async deleteSessionFile(userId, sessionId, filename) {
    if (!this.useCloudStorage) {
      return this.deleteLocalFile(userId, sessionId, filename);
    }

    try {
      const filePath = this.getSessionPath(userId, sessionId, filename);
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) throw error;
      console.log(`☁️ Deleted: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting ${filename}:`, error);
      return this.deleteLocalFile(userId, sessionId, filename);
    }
  }

  // Delete entire session folder
  async deleteSession(userId, sessionId) {
    if (!this.useCloudStorage) {
      return this.deleteLocalSession(userId, sessionId);
    }

    try {
      const folderPath = `sessions/${userId}/${sessionId}/`;
      const { data: files } = await this.supabase.storage
        .from(this.bucketName)
        .list(folderPath);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${folderPath}${file.name}`);
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove(filePaths);

        if (error) throw error;
      }
      
      console.log(`☁️ Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting session ${sessionId}:`, error);
      return this.deleteLocalSession(userId, sessionId);
    }
  }

  // Get auth state for Baileys (compatible with useMultiFileAuthState)
  async getAuthState(userId, sessionId) {
    if (!this.useCloudStorage) {
      // Fallback to local storage
      const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
      const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
      return await useMultiFileAuthState(sessionDir);
    }

    try {
      // Create a temporary directory for this session
      const tempDir = path.join(__dirname, 'temp-sessions', userId, sessionId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Download session files from cloud storage to temp directory
      const folderPath = `sessions/${userId}/${sessionId}/`;
      const { data: files } = await this.supabase.storage
        .from(this.bucketName)
        .list(folderPath);

      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = `${folderPath}${file.name}`;
          const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .download(filePath);

          if (error) throw error;

          const localFilePath = path.join(tempDir, file.name);
          fs.writeFileSync(localFilePath, await data.arrayBuffer());
        }
      }

      // Use the temp directory with useMultiFileAuthState
      const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
      const { state, saveCreds } = await useMultiFileAuthState(tempDir);

      // Override saveCreds to upload to cloud storage
      const originalSaveCreds = saveCreds;
      const cloudSaveCreds = async (creds) => {
        // Save locally first
        await originalSaveCreds(creds);
        
        // Then upload to cloud storage
        try {
          const credsPath = path.join(tempDir, 'creds.json');
          if (fs.existsSync(credsPath)) {
            const credsContent = fs.readFileSync(credsPath);
            await this.uploadSessionFile(userId, sessionId, 'creds.json', credsContent);
          }
        } catch (error) {
          console.error('Error uploading creds to cloud:', error);
        }
      };

      return { state, saveCreds: cloudSaveCreds };
    } catch (error) {
      console.error(`❌ Error getting auth state from cloud:`, error);
      // Fallback to local storage
      const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
      const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
      return await useMultiFileAuthState(sessionDir);
    }
  }

  // Delete session data (alias for deleteSession)
  async deleteSessionData(userId, sessionId) {
    return await this.deleteSession(userId, sessionId);
  }

  // Save auth state (for compatibility)
  async saveAuthState(userId, sessionId, creds) {
    if (!this.useCloudStorage) {
      // Fallback to local storage
      const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      const credsPath = path.join(sessionDir, 'creds.json');
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
      return;
    }

    try {
      const credsContent = JSON.stringify(creds, null, 2);
      await this.uploadSessionFile(userId, sessionId, 'creds.json', credsContent);
    } catch (error) {
      console.error('Error saving auth state to cloud:', error);
      // Fallback to local storage
      const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      const credsPath = path.join(sessionDir, 'creds.json');
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
    }
  }

  // Local storage fallback methods
  saveLocalFile(userId, sessionId, filename, content) {
    const dir = path.join(__dirname, 'sessions', userId, sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content);
    console.log(`💾 Saved locally: ${filePath}`);
    return { path: filePath };
  }

  loadLocalFile(userId, sessionId, filename) {
    const filePath = path.join(__dirname, 'sessions', userId, sessionId, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`💾 Loaded locally: ${filePath}`);
      return content;
    }
    return null;
  }

  listLocalFiles(userId, sessionId) {
    const dir = path.join(__dirname, 'sessions', userId, sessionId);
    if (fs.existsSync(dir)) {
      return fs.readdirSync(dir);
    }
    return [];
  }

  deleteLocalFile(userId, sessionId, filename) {
    const filePath = path.join(__dirname, 'sessions', userId, sessionId, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`💾 Deleted locally: ${filePath}`);
      return true;
    }
    return false;
  }

  deleteLocalSession(userId, sessionId) {
    const dir = path.join(__dirname, 'sessions', userId, sessionId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`💾 Deleted local session: ${sessionId}`);
      return true;
    }
    return false;
  }
}

module.exports = SessionStorageService;
