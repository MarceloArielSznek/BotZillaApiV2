# 🚫 Registration Alert Anti-Spam Implementation

**Date**: October 28, 2025  
**Issue**: Registration alerts (Make.com webhooks) are being sent on every sync (hourly), causing spam to crew leaders who haven't registered yet.

---

## ✅ SOLUTION: Add `registration_alert_sent` Flag

### Changes Made:

1. **✅ Database Migration**: `add_registration_alert_sent_to_job.sql`
   - Adds `registration_alert_sent BOOLEAN DEFAULT false` to `job` table
   - Creates index for performance
   
2. **✅ Model Update**: `backend/src/models/Job.js`
   - Added `registration_alert_sent` field definition

3. **🔄 IN PROGRESS**: `backend/src/controllers/jobSync.controller.js`
   - Need to modify ALL webhook sending logic to check `registration_alert_sent` first
   - Mark as `true` after sending
   - Reset to `false` when:
     - CL changes (`crew_leader_id` changes)
     - Job returns to "Requires Crew Lead"
     - CL completes registration (gets `telegram_id` or becomes `active`)

---

## 📝 Required Code Changes in `jobSync.controller.js`

### Pattern to Apply (everywhere webhooks are sent):

**BEFORE** (current code):
```javascript
if (!crewLeader.telegram_id) {
    await makeWebhookService.sendCrewLeaderRegistrationAlert({...});
}
```

**AFTER** (new code):
```javascript
if (!crewLeader.telegram_id && !existingJob.registration_alert_sent) {
    await makeWebhookService.sendCrewLeaderRegistrationAlert({...});
    
    // Mark as sent to prevent spam
    await Job.update(
        { registration_alert_sent: true },
        { where: { id: existingJob.id } }
    );
    logger.info(`✅ Registration alert sent (1x) for job: ${atJob.name}`);
} else if (!crewLeader.telegram_id) {
    logger.info(`ℹ️  CL "${getCrewLeaderName(crewLeader)}" - alert already sent, skipping`);
}
```

---

## 🎯 Locations to Modify (7 places total):

### 1. ESCENARIO 1 - No Telegram
**Line**: ~544-557  
**Condition**: `if (!crewLeader.telegram_id)`

### 2. ESCENARIO 1 - Not Approved
**Line**: ~558-572  
**Condition**: `else if (crewLeader.status !== 'active')`

### 3. ESCENARIO 1 - Not in Database
**Line**: ~573-589  
**Condition**: `else if (crewLeaderFromAT)`

### 4. RECORDATORIO CONTINUO - No Telegram
**Line**: ~592-605  
**Condition**: `if (!statusChanged && crewLeader && !crewLeader.telegram_id && newStatusName === 'Plans In Progress')`

### 5. RECORDATORIO CONTINUO - Not Approved
**Line**: ~607-621  
**Condition**: `if (!statusChanged && crewLeader && crewLeader.telegram_id && crewLeader.status !== 'active' && newStatusName === 'Plans In Progress')`

### 6. RECORDATORIO CONTINUO - Not in DB
**Line**: ~623-638  
**Condition**: `if (!statusChanged && !crewLeader && crewLeaderFromAT && newStatusName === 'Plans In Progress')`

### 7. ESCENARIO 2 - All cases (No Telegram, Not Approved, Not in DB)
**Line**: ~647-710

---

## 🔄 Reset Logic (Already Implemented):

The following resets are **already in place**:

1. **Job returns to "Requires Crew Lead"** (Line ~488-498):
   ```javascript
   registration_alert_sent: false
   ```

2. **Crew Leader changed** (Line ~504-519):
   ```javascript
   registration_alert_sent: false
   ```

3. **Cleanup inconsistencies** (Line ~521-532):
   - Already handled by reset logic

---

## 🎯 Detection of CL Registration Completion:

**New Logic Needed**: When a CL completes registration (gets `telegram_id` or becomes `active`), reset the flag so they can receive Telegram notification:

```javascript
// Detectar si el CL completó el registro
const clCompletedRegistration = crewLeader && 
    ((crewLeader.telegram_id && !existingJobCrewLeader?.telegram_id) || 
     (crewLeader.status === 'active' && existingJobCrewLeader?.status !== 'active'));

if (clCompletedRegistration && existingJob.registration_alert_sent) {
    logger.info(`🎉 CL "${getCrewLeaderName(crewLeader)}" completed registration! Resetting alert flag...`);
    await Job.update(
        { registration_alert_sent: false },
        { where: { id: existingJob.id } }
    );
    existingJob.registration_alert_sent = false;
}
```

**Note**: This requires fetching the crew leader data from the **previous sync** to compare. This can be stored in `existingJob` before updating.

---

## ✅ Expected Behavior After Implementation:

### Before Fix:
- ❌ Alert sent on **every sync** (hourly)
- ❌ CL receives **multiple duplicate alerts**
- ❌ Spam to Make.com webhook

### After Fix:
- ✅ Alert sent **once only** when problem first detected
- ✅ Alert **not repeated** on subsequent syncs
- ✅ Alert **resets** when:
  - CL changes (new CL assigned)
  - Job returns to "Requires Crew Lead"
  - CL completes registration

---

## 🧪 Testing Plan:

1. **Test 1: New job with CL without telegram**
   - Expected: Alert sent **once**
   - Run sync again → Expected: No alert (already sent)

2. **Test 2: CL changes**
   - Expected: `registration_alert_sent` resets to `false`
   - New CL without telegram → Expected: Alert sent **once**

3. **Test 3: CL completes registration**
   - Expected: `registration_alert_sent` resets to `false`
   - Expected: Telegram notification sent (not webhook)

4. **Test 4: Job returns to "Requires Crew Lead"**
   - Expected: `registration_alert_sent` resets to `false`
   - Job goes back to "Plans In Progress" with new CL → Expected: Alert sent if needed

---

## 📊 Database Query to Monitor:

```sql
SELECT 
    j.id,
    j.name,
    js.name AS status,
    e.first_name || ' ' || e.last_name AS crew_leader,
    e.telegram_id,
    e.status AS cl_status,
    j.registration_alert_sent,
    j.last_synced_at
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.employee e ON j.crew_leader_id = e.id
WHERE js.name = 'Plans In Progress'
  AND (e.telegram_id IS NULL OR e.status != 'active')
ORDER BY j.registration_alert_sent, j.last_synced_at DESC;
```

This shows all jobs in "Plans In Progress" with unregistered/unapproved CLs, sorted by alert status.

---

##  Deployment Steps:

1. ✅ Run migration: `add_registration_alert_sent_to_job.sql`
2. ✅ Update Job model
3. 🔄 Modify `jobSync.controller.js` (all 7 locations)
4. ✅ Test in dev
5. ✅ Deploy to production
6. ✅ Monitor logs for `"Registration alert sent (1x)"` and `"alert already sent, skipping"`

---

**Status**: Migration and model ready. Controller changes IN PROGRESS.

