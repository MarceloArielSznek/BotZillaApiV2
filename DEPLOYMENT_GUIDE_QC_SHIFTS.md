# 🚀 Deployment Guide: QC Shifts & Job Structure Updates

## 📋 Overview

This deployment includes:
- ✅ QC Shift functionality (automatic 3-hour special shifts)
- ✅ New job structure with `sold_price` and `performance_status`
- ✅ Shift table updates with `employee_id` and `performance_status`
- ✅ Foreign key changes (`shift.crew_member_id` now points to `employee`)
- ✅ Dashboard, AI, and Automations controller updates

---

## ⚠️ Pre-Deployment Checklist

- [ ] Backup production database
- [ ] Test migration script in a staging environment (if available)
- [ ] Notify team about maintenance window
- [ ] Verify backend is not running during migration

---

## 🗄️ Step 1: Database Backup

```bash
# SSH into production server
ssh user@your-production-server

# Create backup
pg_dump -U botzilla_user -h localhost -d botzilla_db > /path/to/backups/botzilla_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file exists and has content
ls -lh /path/to/backups/botzilla_backup_*.sql
```

---

## 🔧 Step 2: Stop Backend Service

```bash
# Stop the backend
pm2 stop BotZillaApiV2

# Verify it's stopped
pm2 status
```

---

## 📦 Step 3: Pull Latest Code

```bash
# Navigate to project directory
cd ~/apps/BotZillaApiV2

# Pull latest changes
git pull origin master

# Install any new dependencies
cd backend
npm install

cd ../frontend
npm install
```

---

## 🗃️ Step 4: Run Database Migration

```bash
# Navigate to project root
cd ~/apps/BotZillaApiV2

# Connect to PostgreSQL and run migration
psql -U botzilla_user -d botzilla_db -f PRODUCTION_MIGRATION_QC_SHIFTS.sql

# Expected output:
# NOTICE: Added employee_id column to shift table
# NOTICE: Dropped old shift_crew_member_id_fkey constraint
# NOTICE: Created new shift_crew_member_id_fkey constraint pointing to employee
# NOTICE: Added sold_price column to job table
# NOTICE: Dropped crew_leader_hours column from job table
# NOTICE: Dropped note column from job table
# NOTICE: Added performance_status column to job table
# NOTICE: Added performance_status column to shift table
# NOTICE: Created QC Special Shift
# NOTICE: Verification passed: shift.crew_member_id correctly points to employee
# COMMIT
```

**⚠️ If you see any ERROR messages, STOP and review before proceeding!**

---

## ✅ Step 5: Verify Migration

```bash
# Run verification script
psql -U botzilla_user -d botzilla_db -f VERIFY_MIGRATION.sql

# Review output carefully
# All checks should pass with expected values
```

### Expected Verification Results:

1. **New columns in job table:**
   - `sold_price` (numeric, nullable)
   - `performance_status` (character varying, not null, default: 'synced')

2. **Removed columns:** 
   - `crew_leader_hours` and `note` should NOT exist (count = 0)

3. **New columns in shift table:**
   - `employee_id` (integer, nullable)
   - `performance_status` (character varying, not null, default: 'approved')

4. **Constraints:**
   - `check_job_performance_status` on `job`
   - `check_shift_performance_status` on `shift`

5. **Indexes:**
   - `idx_job_performance_status`
   - `idx_job_branch_performance_status`
   - `idx_shift_performance_status`
   - `idx_shift_job_performance_status`
   - `idx_shift_employee_id`
   - `idx_shift_employee_job`
   - `idx_job_sold_price`

6. **FK constraint:**
   - `shift_crew_member_id_fkey` should reference `employee(id)` (not `crew_member`)

7. **QC Special Shift:**
   - Should exist with `name = 'QC'` and `description = 'Quality Control - 3 hours per shift'`

---

## 🚀 Step 6: Restart Backend

```bash
# Start the backend
pm2 restart BotZillaApiV2

# Check logs for errors
pm2 logs BotZillaApiV2 --lines 50

# Verify it's running
pm2 status
```

---

## 🧪 Step 7: Test Critical Functionality

### Test 1: Dashboard
```bash
curl -X GET "https://your-domain.com/api/dashboard/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** 200 OK with job metrics, crew leader names formatted as "FirstName LastName"

### Test 2: Jobs List
```bash
curl -X GET "https://your-domain.com/api/jobs?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** 200 OK with jobs including `sold_price`, `performance_status`, and `shifts_status`

