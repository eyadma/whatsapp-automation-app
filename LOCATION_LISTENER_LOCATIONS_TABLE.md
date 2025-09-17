# Location Message Listener for Locations Table

This document describes the updated WhatsApp location message listener functionality that works with the `locations` table instead of the `customers` table.

## Overview

The location message listener automatically processes WhatsApp location messages and updates the `locations` table with location information. When a user sends a location message (either directly or as a quoted message), the system will:

1. Extract location coordinates and contact information
2. Convert WhatsApp phone numbers to Israeli local format
3. Check if the contact already exists in the locations table
4. Update existing locations or create new ones with location data
5. Set the `location_received` flag to true
6. Log the location message to the message history

## Features

### Location Detection
- **Direct Location Messages**: Detects when a user sends a location directly
- **Quoted Location Messages**: Detects when a user quotes a location message
- **Contact Information**: Extracts phone number and contact name (pushname) from the message
- **Phone Number Conversion**: Automatically converts WhatsApp international format (972526686285) to Israeli local format (0526686285)

### Database Operations
- **Existing Locations**: Updates **ALL** matching locations with longitude, latitude, location_received flag, and updated_at timestamp
- **New Locations**: Creates new location records only when no matches are found
- **Phone Number Matching**: Searches for locations by both `phone` and `phone2` fields using normalized comparison
- **Dual Phone Support**: Checks both primary phone and secondary phone (phone2) columns for matches
- **Duplicate Prevention**: Prevents creation of new locations when existing matches are found

### Message Logging
- **Message History**: Logs all location messages to the message_history table
- **Message Type**: Marks location messages with type 'location' for easy filtering

## Database Schema Requirements

### Locations Table
The `locations` table must have the following fields for location functionality:

```sql
-- Required fields for location functionality
ALTER TABLE locations 
ADD COLUMN longitude DECIMAL(10, 8),
ADD COLUMN latitude DECIMAL(11, 8),
ADD COLUMN location_received BOOLEAN DEFAULT false,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

### Existing Fields Used
- `id` - Primary key
- `user_id` - User identifier
- `name` - Contact name (updated with pushname from WhatsApp)
- `phone` - Primary phone number (converted to Israeli format)
- `phone2` - Secondary phone number (also checked for matches)
- `area` - Location area/address
- `created_at` - Creation timestamp

## Implementation Details

### Phone Number Handling

The system automatically handles phone number format conversion:

- **WhatsApp Format**: `972526686285` (international format)
- **Database Format**: `0526686285` (Israeli local format)
- **Conversion Logic**: 
  - Removes `972` country code
  - Adds `0` prefix for Israeli mobile numbers
  - Only converts numbers starting with `5` (mobile numbers)
  - Preserves other formats unchanged

### Server-Side Implementation

The message listener is implemented in the `connectWhatsApp` function in `server-supabase.js`:

```javascript
sock.ev.on('messages.upsert', async (event) => {
  for (const message of event.messages) {
    // Skip if message is from self
    if (message.key.fromMe) continue;
    
    // Check for location messages
    let locationData = null;
    
    // Direct location message
    if (message.message?.locationMessage) {
      locationData = message.message.locationMessage;
    }
    // Quoted location message
    else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage) {
      locationData = message.message.extendedTextMessage.contextInfo.quotedMessage.locationMessage;
    }
    
    if (locationData) {
      // Process location data
      // 1. Extract contact information
      // 2. Convert phone number
      // 3. Search for existing locations
      // 4. Update or create location record
      // 5. Log to message history
    }
  }
});
```

### Location Processing Flow

1. **Extract Contact Info**:
   - Get phone number from `message.key.remoteJid`
   - Get contact name from `message.pushName` or location data
   - Convert phone number to Israeli format

2. **Search for Existing Locations**:
   - Query locations table for matching phone numbers
   - Check both `phone` and `phone2` columns
   - Use normalized phone number comparison
   - Find ALL matching locations (not just the first one)

3. **Update or Create**:
   - If matches found: Update ALL matching locations with coordinates
   - If no matches: Create new location entry with sender details
   - Set `location_received` to true
   - Update `updated_at` timestamp

4. **Log Message**:
   - Insert record into `message_history` table
   - Mark message type as 'location'
   - Include coordinates in message text

## Setup Instructions

### 1. Database Setup

Run the SQL script to add required fields to the locations table:

```bash
# Run this SQL script in your Supabase dashboard or via psql
psql -h your-supabase-host -U postgres -d postgres -f add-location-fields-to-locations-table.sql
```

### 2. Test the Setup

Run the test script to verify everything is working:

```bash
node test-location-listener-locations-table.js
```

### 3. Start the Server

Start your WhatsApp server with the updated location listener:

```bash
node server-supabase.js
```

## Usage

### Automatic Processing
The location listener works automatically once WhatsApp is connected. No additional setup is required.

### Testing Location Messages
1. Connect WhatsApp to your application
2. Send a location message (direct or quoted)
3. Check the locations table for updates
4. Verify the `location_received` flag is set to true

### Monitoring
- Check server logs for location processing messages
- Monitor the locations table for new entries and updates
- Review message_history table for location message logs

## Error Handling

The system includes comprehensive error handling:

- **Database Errors**: Logged with detailed error messages
- **Phone Number Conversion**: Handles various formats gracefully
- **Missing Data**: Provides fallback values for missing information
- **Connection Issues**: Continues processing other messages if one fails

## Logging and Debugging

### Console Output
The system provides detailed console output for debugging:

```
📍 Direct location received for user user123:
  latitude: 32.0853
  longitude: 34.7818
  name: John Doe
  address: Tel Aviv, Israel

📞 Processing location for contact: John Doe
📱 WhatsApp phone: 972526686285 -> Converted: 0526686285
🔍 Searching for location with phone: 0526686285
   Checking location: John Doe
     Phone: 0501234567 -> Normalized: 501234567
     Phone2: 0526686285 -> Normalized: 526686285

✅ Found matching location: John Doe (ID: 123)
🔄 Updating 1 matching locations with location data
✅ Successfully updated location: John Doe
📝 Summary: Updated 1 existing locations with location data
```

### Database Logging
All location messages are logged to the `message_history` table with:
- Message type: 'location'
- Coordinates in message text
- Timestamp and user information

## Troubleshooting

### Common Issues

1. **"Locations table does not exist"**
   - Run the locations table creation script first

2. **"Column longitude does not exist"**
   - Run the `add-location-fields-to-locations-table.sql` script

3. **Phone numbers not matching**
   - Check phone number format conversion
   - Verify normalization logic

4. **Location not updating**
   - Check user_id matches
   - Verify database permissions
   - Check for RLS policies

### Debug Steps

1. Run the test script to verify setup
2. Check server logs for error messages
3. Verify database schema matches requirements
4. Test with a simple location message
5. Check message_history table for logged messages

## API Integration

The location listener integrates with the existing WhatsApp API:

- **Connection Endpoint**: `/api/whatsapp/connect/:userId`
- **Status Endpoint**: `/api/whatsapp/status/:userId`
- **Session Management**: Supports multi-session functionality

## Security Considerations

- **RLS Policies**: Ensure proper Row Level Security policies are in place
- **User Isolation**: Each user can only access their own location data
- **Data Validation**: Phone numbers and coordinates are validated before storage
- **Error Handling**: Sensitive information is not exposed in error messages
