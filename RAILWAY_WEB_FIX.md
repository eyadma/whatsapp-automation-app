# Railway Web Deployment Fix

## 🚨 **Issue Identified**

The Railway deployment was failing with 502 errors because:
1. The web build wasn't happening before serving
2. Port configuration wasn't correct for Railway
3. Missing proper start command

## ✅ **Fixes Applied**

### **1. Updated Package.json Scripts**
```json
{
  "scripts": {
    "start:web": "npm run build:web && npm run serve:web",
    "serve:web": "npx serve dist -s -l ${PORT:-3000}"
  }
}
```

### **2. Created Railway Configuration**
Created `mobile/railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:web",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 🚀 **Railway Deployment Steps**

### **Step 1: Create New Railway Service**
1. Go to Railway dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. **IMPORTANT**: Set **Root Directory** to `mobile`

### **Step 2: Configure Build Settings**
- **Root Directory**: `mobile` (CRITICAL!)
- **Build Command**: (leave empty - handled by start command)
- **Start Command**: `npm run start:web`

### **Step 3: Add Environment Variables**
```
EXPO_PUBLIC_RORK_API_BASE_URL=https://your-backend-service.railway.app
SUPABASE_URL=https://jfqsmfhsssfhqkoiytrb.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=3000
```

### **Step 4: Deploy**
Railway will:
1. Install dependencies
2. Build the web version (`npm run build:web`)
3. Serve the static files (`npm run serve:web`)
4. Make it available at your Railway URL

## 🔧 **What the Fix Does**

### **Before (Broken)**:
- Railway tried to serve `dist` folder that didn't exist
- Port was hardcoded to 3000
- No build step before serving

### **After (Fixed)**:
- `npm run start:web` builds first, then serves
- Uses Railway's `PORT` environment variable
- Proper health check configuration
- Automatic restart on failure

## 🧪 **Testing the Fix**

### **Local Testing**:
```bash
cd mobile
npm run start:web
```
Should:
1. Build the web version
2. Start serving on port 3000
3. Show "Accepting connections at http://localhost:3000"

### **Railway Testing**:
1. Deploy with the new configuration
2. Check Railway logs for:
   - "Web Bundled" message
   - "Accepting connections" message
   - No 502 errors

## 📋 **Railway Service Configuration Summary**

| Setting | Value |
|---------|-------|
| **Root Directory** | `mobile` |
| **Build Command** | (empty) |
| **Start Command** | `npm run start:web` |
| **Port** | `3000` (or Railway's assigned port) |
| **Health Check** | `/` |

## 🎯 **Expected Result**

After deployment, your web app should be accessible at:
`https://your-service-name.railway.app`

And you should see:
- ✅ No 502 errors
- ✅ Web app loads correctly
- ✅ All features work (login, WhatsApp, etc.)
- ✅ Responsive design on mobile/desktop

## 🆘 **If Still Having Issues**

1. **Check Railway Logs**:
   - Look for build errors
   - Verify port binding
   - Check for missing dependencies

2. **Verify Root Directory**:
   - Must be set to `mobile`
   - Not the project root

3. **Check Environment Variables**:
   - All required variables are set
   - Backend URL is correct

4. **Test Locally First**:
   ```bash
   cd mobile
   npm run start:web
   ```

The fix should resolve the 502 errors and make your web app accessible on Railway! 🚀
