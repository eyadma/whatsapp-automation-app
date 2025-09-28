# Railway Persistent Volumes Solution

## Problem
WhatsApp session data is stored in local file system (`sessions/` directory) which gets wiped on every Railway deployment.

## Solution: Railway Persistent Volumes

### Step 1: Create a Persistent Volume in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add a new variable:
   - **Name**: `RAILWAY_VOLUME_MOUNT_PATH`
   - **Value**: `/data`

### Step 2: Update Railway Configuration

Add this to your `railway.json` or configure in Railway dashboard:

```json
{
  "deploy": {
    "volumes": [
      {
        "name": "sessions-data",
        "mountPath": "/data/sessions"
      }
    ]
  }
}
```

### Step 3: Update Server Code

Modify the session directory path in `server-supabase.js`:

```javascript
// Change this line:
const sessionDir = path.join(__dirname, 'sessions', userId, sessionId || 'default');

// To this:
const sessionDir = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'sessions', userId, sessionId || 'default');
```

### Step 4: Environment Variables

Add to your Railway environment variables:
- `RAILWAY_VOLUME_MOUNT_PATH=/data`

## Benefits
- ✅ Sessions survive deployments
- ✅ No code changes to WhatsApp logic
- ✅ Automatic backup and persistence
- ✅ Easy to implement

## Cost
- Railway charges for persistent volume storage
- Usually very affordable for session data
