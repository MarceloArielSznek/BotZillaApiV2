# Performance Feature - Documentation

## Overview

The Performance feature allows administrators to trigger a webhook that fetches jobs in "uploading shifts" status from the performance spreadsheet for a selected branch. This feature integrates with Make.com to automate the process of retrieving job data.

## Features

- **Branch Selection**: Select any branch (excluding Corporate) to fetch jobs from
- **Branch Name Mapping**: Automatically maps database branch names to spreadsheet tab names (e.g., "Orange County" → "Orange")
- **Webhook Integration**: Triggers a Make.com scenario to retrieve jobs
- **Status Filtering**: Filter jobs by status (Done, Uploading Shifts, Missing Data to Close)
- **User-Friendly UI**: Clean interface with status feedback and instructions

## Setup

### Backend Configuration

Add the following environment variable to your `.env` file:

```bash
# Make.com Performance Webhook URL
MAKE_PERFORMANCE_WEBHOOK_URL=https://hook.us1.make.com/your-webhook-id
```

### Make.com Webhook Configuration

The webhook will receive the following payload:

```json
{
  "event": "performance_jobs_request",
  "timestamp": "2025-10-20T21:00:00.000Z",
  "branch_id": 5,
  "branch_name": "Orange",
  "status": "Uploading Shifts",
  "status_column_name": "Status",
  "status_column_index": 2,
  "status_column_letter": "C",
  "environment": "production"
}
```

**Important**: The `branch_name` field will contain the **spreadsheet tab name** (not the database name). The mapping is:

| Database Name | Spreadsheet Tab |
|--------------|-----------------|
| Orange County | Orange |
| San Diego | San Diego |
| Los Angeles | Los Angeles |
| San Bernardino | San Bernardino |
| Kent -WA | Kent |
| Everett -WA | Everett |

**Available Statuses**:
- `Done`
- `Uploading Shifts`
- `Missing Data to Close`
- `In Payload` (for jobs that have been sent to the payload/processing)

#### Expected Make.com Flow:

1. **Receive Webhook**: Catch webhook with the branch information
2. **Google Sheets Connection**: Connect to the performance spreadsheet
3. **Filter by Branch**: Locate the tab/sheet matching `branch_name` (e.g., "Orange")
4. **Filter by Status**: In the column named `status_column` (e.g., "Status"), get all rows where value equals the provided `status` (e.g., "Uploading Shifts")
5. **Extract Job Data**: Retrieve job names and relevant data from matching rows
6. **Return Response**: Send back the list of jobs (optional, for confirmation)

#### Make.com Google Sheets Configuration:

In the Google Sheets "Search Rows" module:
- **Spreadsheet**: Select your Performance Tracking Sheet
- **Sheet Name**: Map to `{{2.branch_name}}` (from webhook)
- **Filter**: Add condition where column `{{2.status_column_letter}}` (will be "C") equals `{{2.status}}`
  - Or use column index: `{{2.status_column_index}}` (will be 2)
- **Column Range**: A-DZ (or your specific range)

**Column Position Information**:
- `status_column_name`: "Status" (human-readable name)
- `status_column_index`: 2 (0-based index, useful for arrays)
- `status_column_letter`: "C" (letter notation, useful for Google Sheets filters)

### Example Make.com Response (Optional)

You can optionally return data from Make.com:

```json
{
  "success": true,
  "jobs_found": 15,
  "jobs": [
    {
      "job_name": "Project Alpha",
      "status": "uploading shifts",
      "crew_leader": "John Doe"
    }
  ]
}
```

## API Endpoints

### 1. Trigger Jobs Sync

**POST** `/api/performance/trigger-sync`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "branch_id": 5,
  "status": "Uploading Shifts"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Jobs sync triggered successfully for branch: Orange County (Orange) with status: Uploading Shifts",
  "data": {
    "branch": {
      "id": 5,
      "name_db": "Orange County",
      "name_spreadsheet": "Orange"
    },
    "status": "Uploading Shifts",
    "webhook_response": {
      // Response from Make.com (if any)
    }
  }
}
```

### 2. Get Branches

**GET** `/api/performance/branches`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "San Diego",
      "address": "123 Main St"
    },
    {
      "id": 2,
      "name": "Orange County",
      "address": "456 Oak Ave"
    }
  ]
}
```

## Frontend Usage

### Accessing the Feature

1. Navigate to **Dashboard → Performance** in the sidebar
2. Select a branch from the first dropdown
3. Select a status from the second dropdown (Done, Uploading Shifts, or Missing Data to Close)
4. Click "Trigger Jobs Sync"
5. Wait for confirmation message

### User Permissions

Only users with the following roles can access this feature:
- **Admin**
- **Office Manager**

## Files Created/Modified

### Backend
- ✅ `backend/src/services/makeWebhook.service.js` - Added `sendPerformanceJobsRequest()` method
- ✅ `backend/src/controllers/performance.controller.js` - New controller
- ✅ `backend/src/routes/performance.routes.js` - New routes
- ✅ `backend/src/app.js` - Added performance routes

### Frontend
- ✅ `frontend/src/services/performanceService.ts` - New service
- ✅ `frontend/src/pages/Performance.tsx` - New page
- ✅ `frontend/src/App.tsx` - Added route
- ✅ `frontend/src/layouts/DashboardLayout.tsx` - Added sidebar item

## Next Steps

After the jobs are fetched, you can:

1. Import shift data from another spreadsheet
2. Automatically populate shifts for the retrieved jobs
3. Process and store the data in BotZilla database

## Testing

### Manual Testing Steps

1. **Configure Environment**:
   - Set `MAKE_PERFORMANCE_WEBHOOK_URL` in `.env`
   - Restart backend server

2. **Test Backend**:
   ```bash
   curl -X POST http://localhost:3000/api/performance/trigger-sync \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"branch_id": 5, "status": "Uploading Shifts"}'
   ```

3. **Test Frontend**:
   - Login as admin or office manager
   - Navigate to Performance page
   - Select a branch (e.g., "Orange County")
   - Select a status (e.g., "Uploading Shifts")
   - Click "Trigger Jobs Sync"
   - Verify success message appears with mapped branch name

## Troubleshooting

### Webhook Not Configured
**Error**: "Make.com webhook is not configured"
**Solution**: Add `MAKE_PERFORMANCE_WEBHOOK_URL` to your `.env` file

### Branch Not Found
**Error**: "Branch not found"
**Solution**: Verify the branch_id exists in the database

### Status Required
**Error**: "Status is required"
**Solution**: Ensure you're sending a valid status in the request body

### Invalid Status
**Error**: "Status must be one of: Done, Uploading Shifts, Missing Data to Close"
**Solution**: Use one of the valid status values

### Webhook Timeout
**Error**: "Failed to trigger jobs sync"
**Solution**: Check Make.com scenario is active and the webhook URL is correct

### Permission Denied
**Error**: 403 Forbidden
**Solution**: Ensure user has 'admin' or 'office_manager' role

## Support

For any issues or questions, contact the development team.

---

**Last Updated**: October 20, 2025
**Version**: 1.0.0

