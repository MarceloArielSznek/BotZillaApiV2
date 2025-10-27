# 🚀 Production Deployment Guide: Overrun Reports System

**Date**: October 27, 2025  
**Version**: 1.0  
**Estimated Time**: 10 minutes

---

## 📋 Pre-Deployment Checklist

- [ ] Backend code pushed to `master` branch
- [ ] Frontend code pushed to `master` branch
- [ ] Migration script reviewed: `PRODUCTION_MIGRATION_OVERRUN_REPORTS.sql`
- [ ] Make.com webhook URL ready
- [ ] Database backup completed
- [ ] PM2 restart planned

---

## 🗄️ Step 1: Database Migration

### 1.1 Connect to Production Database

```bash
ssh marcelo@vps-4889463-x
psql -U your_db_user -d botzilla_db
```

### 1.2 Run Migration Script

```bash
# Navigate to project directory
cd ~/apps/BotZillaApiV2

# Pull latest code
git pull origin master

# Run migration
psql -U your_db_user -d botzilla_db -f PRODUCTION_MIGRATION_OVERRUN_REPORTS.sql
```

### 1.3 Expected Output

You should see:
```
✅ Table botzilla.overrun_report exists
✅ Column job.overrun_report_id exists
✅ Foreign key constraint fk_job_overrun_report exists
✅ Index idx_job_overrun_report_id exists

 table_name     | total_reports | jobs_with_reports
----------------+---------------+-------------------
 overrun_report |             0 |                 0

╔══════════════════════════════════════════════════════════════╗
║        ✅ OVERRUN REPORTS MIGRATION COMPLETED ✅             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## ⚙️ Step 2: Backend Configuration

### 2.1 Add Environment Variable

Edit `backend/.env`:

```bash
cd ~/apps/BotZillaApiV2/backend
nano .env
```

Add this line:
```env
MAKE_OVERRUN_ALERT_WEBHOOK_URL=https://hook.us2.make.com/26g3lj3kncpvigztawncdh9pl82n00l3
```

Save and exit (`Ctrl + X`, `Y`, `Enter`).

### 2.2 Verify Environment Variable

```bash
grep MAKE_OVERRUN_ALERT_WEBHOOK_URL .env
```

Expected output:
```
MAKE_OVERRUN_ALERT_WEBHOOK_URL=https://hook.us2.make.com/26g3lj3kncpvigztawncdh9pl82n00l3
```

---

## 🔄 Step 3: Restart Services

### 3.1 Restart Backend (PM2)

```bash
cd ~/apps/BotZillaApiV2
pm2 restart botzilla-api
pm2 logs botzilla-api --lines 50
```

Look for:
```
✅ Server running on port 5000
✅ Database connected
```

### 3.2 Rebuild Frontend (if needed)

```bash
cd ~/apps/BotZillaApiV2/frontend
npm run build
```

---

## 🧪 Step 4: Testing

### 4.1 Backend Health Check

```bash
curl https://yallaprojects.com/api/health
```

Expected:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T..."
}
```

### 4.2 Test Overrun Jobs Endpoint

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://yallaprojects.com/api/jobs/overrun/list?page=1&limit=10
```

Should return overrun jobs with `overrun_report_id` field.

### 4.3 Frontend Testing

1. **Login**: Go to `https://yallaprojects.com`
2. **Navigate**: Jobs → Overrun Jobs tab
3. **Verify Columns**:
   - ✅ Report column visible
   - ✅ Action column with Send icon
4. **Test Send Alert**:
   - Click Send icon on an overrun job
   - Should show success message
   - Button should become disabled
5. **Test View Report** (after Make.com responds):
   - Green document icon should appear
   - Click icon → Modal with report should open

---

## 📊 Step 5: Make.com Configuration

### 5.1 Webhook Setup (Already Done)

Make.com webhook URL:
```
https://hook.us2.make.com/26g3lj3kncpvigztawncdh9pl82n00l3
```

### 5.2 Expected Payload from Backend

```json
{
  "job_id": 964,
  "branch": "Orange County",
  "job_name": "Lorie Scholten - LAK",
  "estimator": "Vincent Lee",
  "crew_leader": "Jesus Rosas",
  "finish_date": "10/24/2025",
  "at_estimated_hours": 43.94,
  "cl_estimated_hours": 0.00,
  "total_hours_worked": 51.28,
  "hours_saved": -7.34
}
```

### 5.3 Expected Response to Backend

