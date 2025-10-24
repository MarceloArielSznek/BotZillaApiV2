# Performance Persistence Migration Guide

## Overview
This migration enables permanent storage of Performance shifts and job data, transitioning from temporary storage to the main `shift` and `job` tables.

## Changes Summary

### 1. Database Schema Changes

#### **Shift Table (`botzilla.shift`)**
- ✅ Added `employee_id` column (references `employee.id`)
- ✅ Made `crew_member_id` nullable
- ✅ Added constraint: at least one of `crew_member_id` or `employee_id` must be present
- ✅ Added index on `employee_id`

**Why?**
- Crew members from Performance are in `employee` table, not `crew_member` table
- `crew_member` table only contains approved crew leaders
- This allows shifts to be associated with any employee

#### **Job Table (`botzilla.job`)**
- ✅ Added `sold_price` column (DECIMAL 10,2)
- ✅ Added comment to `closing_date` (already existed)
- ✅ Added index on `sold_price`

**Why?**
- Performance jobs are closed jobs with final pricing
- `sold_price` stores the actual revenue from the job
- Enables profit/loss calculations and performance metrics

### 2. Model Updates

#### **`backend/src/models/Shift.js`**
- Added `employee_id` field
- Made `crew_member_id` nullable
- Added validation: `hasPersonId()` ensures at least one ID is present

#### **`backend/src/models/Job.js`**
- Added `sold_price` field
- Updated `closing_date` comment

## Migration Files

### 1. `add_employee_id_to_shift.sql`
Adds `employee_id` support to shift table.

### 2. `add_sold_price_to_job.sql`
Adds `sold_price` to job table.

## Execution Instructions

### Development Environment

```bash
# 1. Connect to your development database
psql -U your_user -d botzilla_dev

# 2. Run migrations in order
\i backend/src/migrations/add_employee_id_to_shift.sql
\i backend/src/migrations/add_sold_price_to_job.sql

# 3. Verify changes
\d botzilla.shift
\d botzilla.job
```

### Production Environment

```bash
# 1. Backup database first!
pg_dump -U your_user botzilla_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Connect to production database
psql -U your_user -d botzilla_prod

# 3. Run migrations in transaction (already wrapped in BEGIN/COMMIT)
\i backend/src/migrations/add_employee_id_to_shift.sql
\i backend/src/migrations/add_sold_price_to_job.sql

# 4. Verify changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
  AND table_name = 'shift' 
  AND column_name IN ('crew_member_id', 'employee_id');

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
  AND table_name = 'job' 
  AND column_name = 'sold_price';
```

## Rollback Instructions

If you need to rollback, the SQL is included at the bottom of each migration file.

### Rollback Shift Changes
```sql
BEGIN;
ALTER TABLE botzilla.shift DROP CONSTRAINT check_shift_has_person;
ALTER TABLE botzilla.shift DROP CONSTRAINT fk_shift_employee;
ALTER TABLE botzilla.shift DROP COLUMN employee_id;
ALTER TABLE botzilla.shift ALTER COLUMN crew_member_id SET NOT NULL;
COMMIT;
```

### Rollback Job Changes
```sql
BEGIN;
DROP INDEX botzilla.idx_job_sold_price;
ALTER TABLE botzilla.job DROP COLUMN sold_price;
COMMIT;
```

## Data Flow

### Before (Temporary Storage)
```
Performance Upload
    ↓
BuilderTrendShift (temporary)
    ↓
PerformanceSyncJob (temporary)
    ↓
Send to Spreadsheet
    ↓
❌ Data lost after sync
```

### After (Permanent Storage)
```
Performance Upload
    ↓
BuilderTrendShift (temporary - for matching)
    ↓
PerformanceSyncJob (temporary - for matching)
    ↓
Confirm Matches
    ↓
✅ Save to Job (with sold_price, closing_date)
✅ Save to Shift (with employee_id)
    ↓
✅ Data persisted permanently
✅ Available for performance calculations
✅ Visible in Jobs List and Shift Approval
```

## Next Steps

After running these migrations, the next phase is to:

1. **Create service to save Performance data permanently**
   - Match or create Jobs in `job` table
   - Save shifts to `shift` table with `employee_id`
   - Handle employee matching/creation

2. **Update Performance controller**
   - Add endpoint to save confirmed matches permanently
   - Implement job matching logic
   - Handle employee lookup by name

3. **Update frontend**
   - Add "Save Permanently" button
   - Show confirmation of saved data
   - Link to Jobs List to view saved jobs

## Testing Checklist

- [ ] Migrations run successfully in development
- [ ] Can create shifts with `employee_id` only
- [ ] Can create shifts with `crew_member_id` only (backward compatibility)
- [ ] Cannot create shifts without either ID (constraint works)
- [ ] Can update jobs with `sold_price`
- [ ] Existing shifts still work (backward compatibility)
- [ ] Foreign key constraints work correctly
- [ ] Indexes are created and improve query performance

## Notes

- **Backward Compatible**: Existing shifts with `crew_member_id` continue to work
- **Flexible**: New shifts can use either `crew_member_id` or `employee_id`
- **Safe**: Constraints ensure data integrity
- **Performant**: Indexes added for common queries

