# Network Troubleshooting Guide

## Issue: "Network request failed" Error

### **Problem Description**
The mobile app is showing "Network request failed" when trying to connect to the WhatsApp server.

### **Server Status** ✅
- **Server Running**: ✅ Yes (port 3000)
- **IP Address**: ✅ 192.168.0.113
- **Health Check**: ✅ Working
- **WhatsApp Connection**: ✅ Working
- **API Endpoints**: ✅ All functional

### **Root Cause Analysis**

The "Network request failed" error typically occurs when:
1. **Network Connectivity**: Mobile device not on same network as server
2. **Firewall Issues**: Network firewall blocking connections
3. **IP Address Changes**: Server IP address has changed
4. **Port Blocking**: Port 3000 is blocked by network
5. **Device Configuration**: Mobile device network settings

## Troubleshooting Steps

### **Step 1: Verify Network Connectivity**

#### **Check Server IP Address**
```bash
# On the server machine, run:
ifconfig | grep "inet " | grep -v 127.0.0.1
# Should show: inet 192.168.0.113
```

#### **Test Server Accessibility**
```bash
# Test from any device on the same network:
curl http://192.168.0.113:3000/api/health
# Expected: {"success":true,"message":"WhatsApp Automation API is running"}
```

### **Step 2: Mobile Device Network Check**

#### **Verify Mobile Device Network**
1. **Check WiFi Connection**: Ensure mobile device is connected to the same WiFi network
2. **Check IP Range**: Mobile device should be on 192.168.0.x network
3. **Test Browser**: Open browser on mobile device and go to `http://192.168.0.113:3000/api/health`

#### **Mobile Device IP Check**
- **Android**: Settings > WiFi > Connected Network > Advanced > IP Address
- **iOS**: Settings > WiFi > Connected Network > (i) > IP Address
- Should be in range: 192.168.0.1 - 192.168.0.254

### **Step 3: Network Configuration**

#### **Update Mobile App Configuration**
If the server IP has changed, update the mobile app:

**File**: `mobile/src/services/apiBase.js`
```javascript
const LAN_IP = '192.168.0.113'; // Update this if your IP changes
```

#### **Alternative IP Addresses to Try**
```javascript
// Common alternatives:
const LAN_IP = '192.168.1.113';  // Different subnet
const LAN_IP = '10.0.0.113';     // Different network range
const LAN_IP = '172.16.0.113';   // Another common range
```

### **Step 4: Firewall and Port Issues**

#### **Check Server Firewall**
```bash
# On macOS (if using built-in firewall):
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Node.js through firewall:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

#### **Test Port Accessibility**
```bash
# Test if port 3000 is accessible:
telnet 192.168.0.113 3000
# Should connect successfully
```

### **Step 5: Mobile App Debugging**

#### **Enable Network Logging**
Add this to your mobile app to see detailed network logs:

```javascript
// In your API service file:
console.log('🔍 Testing network connectivity...');
console.log('📱 Device platform:', Platform.OS);
console.log('🌐 Testing URL:', url);

// Add error logging:
.catch(error => {
  console.error('❌ Network error details:', error);
  console.error('❌ Error message:', error.message);
  console.error('❌ Error code:', error.code);
});
```

#### **Test Different URLs**
The mobile app tries these URLs in order:
1. `http://10.0.2.2:3000` (Android emulator)
2. `http://192.168.0.113:3000` (Physical device)
3. `http://localhost:3000` (Fallback)

### **Step 6: Network Diagnostics**

#### **Ping Test**
```bash
# From mobile device or another computer on same network:
ping 192.168.0.113
# Should show successful ping responses
```

#### **Port Scan**
```bash
# Check if port 3000 is open:
nmap -p 3000 192.168.0.113
# Should show: 3000/tcp open
```

## Quick Fixes

### **Fix 1: Update IP Address**
If your server IP has changed:

1. **Find new IP**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Update mobile app**:
   ```javascript
   // In mobile/src/services/apiBase.js
   const LAN_IP = 'YOUR_NEW_IP_HERE';
   ```

3. **Restart mobile app**

### **Fix 2: Use Localhost for Testing**
If testing on the same machine:

1. **Update mobile app**:
   ```javascript
   const LAN_IP = 'localhost';
   ```

2. **Or use 127.0.0.1**:
   ```javascript
   const LAN_IP = '127.0.0.1';
   ```

### **Fix 3: Check Network Settings**
1. **Restart WiFi** on mobile device
2. **Restart server**:
   ```bash
   pkill -f "node server-supabase.js"
   node server-supabase.js
   ```
3. **Clear mobile app cache**

## Advanced Troubleshooting

### **Network Interface Issues**
```bash
# Check all network interfaces:
ifconfig -a

# Check routing table:
netstat -rn

# Check active connections:
netstat -an | grep 3000
```

### **Mobile App Network Permissions**
Ensure your mobile app has network permissions:

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**iOS** (should work by default in development)

### **CORS Issues**
The server already has CORS enabled:
```javascript
app.use(cors()); // Allows all origins
```

## Testing Commands

### **Server Health Check**
```bash
curl http://192.168.0.113:3000/api/health
```

### **WhatsApp Status Check**
```bash
curl http://192.168.0.113:3000/api/whatsapp/status/test-user
```

### **WhatsApp Connect Test**
```bash
curl -X POST http://192.168.0.113:3000/api/whatsapp/connect/test-user \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Common Solutions

### **Solution 1: Network Mismatch**
- **Problem**: Mobile device on different network
- **Solution**: Connect mobile device to same WiFi network as server

### **Solution 2: IP Address Changed**
- **Problem**: Server IP address changed
- **Solution**: Update `LAN_IP` in mobile app configuration

### **Solution 3: Firewall Blocking**
- **Problem**: Network firewall blocking port 3000
- **Solution**: Configure firewall to allow port 3000

### **Solution 4: Port Already in Use**
- **Problem**: Another service using port 3000
- **Solution**: Change server port or stop conflicting service

## Current Server Status

✅ **Server Running**: Port 3000  
✅ **IP Address**: 192.168.0.113  
✅ **Health Endpoint**: Working  
✅ **WhatsApp API**: Working  
✅ **CORS Enabled**: Yes  
✅ **Network Accessible**: Yes  

## Next Steps

1. **Verify mobile device is on same network** (192.168.0.x)
2. **Test server accessibility from mobile device browser**
3. **Check mobile app network logs**
4. **Update IP address if needed**
5. **Restart both server and mobile app**

The server is working correctly, so the issue is likely network connectivity between the mobile device and server.