### Test 3: Performance Flow (if ready)
1. Go to **Jobs → Performance** tab
2. Scan spreadsheet
3. Import Excel with QC tags
4. Verify QC shifts are detected
5. Save jobs
6. Check that QC special shifts appear correctly

---

## 🔥 Step 8: Monitor Logs

```bash
# Monitor logs in real-time
pm2 logs BotZillaApiV2

# Look for:
# - No ERROR messages
# - Successful API requests
# - No database constraint violations
```

---

## 🐛 Troubleshooting

### Issue: Migration fails with FK constraint violation

**Solution:**
```sql
-- Check for invalid crew_member_id values
SELECT DISTINCT crew_member_id 
FROM botzilla.shift 
WHERE crew_member_id NOT IN (SELECT id FROM botzilla.employee);

-- If found, you'll need to manually fix or delete these records
```

### Issue: Backend won't start after migration

**Solution:**
```bash
# Check logs
pm2 logs BotZillaApiV2 --err --lines 100

# Common issues:
# 1. Missing environment variables
# 2. Database connection issues
# 3. Syntax errors in models (check Employee.js, Job.js, Shift.js)
```

### Issue: Dashboard shows errors

**Solution:**
1. Verify `Employee` model is exported in `backend/src/models/index.js`
2. Check all associations are correct:
   - `Job.belongsTo(Employee, { as: 'crewLeader' })`
   - `Shift.belongsTo(Employee, { foreignKey: 'crew_member_id', as: 'crewMember' })`
   - `Shift.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' })`

---

## 🔄 Rollback (Emergency Only)

If critical issues arise and you need to rollback:

```bash
# SSH into production
ssh user@your-production-server

# Stop backend
pm2 stop BotZillaApiV2

# Checkout previous commit
cd ~/apps/BotZillaApiV2
git log --oneline -5  # Find the previous commit hash
git checkout <previous-commit-hash>

# Run rollback SQL (from PRODUCTION_MIGRATION_QC_SHIFTS.sql)
psql -U botzilla_user -d botzilla_db << 'EOF'
BEGIN;

ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS check_shift_performance_status;
DROP INDEX IF EXISTS botzilla.idx_shift_performance_status;
DROP INDEX IF EXISTS botzilla.idx_shift_job_performance_status;
ALTER TABLE botzilla.shift DROP COLUMN IF EXISTS performance_status;

ALTER TABLE botzilla.job DROP CONSTRAINT IF EXISTS check_job_performance_status;
DROP INDEX IF EXISTS botzilla.idx_job_performance_status;
DROP INDEX IF EXISTS botzilla.idx_job_branch_performance_status;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS performance_status;

DROP INDEX IF EXISTS botzilla.idx_job_sold_price;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS sold_price;

ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS shift_crew_member_id_fkey;
ALTER TABLE botzilla.shift
ADD CONSTRAINT shift_crew_member_id_fkey
FOREIGN KEY (crew_member_id) 
REFERENCES botzilla.crew_member(id)
ON DELETE CASCADE;

DROP INDEX IF EXISTS botzilla.idx_shift_employee_job;
DROP INDEX IF EXISTS botzilla.idx_shift_employee_id;
ALTER TABLE botzilla.shift DROP CONSTRAINT IF EXISTS fk_shift_employee;
ALTER TABLE botzilla.shift DROP COLUMN IF EXISTS employee_id;

COMMIT;
EOF

# Restart backend
pm2 restart BotZillaApiV2

# Restore database from backup if needed
# psql -U botzilla_user -d botzilla_db < /path/to/backup.sql
```

---

## ✅ Post-Deployment Checklist

- [ ] Database migration completed successfully
- [ ] Verification script passed all checks
- [ ] Backend restarted without errors
- [ ] Dashboard loads correctly
- [ ] Jobs list shows correct data
- [ ] Performance flow works (if tested)
- [ ] No errors in PM2 logs
- [ ] Team notified of successful deployment

---

## 📞 Support

If issues persist:
1. Check logs: `pm2 logs BotZillaApiV2 --err`
2. Review migration output
3. Check database constraints: `\d botzilla.shift` and `\d botzilla.job`
4. Contact development team with error details

---

## 📝 Notes

- **Downtime:** Approx. 5-10 minutes
- **Database changes:** Idempotent (safe to re-run)
- **Backup retention:** Keep for at least 7 days
- **Testing:** Always test in staging first if possible

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Status:** _______________  
**Notes:** _______________

