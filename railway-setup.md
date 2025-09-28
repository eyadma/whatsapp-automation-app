# Railway Session Persistence Setup

## ✅ Code Changes Applied

I've updated your `server-supabase.js` to use Railway's persistent volume path instead of the local file system.

## 🚀 Next Steps

### 1. Add Environment Variable in Railway

Go to your Railway project dashboard:
1. Click on your service
2. Go to "Variables" tab
3. Add new variable:
   - **Name**: `RAILWAY_VOLUME_MOUNT_PATH`
   - **Value**: `/data`

### 2. Configure Persistent Volume

In Railway dashboard:
1. Go to your service → Settings
2. Scroll down to "Volumes" section
3. Add a new volume:
   - **Name**: `sessions-data`
   - **Mount Path**: `/data`

### 3. Deploy

Push your changes to trigger a new deployment:
```bash
git add .
git commit -m "Add Railway persistent volume support for WhatsApp sessions"
git push
```

## 🔍 How It Works

- **Before**: Sessions stored in `./sessions/` (gets wiped on deploy)
- **After**: Sessions stored in `/data/sessions/` (persists across deployments)

The code now uses:
```javascript
const sessionDir = path.join(
  process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 
  'sessions', 
  userId, 
  sessionId || 'default'
);
```

## 💰 Cost

Railway charges approximately $0.10/GB/month for persistent volumes. For WhatsApp session data, this should be very minimal (likely under $1/month).

## ✅ Testing

After deployment:
1. Connect a WhatsApp session
2. Wait for Railway to deploy again (or trigger manually)
3. Check if the session persists and reconnects automatically

## 🆘 If Issues Occur

If you encounter any problems:
1. Check Railway logs for volume mount errors
2. Verify the environment variable is set correctly
3. Ensure the volume is properly configured in Railway dashboard

The fallback to `__dirname` ensures the app still works even if the volume isn't configured.
