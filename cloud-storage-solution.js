/**
 * Cloud Storage Solution for WhatsApp Sessions
 * Uses AWS S3 or similar cloud storage for session persistence
 */

const AWS = require('aws-sdk');

class CloudSessionStorage {
  constructor() {
    // Configure AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bucketName = process.env.AWS_S3_BUCKET || 'whatsapp-sessions';
  }

  /**
   * Save session data to S3
   */
  async saveSessionData(userId, sessionId, sessionData) {
    try {
      const key = `sessions/${userId}/${sessionId}/session.json`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(sessionData),
        ContentType: 'application/json'
      };

      await this.s3.upload(params).promise();
      console.log('✅ Session data saved to S3');
      return { success: true };
    } catch (error) {
      console.error('Error saving to S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load session data from S3
   */
  async loadSessionData(userId, sessionId) {
    try {
      const key = `sessions/${userId}/${sessionId}/session.json`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const result = await this.s3.getObject(params).promise();
      const sessionData = JSON.parse(result.Body.toString());
      
      return { success: true, sessionData };
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return { success: false, error: 'Session not found' };
      }
      console.error('Error loading from S3:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete session data from S3
   */
  async deleteSessionData(userId, sessionId) {
    try {
      const key = `sessions/${userId}/${sessionId}/session.json`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      console.log('✅ Session data deleted from S3');
      return { success: true };
    } catch (error) {
      console.error('Error deleting from S3:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Custom auth state provider using cloud storage
 */
async function useCloudAuthState(userId, sessionId) {
  const storage = new CloudSessionStorage();
  
  // Load existing session data
  const result = await storage.loadSessionData(userId, sessionId);
  
  let state;
  if (result.success && result.sessionData) {
    // Restore from cloud storage
    state = result.sessionData;
  } else {
    // Create new state
    const { AuthenticationState } = require('@whiskeysockets/baileys');
    state = AuthenticationState.create();
  }

  // Save credentials function
  const saveCreds = async () => {
    try {
      await storage.saveSessionData(userId, sessionId, state);
    } catch (error) {
      console.error('❌ Error saving session data to cloud:', error);
    }
  };

  return { state, saveCreds };
}

module.exports = {
  CloudSessionStorage,
  useCloudAuthState
};
