# BuilderTrend Shift Import Feature

## Overview

This feature allows office managers and admins to automatically import and process shift data from BuilderTrend Time Clock Reports. The system intelligently matches shifts with jobs from the performance spreadsheet using fuzzy matching algorithms.

## 🎯 Features

### 1. **Automatic Job Matching**
- Uses fuzzy matching to find the best job match for each shift
- Calculates confidence scores (0-100%)
- Flags shifts that need human review (< 95% confidence)

### 2. **Smart Time Conversion**
- Regular Time (HH:MM) → Decimal hours
- Overtime (HH:MM) → Decimal hours × 1.5
- Double Overtime (HH:MM) → Decimal hours × 2
- PTO (HH:MM) → Decimal hours (no multiplier)

### 3. **QC Tag Detection**
- Automatically detects "QC" tags in shifts
- Tags are preserved and displayed in the processed shifts table

### 4. **Match Status Indicators**
- **Matched** (Green): 95%+ confidence - Ready to go
- **Needs Review** (Orange): 60-94% confidence - Human verification recommended
- **No Match** (Red): <60% confidence - No suitable job found

## 📋 Workflow

### Step 1: Trigger Job Sync
1. Go to **Performance** page
2. Select a **Branch** (e.g., Orange County)
3. Select a **Status** (e.g., Uploading Shifts)
4. Click **"Trigger Jobs Sync"**
5. Wait 3 seconds for Make.com to fetch and send jobs

### Step 2: Upload BuilderTrend Excel
1. Once jobs are displayed, click **"Select Excel File"**
2. Choose your BuilderTrend Time Clock Report (`.xlsx`, `.xls`, `.xlsm`)
3. Click **"Process Excel"**
4. System will:
   - Parse all shifts from the Excel
   - Convert time formats to decimal
   - Match each shift to synced jobs
   - Calculate confidence scores
   - Flag shifts needing review

### Step 3: Review Processed Shifts
- View the **Processed Shifts** table
- Check **Match Status** for each shift
- Review shifts with ⚠️ warning icon
- Verify **Matched Job** column for accuracy
- Check **Total Hours** calculations

## 🗂️ Database Structure

### `performance_buildertrend_shifts` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `sync_id` | UUID | Links to performance sync |
| `upload_id` | UUID | Groups shifts from same Excel |
| `excel_row_number` | INTEGER | Original row in Excel |
| `job_name_raw` | VARCHAR | Original job name from BuilderTrend |
| `crew_member_name` | VARCHAR | Employee name |
| `tags` | TEXT | Tags from Excel (e.g., "QC") |
| `regular_hours` | DECIMAL | Regular hours (decimal) |
| `ot_hours` | DECIMAL | OT hours × 1.5 |
| `ot2_hours` | DECIMAL | 2OT hours × 2 |
| `total_hours` | DECIMAL | Sum of all hours |
| `is_qc` | BOOLEAN | TRUE if tags contain "QC" |
| `matched_sync_job_id` | INTEGER | FK to matched job |
| `match_confidence` | DECIMAL | 0-100 confidence score |
| `match_status` | VARCHAR | 'matched', 'needs_review', 'no_match' |
| `needs_human_review` | BOOLEAN | TRUE if confidence < 95% |

## 🔧 Backend Components

### Services
- **`builderTrendParser.service.js`**: Parses Excel files and extracts shifts
- **`makeWebhook.service.js`**: Sends performance job requests to Make.com

### Utilities
- **`timeConverter.js`**: Converts HH:MM to decimal, calculates totals
- **`jobMatcher.js`**: Fuzzy matching algorithm for job names

### Controllers
- **`performance.controller.js`**:
  - `uploadBuilderTrendExcel()`: Process uploaded Excel
  - `getProcessedShifts()`: Retrieve processed shifts by sync_id

### Routes
- `POST /api/performance/upload-buildertrend`: Upload Excel file
- `GET /api/performance/processed-shifts/:sync_id`: Get processed shifts

## 🎨 Frontend Components

### Performance Page (`Performance.tsx`)
- **File Upload Section**: Select and upload Excel
- **Matching Statistics**: Visual stats of matching results
- **Processed Shifts Table**: Display all shifts with match status

