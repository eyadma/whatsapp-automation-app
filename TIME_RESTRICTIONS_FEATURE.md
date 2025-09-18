# Time Restrictions Feature

## Overview

The Time Restrictions feature allows users to send messages during business hours (09:00 AM - 12:30 PM Israel time). After 12:30 PM, users can only send messages if they have used the messaging feature at least once during the allowed hours (09:00-12:30) on the same day.

## Features

- **Allowed time window**: Users can send messages between 09:00 AM and 12:30 PM Israel time
- **Usage tracking**: Tracks when users send messages during allowed hours
- **Daily reset**: Usage tracking resets daily - users must send at least one message during allowed hours each day
- **User-specific settings**: Each user can have different restriction settings
- **Admin controls**: Full management through the UserManagement screen
- **Real-time validation**: Checks restrictions before every message send attempt

## Database Schema

### New Columns in `profiles` Table

```sql
-- Time restriction fields
time_restriction_enabled BOOLEAN DEFAULT FALSE
time_restriction_start TIME DEFAULT '09:00:00'
time_restriction_end TIME DEFAULT '12:30:00'
time_restriction_timezone TEXT DEFAULT 'Asia/Jerusalem'
last_message_sent_during_window TIMESTAMPTZ DEFAULT NULL
daily_usage_tracked DATE DEFAULT NULL
```

### Database Functions

1. **`is_within_allowed_hours(user_id UUID)`**
   - Checks if current time is within user's allowed hours (09:00-12:30)
   - Returns `TRUE` if user is in allowed time period

2. **`has_used_messaging_today(user_id UUID)`**
   - Checks if user has used messaging during allowed hours today
   - Returns `TRUE` if user has sent at least one message during allowed hours today

3. **`track_message_usage(user_id UUID)`**
   - Tracks that user has sent a message during allowed hours
   - Updates `last_message_sent_during_window` and `daily_usage_tracked`
   - Returns `TRUE` if successful

4. **`can_send_messages(user_id UUID)`**
   - Main function to check if user can send messages
   - Allows sending during 09:00-12:30 OR if user has used messaging today
   - Returns `TRUE` if user can send messages

## API Endpoints

### 1. Get Time Restrictions
```
GET /api/time-restrictions/:userId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "time_restriction_enabled": true,
    "time_restriction_start": "09:00",
    "time_restriction_end": "12:30",
    "time_restriction_timezone": "Asia/Jerusalem",
    "canSendMessages": false,
    "currentTime": "10:15:00",
    "hasValidOverride": false,
    "last_override_used": null,
    "override_expires_at": null
  }
}
```

### 2. Update Time Restrictions
```
PUT /api/time-restrictions/:userId
```

**Request Body:**
```json
{
  "time_restriction_enabled": true,
  "time_restriction_start": "09:00",
  "time_restriction_end": "12:30",
  "time_restriction_timezone": "Asia/Jerusalem"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated profile data */ },
  "message": "Time restrictions updated successfully"
}
```

### 3. Grant Override
```
POST /api/time-restrictions/:userId/override
```

**Request Body:**
```json
{
  "duration_hours": 24
}
```

**Response:**
```json
{
  "success": true,
  "message": "Override granted for 24 hours",
  "data": {
    "overrideExpiresAt": "2024-01-02T10:15:00Z",
    "lastOverrideUsed": "2024-01-01T10:15:00Z",
    "durationHours": 24
  }
}
```

## Message Sending Integration

The time restriction check is integrated into both message sending endpoints:

- `/api/messages/send` - Bulk message sending
- `/api/messages/send-single` - Single message sending

### Error Response (403 Forbidden)
```json
{
  "success": false,
  "error": "Message sending is restricted during business hours",
  "details": {
    "restrictedHours": "09:00 - 12:30",
    "currentTime": "10:15:00",
    "timezone": "Asia/Jerusalem",
    "overrideExpires": null,
    "message": "You can send messages again after the restricted hours, or use an override if available."
  }
}
```

