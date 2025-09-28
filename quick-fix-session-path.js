/**
 * Quick Fix: Environment Variable Session Path
 * Simple solution to change session storage location
 */

// In your server-supabase.js, replace this line:
// const sessionDir = path.join(__dirname, 'sessions', userId, sessionId || 'default');

// With this:
const sessionDir = path.join(
  process.env.SESSION_STORAGE_PATH || __dirname, 
  'sessions', 
  userId, 
  sessionId || 'default'
);

/**
 * Environment Variables to add to Railway:
 * 
 * SESSION_STORAGE_PATH=/tmp/sessions
 * 
 * This will store sessions in /tmp which might persist longer
 * or use a different path that Railway doesn't wipe
 */

/**
 * Alternative: Use Railway's persistent storage
 * 
 * SESSION_STORAGE_PATH=/data/sessions
 * 
 * And configure a persistent volume in Railway dashboard
 */
