const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials for storage service!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class SupabaseStorageService {
  constructor() {
    this.bucketName = 'whatsapp-sessions';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Upload session files to Supabase Storage
   */
  async uploadSessionFiles(userId, sessionId, localSessionPath) {
    try {
      console.log(`📤 Uploading session files for user: ${userId}, session: ${sessionId}`);
      
      if (!fs.existsSync(localSessionPath)) {
        throw new Error(`Session directory not found: ${localSessionPath}`);
      }

      const files = fs.readdirSync(localSessionPath, { withFileTypes: true });
      const uploadPromises = [];

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(localSessionPath, file.name);
          const storagePath = `${userId}/${sessionId}/${file.name}`;
          
          uploadPromises.push(this.uploadFile(filePath, storagePath));
        } else if (file.isDirectory()) {
          // Handle subdirectories (like 'keys' folder)
          const subDirPath = path.join(localSessionPath, file.name);
          const subFiles = fs.readdirSync(subDirPath, { withFileTypes: true });
          
          for (const subFile of subFiles) {
            if (subFile.isFile()) {
              const filePath = path.join(subDirPath, subFile.name);
              const storagePath = `${userId}/${sessionId}/${file.name}/${subFile.name}`;
              
              uploadPromises.push(this.uploadFile(filePath, storagePath));
            }
          }
        }
      }

      const results = await Promise.allSettled(uploadPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ Uploaded ${successful} files, ${failed} failed for session: ${sessionId}`);
      
      if (failed > 0) {
        console.warn(`⚠️ ${failed} files failed to upload for session: ${sessionId}`);
      }

      return { success: true, uploaded: successful, failed };
    } catch (error) {
      console.error(`❌ Error uploading session files:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload a single file to Supabase Storage
   */
  async uploadFile(localFilePath, storagePath) {
    try {
      const fileBuffer = fs.readFileSync(localFilePath);
      const fileName = path.basename(localFilePath);
      
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: this.getContentType(fileName),
          upsert: true
        });

      if (error) throw error;
      
      console.log(`✅ Uploaded: ${storagePath}`);
      return { success: true, path: storagePath };
    } catch (error) {
      console.error(`❌ Failed to upload ${storagePath}:`, error);
      throw error;
    }
  }

  /**
   * Download session files from Supabase Storage
   */
  async downloadSessionFiles(userId, sessionId, localSessionPath) {
    try {
      console.log(`📥 Downloading session files for user: ${userId}, session: ${sessionId}`);
      
      // Create local directory if it doesn't exist
      if (!fs.existsSync(localSessionPath)) {
        fs.mkdirSync(localSessionPath, { recursive: true });
      }

      // List files in the storage path
      const { data: files, error: listError } = await supabase.storage
        .from(this.bucketName)
        .list(`${userId}/${sessionId}`, {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) throw listError;

      if (!files || files.length === 0) {
        console.log(`📭 No files found for session: ${sessionId}`);
        return { success: true, downloaded: 0 };
      }

      const downloadPromises = files.map(file => {
        const storagePath = `${userId}/${sessionId}/${file.name}`;
        const localFilePath = path.join(localSessionPath, file.name);
        return this.downloadFile(storagePath, localFilePath);
      });

      const results = await Promise.allSettled(downloadPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ Downloaded ${successful} files, ${failed} failed for session: ${sessionId}`);
      
      return { success: true, downloaded: successful, failed };
    } catch (error) {
      console.error(`❌ Error downloading session files:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download a single file from Supabase Storage
   */
  async downloadFile(storagePath, localFilePath) {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(storagePath);

      if (error) throw error;

      // Convert blob to buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Ensure directory exists
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(localFilePath, buffer);
      
      console.log(`✅ Downloaded: ${storagePath} -> ${localFilePath}`);
      return { success: true, path: localFilePath };
    } catch (error) {
      console.error(`❌ Failed to download ${storagePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete session files from Supabase Storage
   */
  async deleteSessionFiles(userId, sessionId) {
    try {
      console.log(`🗑️ Deleting session files for user: ${userId}, session: ${sessionId}`);
      
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .remove([`${userId}/${sessionId}`]);

      if (error) throw error;
      
      console.log(`✅ Deleted session files for: ${sessionId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error deleting session files:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if session files exist in storage
   */
  async sessionExists(userId, sessionId) {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(`${userId}/${sessionId}`, { limit: 1 });

      if (error) throw error;
      
      return { exists: data && data.length > 0 };
    } catch (error) {
      console.error(`❌ Error checking session existence:`, error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Get content type based on file extension
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.dat': 'application/octet-stream',
      '.key': 'application/octet-stream'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Sync local session to cloud storage
   */
  async syncSessionToCloud(userId, sessionId, localSessionPath) {
    try {
      console.log(`🔄 Syncing session to cloud: ${sessionId}`);
      
      // Check if session exists in cloud
      const { exists } = await this.sessionExists(userId, sessionId);
      
      if (exists) {
        console.log(`📋 Session already exists in cloud: ${sessionId}`);
        return { success: true, action: 'exists' };
      }

      // Upload session files
      const result = await this.uploadSessionFiles(userId, sessionId, localSessionPath);
      
      if (result.success) {
        console.log(`✅ Session synced to cloud: ${sessionId}`);
        return { success: true, action: 'uploaded', ...result };
      } else {
        return result;
      }
    } catch (error) {
      console.error(`❌ Error syncing session to cloud:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore session from cloud storage
   */
  async restoreSessionFromCloud(userId, sessionId, localSessionPath) {
    try {
      console.log(`🔄 Restoring session from cloud: ${sessionId}`);
      
      // Check if session exists in cloud
      const { exists } = await this.sessionExists(userId, sessionId);
      
      if (!exists) {
        console.log(`📭 Session not found in cloud: ${sessionId}`);
        return { success: false, error: 'Session not found in cloud storage' };
      }

      // Download session files
      const result = await this.downloadSessionFiles(userId, sessionId, localSessionPath);
      
      if (result.success) {
        console.log(`✅ Session restored from cloud: ${sessionId}`);
        return { success: true, action: 'restored', ...result };
      } else {
        return result;
      }
    } catch (error) {
      console.error(`❌ Error restoring session from cloud:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SupabaseStorageService;