## Mobile App Integration

### UserManagement Screen Updates

The UserManagement screen now includes:

1. **Time Restrictions Button**: Opens modal to configure time restrictions
2. **Grant Override Button**: Allows admins to grant overrides with duration options
3. **Time Restriction Modal**: Full configuration interface

### Modal Features

- Toggle to enable/disable time restrictions
- Time picker for start and end times
- Timezone selection
- Help text explaining the feature
- Save/Cancel actions

## Setup Instructions

### 1. Database Setup

Run the SQL script to add the required schema:

```bash
# Execute the SQL script in your Supabase dashboard
psql -h your-db-host -U postgres -d your-db-name -f add-time-restrictions.sql
```

### 2. Server Setup

The server code is already updated with:
- Time restriction checks in message endpoints
- New API endpoints for time restriction management
- Proper error handling and responses

### 3. Mobile App Setup

The mobile app UserManagement screen is updated with:
- Time restriction management UI
- Override granting functionality
- Integration with the new API endpoints

### 4. Testing

Run the test script to verify everything is working:

```bash
node test-time-restrictions.js
```

## Usage Examples

### Enable Time Restrictions for a User

1. Open UserManagement screen
2. Find the user you want to restrict
3. Click "Time Restrictions" button
4. Toggle "Enable Time Restrictions" to ON
5. Set start time: 09:00
6. Set end time: 12:30
7. Set timezone: Asia/Jerusalem
8. Click "Update Restrictions"

### Grant Override to User

1. Open UserManagement screen
2. Find the user who needs an override
3. Click "Grant Override" button
4. Choose duration: 1 Hour, 24 Hours, or 7 Days
5. Override is granted immediately

### Test Message Sending

1. Try sending messages during restricted hours (09:00-12:30 Israel time)
2. Should receive 403 error with restriction details
3. Grant override and try again
4. Should work during override period

## Timezone Handling

The system uses Israel timezone (`Asia/Jerusalem`) by default, which automatically handles:
- Daylight Saving Time (DST) transitions
- Standard time vs. summer time
- Accurate time comparisons

## Security Considerations

- Only admins can modify time restrictions
- Override grants are logged with timestamps
- Time restrictions are enforced at the API level
- No client-side bypassing possible

## Troubleshooting

### Common Issues

1. **"Failed to check time restrictions" error**
   - Ensure database functions are created
   - Check Supabase connection

2. **Time restrictions not working**
   - Verify `time_restriction_enabled` is `TRUE`
   - Check timezone settings
   - Ensure server time is correct

3. **Override not working**
   - Check `override_expires_at` timestamp
   - Verify override hasn't expired
   - Check database function `grant_override`

### Debug Steps

1. Check user's restriction settings:
   ```sql
   SELECT * FROM profiles WHERE id = 'user-id';
   ```

2. Test restriction functions:
   ```sql
   SELECT can_send_messages('user-id');
   SELECT is_within_restricted_hours('user-id');
   SELECT has_valid_override('user-id');
   ```

3. Check current time in Israel:
   ```sql
   SELECT NOW() AT TIME ZONE 'Asia/Jerusalem';
   ```

## Future Enhancements

Potential improvements for the feature:

1. **Multiple time windows**: Allow multiple restriction periods per day
2. **Day-specific restrictions**: Different restrictions for weekdays vs. weekends
3. **Automatic overrides**: Grant overrides based on certain conditions
4. **Restriction analytics**: Track restriction violations and override usage
5. **Notification system**: Alert users when restrictions are about to expire
6. **Bulk operations**: Apply restrictions to multiple users at once

## Support

For issues or questions about the time restrictions feature:

1. Check the test script output
2. Review server logs for error messages
3. Verify database schema and functions
4. Test API endpoints directly
5. Check mobile app console for errors
