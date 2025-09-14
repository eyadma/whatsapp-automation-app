<<<<<<< HEAD
# 🚀 **WhatsApp Cloud API Project**

A Node.js server for sending WhatsApp messages using the official Meta WhatsApp Cloud API.

## ✅ **Features**

- ✅ **Send individual messages** to WhatsApp users
- ✅ **Send bulk messages** to multiple users
- ✅ **Message status tracking** 
- ✅ **Rate limiting protection**
- ✅ **Error handling** and logging
- ✅ **RESTful API** endpoints
- ✅ **No Puppeteer** - Pure HTTP API calls
- ✅ **Low resource usage** - Minimal CPU/Memory
- ✅ **Server friendly** - Works on any hosting

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Set Up Environment Variables**
```bash
cp env.example .env
```

Edit `.env` file with your WhatsApp Cloud API credentials:
```env
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
PORT=3001
```

### **3. Start the Server**
```bash
npm start
```

The server will run on `http://localhost:3001`

## 📋 **API Endpoints**

### **Health Check**
```bash
GET /api/health
```

### **Test Configuration**
```bash
GET /api/test
```

### **Send Single Message**
```bash
POST /api/messages/send
Content-Type: application/json

{
  "to": "972501234567",
  "text": "Hello from WhatsApp Cloud API!"
}
```

### **Send Bulk Messages**
```bash
POST /api/messages/send-bulk
Content-Type: application/json

{
  "messages": [
    {
      "to": "972501234567",
      "text": "Hello John!"
    },
    {
      "to": "972507654321", 
      "text": "Hello Jane!"
    }
  ]
}
```

### **Get Message Status**
```bash
GET /api/messages/status/{messageId}
```

## 🔧 **Setup WhatsApp Cloud API**

### **Step 1: Create Facebook Developer Account**
1. Go to https://developers.facebook.com/
2. Click "Get Started" or "Log In"
3. Create a new app (Business type)
4. Add "WhatsApp" product to your app

### **Step 2: Configure WhatsApp Business**
1. In your app dashboard, go to "WhatsApp" > "Getting Started"
2. Add your phone number for testing
3. Get your access token and phone number ID

### **Step 3: Test the Setup**
```bash
# Test the server
curl http://localhost:3001/api/test

# Test sending a message
curl -X POST http://localhost:3001/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "972501234567",
    "text": "Hello from WhatsApp Cloud API!"
  }'
```

## 📱 **Usage Examples**

### **JavaScript/Node.js**
```javascript
// Send single message
const response = await fetch('http://localhost:3001/api/messages/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '972501234567',
    text: 'Hello from WhatsApp Cloud API!'
  })
});

const result = await response.json();
console.log(result);
```

### **Python**
```python
import requests

# Send single message
response = requests.post('http://localhost:3001/api/messages/send', 
  json={
    'to': '972501234567',
    'text': 'Hello from WhatsApp Cloud API!'
  }
)

result = response.json()
print(result)
```

### **cURL**
```bash
# Send single message
curl -X POST http://localhost:3001/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "972501234567",
    "text": "Hello from WhatsApp Cloud API!"
  }'

# Send bulk messages
curl -X POST http://localhost:3001/api/messages/send-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "to": "972501234567",
        "text": "Hello John!"
      },
      {
        "to": "972507654321",
        "text": "Hello Jane!"
      }
    ]
  }'
```

## 💰 **Pricing**

### **Free Tier:**
- 1,000 messages/month
- Perfect for testing and small usage

### **Paid Tier:**
- $0.005 per message (after free tier)
- Very affordable for business use

## 🔒 **Security**

- Store your access token securely
- Use environment variables
- Don't commit `.env` file to version control
- Use HTTPS in production

## 🚀 **Deployment**

### **Heroku**
```bash
# Create Heroku app
heroku create your-whatsapp-api

# Set environment variables
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token
heroku config:set WHATSAPP_PHONE_NUMBER_ID=your_phone_id

# Deploy
git push heroku main
```

### **Railway**
```bash
# Connect to Railway
railway login
railway init

# Set environment variables
railway variables set WHATSAPP_ACCESS_TOKEN=your_token
railway variables set WHATSAPP_PHONE_NUMBER_ID=your_phone_id

# Deploy
railway up
```

### **VPS/Docker**
```bash
# Build Docker image
docker build -t whatsapp-cloud-api .

# Run container
docker run -p 3001:3001 \
  -e WHATSAPP_ACCESS_TOKEN=your_token \
  -e WHATSAPP_PHONE_NUMBER_ID=your_phone_id \
  whatsapp-cloud-api
```

## 🐛 **Troubleshooting**

### **Common Issues:**

1. **"WhatsApp credentials not configured"**
   - Check your `.env` file
   - Verify environment variables are set

2. **"Invalid phone number"**
   - Use international format (e.g., 972501234567)
   - Remove + symbol

3. **"Rate limit exceeded"**
   - Wait between messages
   - Check your WhatsApp Business API limits

4. **"Access token expired"**
   - Generate new access token
   - Update your `.env` file

## 📞 **Support**

If you need help:
1. Check the troubleshooting section
2. Review WhatsApp Cloud API documentation
3. Check server logs for detailed error messages

## 📄 **License**

MIT License - feel free to use this project for your own applications.

---

**🎯 This project provides a clean, scalable solution for WhatsApp messaging without the resource issues of Puppeteer-based solutions!** 
=======
# whatsapp-automation-app
ssssssssss
>>>>>>> eca47a51733b083b1a0a228227ae5ba29318e18b
