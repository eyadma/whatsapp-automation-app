# Location Message Listener

This document describes the WhatsApp location message listener functionality that has been added to the application.

## Overview

The location message listener automatically processes WhatsApp location messages and updates the customers table with location information. When a user sends a location message (either directly or as a quoted message), the system will:

1. Extract location coordinates and contact information
2. Check if the contact already exists in the customers table
3. Update existing customers or create new ones with location data
4. Log the location message to the message history

## Features

### Location Detection
- **Direct Location Messages**: Detects when a user sends a location directly
- **Quoted Location Messages**: Detects when a user quotes a location message
- **Contact Information**: Extracts phone number and contact name from the message
- **Phone Number Conversion**: Automatically converts WhatsApp international format (972526686285) to Israeli local format (0526686285)

### Multi-Customer Updates
- **Batch Updates**: Updates ALL customers with matching phone numbers
- **Data Synchronization**: Ensures location data is consistent across all related records
- **Duplicate Prevention**: Prevents creation of new customers when existing matches exist
- **Comprehensive Logging**: Tracks updates for each customer individually

### Database Updates
- **Existing Customers**: Updates **ALL** matching customers with longitude, latitude, location_received flag, and updated_at timestamp
- **New Customers**: Creates new customer records only when no matches are found
- **Phone Number Matching**: Searches for customers by both phone and phone2 fields using normalized comparison
- **Duplicate Prevention**: Prevents creation of new customers when existing matches are found

### Message Logging
- **Message History**: Logs all location messages to the message_history table
- **Message Type**: Marks location messages with type 'location' for easy filtering

## Database Schema Changes

### Customers Table
New fields added to the `customers` table:

```sql
ALTER TABLE customers 
ADD COLUMN longitude DECIMAL(10, 8),
ADD COLUMN latitude DECIMAL(11, 8),
ADD COLUMN location_received BOOLEAN DEFAULT false;
```

### Message History Table
New field added to the `message_history` table:

```sql
ALTER TABLE message_history 
ADD COLUMN message_type TEXT DEFAULT 'text';
```

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

### Server-Side (server-supabase.js)

The message listener is implemented in the `connectWhatsApp` function:

```javascript
sock.ev.on('messages.upsert', async (event) => {
  // Process each message
  for (const message of event.messages) {
    // Check for location messages
    if (message.message?.locationMessage) {
      // Process direct location
    } else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.locationMessage) {
      // Process quoted location
    }
    
    // Update or create customer record
    // Log to message history
  }
});
```

### Mobile App Updates

The mobile app has been updated to display location information:

- **Customer Cards**: Show location coordinates when available
- **Location Chip**: Visual indicator for customers with location data
- **Translations**: Added support for "Location Received" in multiple languages

## Usage

### Automatic Processing
The location listener works automatically once WhatsApp is connected. No additional setup is required.

### Manual Database Setup
Run the SQL script to add required fields:

```bash
# Execute the SQL script in your Supabase dashboard
# File: add-location-fields-to-customers.sql
```

### Testing
1. Connect WhatsApp to the application
2. Send a location message to the connected number
3. Check the customers table for updates
4. Verify location data appears in the mobile app

## Error Handling

The system includes comprehensive error handling:

- **Database Errors**: Logged and handled gracefully
- **Invalid Location Data**: Validates coordinates before saving
- **Missing Contact Info**: Uses fallback values for unknown contacts
- **Connection Issues**: Continues processing other messages if one fails

## Logging

The system provides detailed logging for debugging:

```
📍 Direct location received for user userId: {
  latitude: 32.0853,
  longitude: 34.7818,
  name: "Tel Aviv",
  address: "Tel Aviv, Israel"
}
📞 Processing location for contact: John Doe (972501234567)
🔄 Updating existing customer: John Doe
✅ Successfully updated customer location: John Doe
```

## Security Considerations

- **User Isolation**: Location data is only accessible to the user who received it
- **Data Validation**: Coordinates are validated before storage
- **Privacy**: Contact information is processed securely

## Future Enhancements

Potential improvements for the location listener:

1. **Reverse Geocoding**: Convert coordinates to readable addresses
2. **Distance Calculations**: Calculate distances between customers
3. **Location Analytics**: Track location sharing patterns
4. **Map Integration**: Display customer locations on maps
5. **Location History**: Track multiple locations per customer

## Troubleshooting

### Common Issues

1. **Location not detected**: Ensure the message contains actual location data
2. **Customer not created**: Check phone number format and database permissions
3. **Coordinates not saved**: Verify database schema changes are applied
4. **Phone number mismatch**: Verify phone number conversion is working correctly
5. **Customer not found**: Check if phone numbers are in the expected format

### Debug Steps

1. Check server logs for location processing messages
2. Verify WhatsApp connection status
3. Test with a simple location message
4. Check database for new fields and data

## Support

For issues or questions about the location message listener:

1. Check the server logs for error messages
2. Verify the database schema is correctly updated
3. Test the WhatsApp connection
4. Review the implementation in `server-supabase.js`
