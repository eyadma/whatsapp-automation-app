const fs = require('fs');
const path = require('path');
const SupabaseStorageService = require('./supabase-storage-service');
require('dotenv').config();

class SessionMigrationService {
  constructor() {
    this.storageService = new SupabaseStorageService();
    this.sessionsDir = path.join(__dirname, 'sessions');
  }

  /**
   * Migrate all existing sessions to cloud storage
   */
  async migrateAllSessions() {
    try {
      console.log('🚀 Starting session migration to cloud storage...');
      
      if (!fs.existsSync(this.sessionsDir)) {
        console.log('📭 No sessions directory found. Nothing to migrate.');
        return { success: true, migrated: 0 };
      }

      const userIds = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      console.log(`📁 Found ${userIds.length} user directories`);

      let totalMigrated = 0;
      let totalFailed = 0;

      for (const userId of userIds) {
        console.log(`\n👤 Processing user: ${userId}`);
        
        const userDir = path.join(this.sessionsDir, userId);
        const sessionDirs = fs.readdirSync(userDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        console.log(`📱 Found ${sessionDirs.length} sessions for user ${userId}`);

        for (const sessionId of sessionDirs) {
          console.log(`\n🔄 Migrating session: ${sessionId}`);
          
          const sessionPath = path.join(userDir, sessionId);
          const result = await this.migrateSession(userId, sessionId, sessionPath);
          
          if (result.success) {
            totalMigrated++;
            console.log(`✅ Successfully migrated session: ${sessionId}`);
          } else {
            totalFailed++;
            console.error(`❌ Failed to migrate session: ${sessionId} - ${result.error}`);
          }
        }
      }

      console.log(`\n🎉 Migration completed!`);
      console.log(`✅ Successfully migrated: ${totalMigrated} sessions`);
      console.log(`❌ Failed to migrate: ${totalFailed} sessions`);

      return { success: true, migrated: totalMigrated, failed: totalFailed };
    } catch (error) {
      console.error('❌ Error during migration:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Migrate a single session to cloud storage
   */
  async migrateSession(userId, sessionId, localSessionPath) {
    try {
      console.log(`📤 Uploading session files for user: ${userId}, session: ${sessionId}`);
      
      if (!fs.existsSync(localSessionPath)) {
        throw new Error(`Session directory not found: ${localSessionPath}`);
      }

      // Check if session already exists in cloud
      const { exists } = await this.storageService.sessionExists(userId, sessionId);
      
      if (exists) {
        console.log(`📋 Session already exists in cloud: ${sessionId}`);
        return { success: true, action: 'exists' };
      }

      // Upload session files
      const result = await this.storageService.uploadSessionFiles(userId, sessionId, localSessionPath);
      
      if (result.success) {
        console.log(`✅ Session migrated to cloud: ${sessionId}`);
        return { success: true, action: 'migrated', ...result };
      } else {
        return result;
      }
    } catch (error) {
      console.error(`❌ Error migrating session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify migration by checking cloud storage
   */
  async verifyMigration() {
    try {
      console.log('🔍 Verifying migration...');
      
      if (!fs.existsSync(this.sessionsDir)) {
        console.log('📭 No sessions directory found.');
        return { success: true, verified: 0 };
      }

      const userIds = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      let totalVerified = 0;
      let totalMissing = 0;

      for (const userId of userIds) {
        const userDir = path.join(this.sessionsDir, userId);
        const sessionDirs = fs.readdirSync(userDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const sessionId of sessionDirs) {
          const { exists } = await this.storageService.sessionExists(userId, sessionId);
          
          if (exists) {
            totalVerified++;
            console.log(`✅ Verified: ${userId}/${sessionId}`);
          } else {
            totalMissing++;
            console.log(`❌ Missing: ${userId}/${sessionId}`);
          }
        }
      }

      console.log(`\n📊 Verification Results:`);
      console.log(`✅ Verified in cloud: ${totalVerified} sessions`);
      console.log(`❌ Missing from cloud: ${totalMissing} sessions`);

      return { success: true, verified: totalVerified, missing: totalMissing };
    } catch (error) {
      console.error('❌ Error during verification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up local sessions after successful migration
   */
  async cleanupLocalSessions() {
    try {
      console.log('🧹 Cleaning up local sessions...');
      
      if (!fs.existsSync(this.sessionsDir)) {
        console.log('📭 No sessions directory found.');
        return { success: true, cleaned: 0 };
      }

      const userIds = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      let totalCleaned = 0;

      for (const userId of userIds) {
        const userDir = path.join(this.sessionsDir, userId);
        const sessionDirs = fs.readdirSync(userDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const sessionId of sessionDirs) {
          // Verify session exists in cloud before deleting locally
          const { exists } = await this.storageService.sessionExists(userId, sessionId);
          
          if (exists) {
            const sessionPath = path.join(userDir, sessionId);
            fs.rmSync(sessionPath, { recursive: true, force: true });
            totalCleaned++;
            console.log(`🗑️ Cleaned up local session: ${userId}/${sessionId}`);
          } else {
            console.log(`⚠️ Skipping cleanup for ${userId}/${sessionId} - not found in cloud`);
          }
        }

        // Remove empty user directory
        if (fs.readdirSync(userDir).length === 0) {
          fs.rmdirSync(userDir);
          console.log(`🗑️ Removed empty user directory: ${userId}`);
        }
      }

      console.log(`\n🧹 Cleanup completed!`);
      console.log(`🗑️ Cleaned up: ${totalCleaned} local sessions`);

      return { success: true, cleaned: totalCleaned };
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Main execution
async function main() {
  const migrationService = new SessionMigrationService();
  
  console.log('🚀 WhatsApp Session Migration to Cloud Storage');
  console.log('==============================================\n');

  // Step 1: Migrate all sessions
  console.log('Step 1: Migrating sessions to cloud storage...');
  const migrationResult = await migrationService.migrateAllSessions();
  
  if (!migrationResult.success) {
    console.error('❌ Migration failed:', migrationResult.error);
    process.exit(1);
  }

  // Step 2: Verify migration
  console.log('\nStep 2: Verifying migration...');
  const verificationResult = await migrationService.verifyMigration();
  
  if (!verificationResult.success) {
    console.error('❌ Verification failed:', verificationResult.error);
    process.exit(1);
  }

  // Step 3: Ask for cleanup confirmation
  if (verificationResult.missing === 0) {
    console.log('\nStep 3: All sessions verified in cloud storage!');
    console.log('🧹 You can now safely clean up local sessions.');
    console.log('⚠️  This will delete local session files (they are now in cloud storage).');
    console.log('💡 Run: node migrate-sessions-to-cloud.js --cleanup to clean up local files.');
  } else {
    console.log('\n⚠️  Some sessions are missing from cloud storage.');
    console.log('🔍 Please check the migration and try again.');
  }

  console.log('\n🎉 Migration process completed!');
}

// Handle command line arguments
if (process.argv.includes('--cleanup')) {
  const migrationService = new SessionMigrationService();
  migrationService.cleanupLocalSessions()
    .then(result => {
      if (result.success) {
        console.log('✅ Cleanup completed successfully!');
      } else {
        console.error('❌ Cleanup failed:', result.error);
        process.exit(1);
      }
    });
} else {
  main().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

module.exports = SessionMigrationService;