Make.com should send:
```json
{
  "job_id": 964,
  "report_base64": "T3ZlcnJ1biBqb2IgcmVwb3J0Li4u..."
}
```

To:
```
POST https://yallaprojects.com/api/jobs/overrun/save-report
Headers:
  x-api-key: <YOUR_API_KEY>
  Content-Type: application/json
```

---

## 🔐 Step 6: API Key for Make.com

### 6.1 Get API Key from Backend `.env`

```bash
grep API_KEY ~/apps/BotZillaApiV2/backend/.env
```

### 6.2 Add to Make.com HTTP Module

In Make.com HTTP Request module:
```
Headers:
  x-api-key: <YOUR_API_KEY_FROM_ENV>
```

---

## 📝 Step 7: Verify Database Changes

### 7.1 Check New Tables

```sql
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
AND table_name = 'overrun_report';
```

Expected:
```
 table_name     | table_schema 
----------------+--------------
 overrun_report | botzilla
```

### 7.2 Check Job Table Modification

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
AND table_name = 'job'
AND column_name = 'overrun_report_id';
```

Expected:
```
 column_name       | data_type | is_nullable 
-------------------+-----------+-------------
 overrun_report_id | integer   | YES
```

### 7.3 Check Foreign Key

```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname = 'fk_job_overrun_report';
```

Expected:
```
 conname               | conrelid       | confrelid           
-----------------------+----------------+---------------------
 fk_job_overrun_report | botzilla.job   | botzilla.overrun_report
```

---

## 🐛 Troubleshooting

### Issue: "MAKE_OVERRUN_ALERT_WEBHOOK_URL is not configured"

**Solution**:
```bash
cd ~/apps/BotZillaApiV2/backend
nano .env
# Add: MAKE_OVERRUN_ALERT_WEBHOOK_URL=https://hook.us2.make.com/26g3lj3kncpvigztawncdh9pl82n00l3
pm2 restart botzilla-api
```

### Issue: "API key authentication failed"

**Solution**:
- Check Make.com HTTP module has correct `x-api-key` header
- Verify API key matches backend `.env` file

### Issue: "Bad control character in string literal in JSON"

**Solution**:
- Make.com must send `report_base64` (Base64 encoded)
- Use `base64()` function in Make.com before sending

### Issue: Dropdown shows empty in Job Edit

**Solution**:
- Already fixed in latest version
- Loads ALL employees (not just active)
- Clear browser cache if issue persists

### Issue: Jobs List table too wide

**Solution**:
- Already fixed with horizontal scroll
- Clear browser cache: `Ctrl + Shift + R`

---

## 📈 Monitoring

### Check PM2 Logs

```bash
pm2 logs botzilla-api --lines 100
```

Look for:
```
✅ Overrun alert sent successfully
✅ Overrun report saved for job_id: 964
```

### Check Database Activity

```sql
-- Count reports created
SELECT COUNT(*) FROM botzilla.overrun_report;

-- Jobs with reports
SELECT COUNT(*) FROM botzilla.job WHERE overrun_report_id IS NOT NULL;

-- Recent reports
SELECT id, LEFT(report, 100) as report_preview, created_at 
FROM botzilla.overrun_report 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## ⏪ Rollback Procedure (Emergency Only)

### If Issues Occur

```sql
-- CAUTION: This deletes all overrun reports!

BEGIN;

ALTER TABLE botzilla.job DROP CONSTRAINT IF EXISTS fk_job_overrun_report;
DROP INDEX IF EXISTS botzilla.idx_job_overrun_report_id;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS overrun_report_id;
DROP TABLE IF EXISTS botzilla.overrun_report CASCADE;

COMMIT;
```

Then:
```bash
git revert HEAD
pm2 restart botzilla-api
```

---

## ✅ Post-Deployment Verification

- [ ] Migration completed without errors
- [ ] Backend restarted successfully
- [ ] Environment variable set
- [ ] Frontend displays Overrun Jobs tab
- [ ] "Send Alert" button works
- [ ] Make.com receives webhook
- [ ] "View Report" modal opens correctly
- [ ] Database has new table and column
- [ ] No errors in PM2 logs

---

## 📞 Support

If issues persist:
1. Check PM2 logs: `pm2 logs botzilla-api`
2. Check database logs
3. Verify Make.com scenario is active
4. Check browser console for frontend errors

---

**Deployment completed by**: _________________  
**Date**: _________________  
**Verification**: _________________