### Service (`performanceService.ts`)
- `uploadBuilderTrendExcel()`: Upload Excel to backend
- `getProcessedShifts()`: Fetch processed shifts

## 📊 Matching Algorithm

### Fuzzy Matching Strategy

1. **Normalization**
   - Convert to lowercase
   - Remove extra spaces
   - Remove special characters
   - Remove common non-job words

2. **Scoring Methods**
   - `ratio`: General comparison
   - `partial_ratio`: Partial string matches
   - `token_sort_ratio`: Ignore word order
   - `token_set_ratio`: Detect subsets

3. **Confidence Thresholds**
   - **95-100%**: Auto-matched (Green)
   - **60-94%**: Needs review (Orange)
   - **< 60%**: No match (Red)

## 📝 Excel Format Expected

BuilderTrend Time Clock Report should have these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Date | Shift date | Monday, October 20, 2025 |
| Job | Job name | Paul Taylor - LA |
| Name | Crew member | Jade Fonesca |
| Tags | Tags (comma-separated) | QC, Urgent |
| Regular Time | HH:MM format | 08:00 |
| OT | Overtime HH:MM | 02:15 |
| 2OT | Double OT HH:MM | 00:49 |
| PTO | Paid time off HH:MM | 00:00 |
| Total Work Time | HH:MM | 09:56 |
| Notes | Optional notes | - |

## 🚀 API Endpoints

### Upload BuilderTrend Excel
```http
POST /api/performance/upload-buildertrend
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- file: Excel file (.xlsx, .xls, .xlsm)
- sync_id: UUID of the sync

Response:
{
  "success": true,
  "message": "Excel processed successfully",
  "data": {
    "upload_id": "uuid",
    "sync_id": "uuid",
    "total_shifts": 45,
    "matching_stats": {
      "total": 45,
      "matched": 38,
      "needs_review": 5,
      "no_match": 2,
      "match_rate": "84.44"
    }
  }
}
```

### Get Processed Shifts
```http
GET /api/performance/processed-shifts/:sync_id?aggregated=false
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "sync_id": "uuid",
    "count": 45,
    "shifts": [...],
    "stats": {...}
  }
}
```

## 🔐 Permissions

Only users with these roles can access:
- `admin`
- `office_manager`

## ⚠️ Troubleshooting

### "No jobs found for this sync_id"
- **Cause**: You haven't triggered a sync yet
- **Solution**: First trigger a sync to fetch jobs from the spreadsheet

### "Only Excel files are allowed"
- **Cause**: File format not supported
- **Solution**: Use `.xlsx`, `.xls`, or `.xlsm` files only

### Low match rate
- **Cause**: Job names in BuilderTrend differ significantly from spreadsheet
- **Solution**: Review "Needs Review" shifts manually and verify job names

### Excel parsing error
- **Cause**: Excel format doesn't match expected structure
- **Solution**: Ensure your Excel has the standard BuilderTrend Time Clock Report format

## 📦 Dependencies

### Backend
- `xlsx`: Excel file parsing
- `fuzzball`: Fuzzy string matching
- `multer`: File upload handling

### Frontend
- `@mui/material`: UI components
- `notistack`: Toast notifications

## 🎯 Future Enhancements

- [ ] Manual match correction interface
- [ ] Bulk shift approval
- [ ] Export processed shifts to different formats
- [ ] Shift aggregation by crew member + job
- [ ] Historical shift tracking
- [ ] Integration with payroll systems

## 📄 Migration

Run this SQL migration to create the table:
```bash
cd backend
PGPASSWORD=your_password psql -U postgres -d postgres -f src/migrations/create_performance_buildertrend_shifts_table.sql
```

## 👨‍💻 Development

### Testing the Feature

1. **Backend Test**:
```bash
cd backend
npm run dev
```

2. **Frontend Test**:
```bash
cd frontend
npm run dev
```

3. **Upload Test File**:
   - Use a real BuilderTrend Time Clock Report
   - Verify column names match expected format
   - Check that jobs are matched correctly

---

**Author**: BotZilla Development Team  
**Last Updated**: October 21, 2025  
**Version**: 1.0.0

