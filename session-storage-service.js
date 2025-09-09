const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SessionStorageService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucketName = 'whatsapp-sessions';
    
    // Force local storage for testing
    this.useCloudStorage = false;
    console.log('💾 Using local file storage for sessions (testing mode)');
    
    // if (this.supabaseUrl && this.supabaseServiceKey) {
    //   this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
    //   this.useCloudStorage = true;
    //   console.log('☁️ Using Supabase Storage for sessions');
    // } else {
    //   this.useCloudStorage = false;
    //   console.log('💾 Using local file storage for sessions');
    // }
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
    // Always use local storage for testing
    const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
    const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
    
    console.log(`📁 Using local storage for session: ${sessionDir}`);
    return await useMultiFileAuthState(sessionDir);
  }

  // Delete session data (alias for deleteSession)
  async deleteSessionData(userId, sessionId) {
    // Always use local storage for testing
    return await this.deleteLocalSession(userId, sessionId);
  }

  // Save auth state (for compatibility)
  async saveAuthState(userId, sessionId, creds) {
    // Always use local storage for testing
    const sessionDir = path.join(__dirname, 'sessions', userId, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const credsPath = path.join(sessionDir, 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
    console.log(`💾 Saved auth state to local storage: ${credsPath}`);
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
