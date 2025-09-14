# WhatsApp Automation App - Deployment Guide

## 🚀 Deployment Overview

This guide covers deploying your WhatsApp automation app to:
- **Supabase Storage**: `whatsapp-sessions` bucket for session storage
- **Railway Backend**: `whatsapp-automation-app-production.up.railway.app`
- **Mobile APK**: Built with Expo for preview distribution

## 📋 Prerequisites

1. **Supabase Account**: With project created
2. **Railway Account**: For backend deployment
3. **Expo Account**: For mobile app building
4. **Environment Variables**: Set up in all platforms

## 🔧 Environment Variables

### Required Variables:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
PORT=3000
NODE_ENV=production
```

## 🗄️ Supabase Storage Setup

✅ **Completed**: Storage bucket `whatsapp-sessions` is already set up with:
- Private access
- User-based RLS policies
- 10MB file size limit
- JSON and text file support

## 🚂 Railway Backend Deployment

### Step 1: Connect Repository
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### Step 2: Configure Environment Variables
In Railway dashboard, add these environment variables:
```
SUPABASE_URL=https://jfqsmfhsssfhqkoiytrb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXNtZmhzc3NmaHFrb2l5dHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTY0NzksImV4cCI6MjA3MTczMjQ3OX0.0Q3pERUd_fGtEmzySrHAQxd98WTL_CRzTc_t5-ghrdE
PORT=3000
NODE_ENV=production
```

### Step 3: Deploy
1. Railway will automatically detect the Node.js app
2. It will use the `Procfile` and `railway.json` configuration
3. The app will be available at: `https://whatsapp-automation-app-production.up.railway.app`

### Step 4: Verify Deployment
Test the health endpoint:
```bash
curl https://whatsapp-automation-app-production.up.railway.app/api/health
```

## 📱 Mobile App Build (Expo)

### Step 1: Install EAS CLI
```bash
npm install -g @expo/eas-cli
```

### Step 2: Login to Expo
```bash
eas login
```

### Step 3: Build APK
```bash
cd mobile
eas build --platform android --profile preview
```

### Step 4: Download APK
- The build will be available in your Expo dashboard
- Download the APK for distribution

## 🔄 Post-Deployment Configuration

### Update Mobile App Configuration
The mobile app is already configured to use:
- **Development**: Local backend (`http://192.168.0.113:3000`)
- **Production**: Railway backend (`https://whatsapp-automation-app-production.up.railway.app`)

### Test the Complete Flow
1. Deploy backend to Railway
2. Build and install mobile APK
3. Test WhatsApp connection
4. Verify session storage in Supabase

## 🛠️ Troubleshooting

### Common Issues:

1. **Railway Deployment Fails**
   - Check environment variables are set correctly
   - Verify `package.json` has correct start script
   - Check Railway logs for specific errors

2. **Mobile App Can't Connect**
   - Verify Railway URL is accessible
   - Check CORS settings in backend
   - Ensure mobile app is using production build

3. **Supabase Storage Issues**
   - Verify RLS policies are set correctly
   - Check service role key permissions
   - Ensure bucket exists and is accessible

## 📊 Monitoring

### Railway Monitoring
- View logs in Railway dashboard
- Monitor resource usage
- Set up alerts for downtime

### Supabase Monitoring
- Monitor storage usage
- Check authentication logs
- Review RLS policy effectiveness

## 🔐 Security Considerations

1. **Environment Variables**: Never commit sensitive keys to git
2. **RLS Policies**: Ensure proper user isolation in Supabase
3. **CORS**: Configure appropriate CORS settings for production
4. **Rate Limiting**: Consider implementing rate limiting for API endpoints

## 📞 Support

If you encounter issues:
1. Check the logs in Railway dashboard
2. Verify environment variables
3. Test endpoints individually
4. Review Supabase dashboard for storage issues

---

**Deployment Status**: ✅ Ready for deployment
**Last Updated**: $(date)
