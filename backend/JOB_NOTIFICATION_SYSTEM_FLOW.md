# 🔔 Job Notification System - Complete Flow Documentation

**BotZilla API v2**  
**Last Updated**: October 28, 2025  
**System**: Job Status Change Notification & Crew Leader Alert System

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Trigger Mechanism](#trigger-mechanism)
3. [Complete Flow Diagram](#complete-flow-diagram)
4. [Notification Scenarios](#notification-scenarios)
5. [Crew Leader Registration States](#crew-leader-registration-states)
6. [Special Cases](#special-cases)
7. [Database Schema](#database-schema)
8. [Key Algorithms](#key-algorithms)
9. [FAQ](#faq)

---

## System Overview

The Job Notification System automatically monitors job status changes in Attic Tech and notifies the appropriate personnel (Crew Leaders or Operation Managers) based on:

- **Job Status Changes**: Detects when jobs transition between states (e.g., "Requires Crew Lead" → "Plans In Progress")
- **Crew Leader Assignment**: Tracks when crew leaders are assigned or changed
- **Registration Status**: Determines notification type based on crew leader's Telegram registration and approval status

### Key Features:
- ✅ **Daily Automatic Sync** from Attic Tech
- ✅ **Intelligent Change Detection** using `last_known_status_id`
- ✅ **Multiple Notification Channels**: Telegram (direct) or Make.com webhooks (alerts)
- ✅ **Persistent Reminders** for incomplete registrations
- ✅ **Audit Trail** via `job_state_change_log`

---

## Trigger Mechanism

### Daily Cron Job
```
Route: GET /api/job-sync/sync-jobs
Frequency: Once per day (configured in ecosystem.config.js)
Default: Fetch jobs from last 1 day
Optional: ?days_back=7 (fetch from last 7 days)
```

### Manual Sync
Admins can trigger sync manually via:
```bash
POST /api/job-sync/sync-jobs
```

---

## Complete Flow Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                     🔔 JOB NOTIFICATION SYSTEM - COMPLETE FLOW                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: TRIGGER - Daily Cron Job                                                           │
│  Route: GET /api/job-sync/sync-jobs                                                         │
│  Frequency: 1x per day                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: FETCH JOBS FROM ATTIC TECH                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Attic Tech API Response:                                                          │    │
│  │  • job.id, job.name, job.status                                                    │    │
│  │  • job.assignedCrew[] (array of crew members with roles)                           │    │
│  │  • job.job_estimate (customer, salesperson, branch)                                │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: FOR EACH JOB → saveJobsToDb()                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  1. Find existing job in DB by attic_tech_job_id                                   │    │
│  │  2. Find/create JobStatus in our DB                                                │    │
│  │  3. Find Branch in our DB                                                          │    │
│  │  4. Find Crew Leader in our DB (by telegram_id, phone, or name)                    │    │
│  │  5. Extract crew leader from AT (crewLeaderFromAT) if exists in assignedCrew       │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: DETECT JOB STATUS CHANGE                                                           │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Compare:                                                                           │    │
│  │  • oldStatusId = existingJob.last_known_status_id || existingJob.status_id         │    │
│  │  • newStatusId = status.id (from Attic Tech job)                                   │    │
│  │  • statusChanged = (oldStatusId !== newStatusId)                                   │    │
│  │                                                                                     │    │
│  │  Get status names:                                                                 │    │
│  │  • oldStatusName = JobStatus.findByPk(oldStatusId).name                            │    │
│  │  • newStatusName = status.name                                                     │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: RESET LOGIC (Clear old notifications when appropriate)                             │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  CASE A: Job Returns to "Requires Crew Lead"                                      ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: statusChanged && newStatusName === 'Requires Crew Lead'                      ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    • notification_sent = false                                                     ║     │
│  ║    • last_notification_sent_at = null                                              ║     │
│  ║    • crew_leader_id = null (remove previous CL)                                    ║     │
│  ║                                                                                    ║     │
│  ║  REASON: Job needs new crew leader assignment                                      ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  CASE B: Crew Leader Changed (new CL assigned)                                    ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: statusChanged && existingJob.crew_leader_id !== newCrewLeaderId              ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    • notification_sent = false                                                     ║     │
│  ║    • last_notification_sent_at = null                                              ║     │
│  ║                                                                                    ║     │
│  ║  REASON: New CL must receive notification (even if job was notified before)       ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  CASE C: Cleanup Inconsistencies                                                  ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: notification_sent === true && crew_leader_id === null                        ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    • notification_sent = false                                                     ║     │
│  ║    • last_notification_sent_at = null                                              ║     │
│  ║                                                                                    ║     │
│  ║  REASON: Inconsistent data (notified but no CL assigned)                          ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: EVALUATE NOTIFICATION SCENARIOS                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│   SCENARIO 1: New Job Status Change       │   │   SCENARIO 2: Crew Leader Assigned        │
│   From: "Requires Crew Lead"              │   │   to Existing Job                         │
│   To: "Plans In Progress"                 │   │                                           │
├───────────────────────────────────────────┤   ├───────────────────────────────────────────┤
│ IF: statusChanged &&                      │   │ IF: !statusChanged &&                     │
│     oldStatus === "Requires Crew Lead" && │   │     status === "Plans In Progress" &&     │
│     newStatus === "Plans In Progress"     │   │     crewLeaderChanged &&                  │
│                                           │   │     hadNoCrewLeader &&                    │
│ ┌──────────────────────────────────────┐  │   │     nowHasCrewLeader                      │
│ │ Job just received Crew Leader        │  │   │                                           │
│ │ ✅ shouldNotify = true                │  │   │ ┌──────────────────────────────────────┐ │
│ └──────────────────────────────────────┘  │   │ │ Job in "Plans In Progress" without   │ │
│                                           │   │ │ CL now has CL assigned               │ │
│ Next: Evaluate CL registration status    │   │ │ ✅ shouldNotify = true                │ │
│                                           │   │ └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘   │                                           │
                                                │ Next: Evaluate CL registration status    │
                                                └───────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: DETERMINE NOTIFICATION TYPE (Based on Crew Leader Status)                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼──────────────────────┬──────────────────────┐
                    │                     │                      │                      │
                    ▼                     ▼                      ▼                      ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ CASE 1:                 │ │ CASE 2:                 │ │ CASE 3:              │ │ CASE 4:              │
│ CL Active & Telegram ✅ │ │ CL with Telegram but    │ │ CL No Telegram ⚠️    │ │ CL Not in DB ❌      │
├─────────────────────────┤ │ NOT Approved ⚠️         │ ├──────────────────────┤ ├──────────────────────┤
│ crewLeader EXISTS       │ │                         │ │ crewLeader EXISTS    │ │ crewLeader === null  │
│ telegram_id NOT NULL    │ │ crewLeader EXISTS       │ │ telegram_id === null │ │ crewLeaderFromAT     │
│ status === 'active'     │ │ telegram_id NOT NULL    │ │                      │ │ EXISTS (from AT)     │
│                         │ │ status !== 'active'     │ │                      │ │                      │
│ ┌──────────────────┐    │ │                         │ │ ┌─────────────────┐  │ │ ┌─────────────────┐  │
│ │ ACTION:          │    │ │ ┌──────────────────┐    │ │ │ ACTION:         │  │ │ │ ACTION:         │  │
│ │ ✅ Telegram      │    │ │ │ ACTION:          │    │ │ │ 🔔 Make.com     │  │ │ │ 🔔 Make.com     │  │
│ │ Notification     │    │ │ │ 🔔 Make.com      │    │ │ │ Alert           │  │ │ │ Alert           │  │
│ │                  │    │ │ │ Alert            │    │ │ │                 │  │ │ │                 │  │
│ │ • Generate       │    │ │ │                  │    │ │ │ • CL must       │  │ │ │ • CL not in our │  │
│ │   notification   │    │ │ │ • CL registered  │    │ │ │   register in   │  │ │ │   database      │  │
│ │ • Send to        │    │ │ │   but pending    │    │ │ │   BotZilla      │  │ │ │ • Invite to     │  │
│ │   Telegram Bot   │    │ │ │   admin approval │    │ │ │ • Webhook:      │  │ │ │   register      │  │
│ │ • Mark job:      │    │ │ │ • Admin must     │    │ │ │   activeUser:   │  │ │ │ • Webhook:      │  │
│ │   notification_  │    │ │ │   approve        │    │ │ │   false         │  │ │ │   notInDatabase │  │
│ │   sent = true    │    │ │ │ • Webhook:       │    │ │ │   hasTelegramId │  │ │ │   = true        │  │
│ │                  │    │ │ │   activeUser:    │    │ │ │   = false       │  │ │ │   activeUser:   │  │
│ │ 📊 Log in        │    │ │ │   false          │    │ │ │                 │  │ │ │   false         │  │
│ │ job_state_       │    │ │ │   hasTelegramId  │    │ │ │ 🔁 Repeat       │  │ │ │   hasTelegramId │  │
│ │ change_log       │    │ │ │   = true         │    │ │ │ each sync until │  │ │ │   = false       │  │
│ └──────────────────┘    │ │ │                  │    │ │ │ registration    │  │ │ │                 │  │
│                         │ │ │ 🔁 Repeat each   │    │ │ └─────────────────┘  │ │ │ 🔁 Repeat each  │  │
│ ✅ SENT ONCE            │ │ │ sync until       │    │ │                      │ │ │ sync until      │  │
│ (notification_sent)     │ │ │ approval         │    │ │ ❌ notification_sent │ │ │ registration    │  │
│                         │ │ └──────────────────┘    │ │ = false (repeats)    │ │ │                 │  │
│                         │ │                         │ │                      │ │ │ ❌ notification_ │  │
│                         │ │ ❌ notification_sent    │ │                      │ │ │ sent = false    │  │
│                         │ │ = false (repeats)       │ │                      │ │ │ (repeats)       │  │
└─────────────────────────┘ └─────────────────────────┘ └──────────────────────┘ └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: SPECIAL CASES (New jobs without status change detection)                           │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  New Job with status "Requires Crew Lead"                                         ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !existingJob && newStatus === 'Requires Crew Lead'                           ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    🔔 Notify Operation Manager of the branch                                       ║     │
│  ║    • generateOperationManagerNotification()                                        ║     │
│  ║    • Send to Operation Manager's Telegram                                          ║     │
│  ║    • Message: "New job requires crew leader assignment"                            ║     │
│  ║                                                                                    ║     │
│  ║  REASON: New job needs Operation Manager to assign Crew Leader                     ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  New Job with status "Plans In Progress" and Active CL                            ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !existingJob && newStatus === 'Plans In Progress' &&                         ║     │
│  ║      crewLeader && crewLeader.telegram_id && crewLeader.status === 'active'       ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    ✅ Telegram Notification to Crew Leader                                         ║     │
│  ║    • generateNotification()                                                        ║     │
│  ║    • Send to CL's Telegram                                                         ║     │
│  ║    • Mark: notification_sent = true                                                ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  New Job with CL without telegram or not approved                                 ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !existingJob && newStatus === 'Plans In Progress' &&                         ║     │
│  ║      crewLeader && (!crewLeader.telegram_id || crewLeader.status !== 'active')    ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    🔔 Make.com Alert (pending registration or pending approval)                    ║     │
│  ║    • sendCrewLeaderRegistrationAlert()                                             ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 9: CONTINUOUS REMINDERS (every daily sync)                                            │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  Existing Job in "Plans In Progress" with CL without telegram                      ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !statusChanged && crewLeader && !crewLeader.telegram_id &&                   ║     │
│  ║      newStatus === 'Plans In Progress'                                             ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    🔁 Make.com Alert (daily reminder)                                              ║     │
│  ║    • Webhook: activeUser = false, hasTelegramId = false                            ║     │
│  ║    • Sent EVERY SYNC until CL completes registration                               ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  Existing Job with CL registered but not approved                                  ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !statusChanged && crewLeader && crewLeader.telegram_id &&                    ║     │
│  ║      crewLeader.status !== 'active' && newStatus === 'Plans In Progress'          ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    🔁 Make.com Alert (daily reminder to Admin)                                     ║     │
│  ║    • Webhook: activeUser = false, hasTelegramId = true                             ║     │
│  ║    • Sent EVERY SYNC until Admin approves                                          ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
│                                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════════════════╗     │
│  ║  Existing Job with CL from AT not in our DB                                        ║     │
│  ╠═══════════════════════════════════════════════════════════════════════════════════╣     │
│  ║  IF: !statusChanged && !crewLeader && crewLeaderFromAT &&                         ║     │
│  ║      newStatus === 'Plans In Progress'                                             ║     │
│  ║                                                                                    ║     │
│  ║  ACTION:                                                                           ║     │
│  ║    🔁 Make.com Alert (daily reminder)                                              ║     │
│  ║    • Webhook: notInDatabase = true, activeUser = false, hasTelegramId = false      ║     │
│  ║    • Sent EVERY SYNC until CL registers                                            ║     │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 10: UPDATE JOB IN DATABASE                                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Job.create() or Job.update() with:                                                │    │
│  │  • attic_tech_job_id                                                               │    │
│  │  • attic_tech_estimate_id                                                          │    │
│  │  • status_id (new status)                                                          │    │
│  │  • last_known_status_id (previous status, for future change detection)             │    │
│  │  • crew_leader_id (if exists in our DB)                                            │    │
│  │  • branch_id                                                                       │    │
│  │  • estimate_id (if exists in our DB)                                               │    │
│  │  • notification_sent (true if Telegram sent, false if webhook/alert)               │    │
│  │  • last_notification_sent_at (timestamp)                                           │    │
│  │  • last_synced_at (sync timestamp)                                                 │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 11: SEND ACCUMULATED NOTIFICATIONS                                                    │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  For each notification in the `notifications` array:                               │    │
│  │  • POST to Telegram Bot API with formatted message                                 │    │
│  │  • Message includes: job name, customer, address, salesperson, job link            │    │
│  │  • Recipient: telegram_id of Crew Leader or Operation Manager                      │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 12: AUDIT LOG (Optional)                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Create record in job_state_change_log:                                            │    │
│  │  • job_sync_id                                                                     │    │
│  │  • attic_tech_job_id                                                               │    │
│  │  • previous_status_id                                                              │    │
│  │  • new_status_id                                                                   │    │
│  │  • notified_user_type ('crew_leader', 'operation_manager')                         │    │
│  │  • notified_user_id                                                                │    │
│  │  • notified_telegram_id                                                            │    │
│  │  • changed_at (timestamp)                                                          │    │
│  │  • change_metadata (JSONB with additional info)                                    │    │
│  └────────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Notification Scenarios

### Summary Table

| Job Status            | Crew Leader Status          | Action                               | Frequency    |
|-----------------------|-----------------------------|--------------------------------------|--------------|
| Requires Crew Lead    | N/A                         | 🔔 Notify Operation Manager          | Once         |
| Plans In Progress     | Active + Telegram ✅        | ✅ Telegram to CL                    | Once         |
| Plans In Progress     | Telegram + Not Approved ⚠️  | 🔁 Make.com Alert                    | Daily        |
| Plans In Progress     | No Telegram ⚠️              | 🔁 Make.com Alert                    | Daily        |
| Plans In Progress     | Not in DB ❌                | 🔁 Make.com Alert                    | Daily        |
| Pending Review        | Any                         | (No notification)                    | N/A          |
| Closed Job            | Any                         | (No notification)                    | N/A          |

---

## Crew Leader Registration States

### State 1: Not in Database ❌
**Condition**: Crew Leader assigned in Attic Tech but doesn't exist in BotZilla's `employee` table

**System Response**:
- 🔔 Send Make.com webhook alert
- Webhook payload includes: `notInDatabase: true`, `activeUser: false`, `hasTelegramId: false`
- Alert sent **daily** until CL registers

**CL Action Required**: Register in BotZilla via `/employee-registration` page

---

### State 2: Registered, No Telegram ⚠️
**Condition**: Crew Leader exists in `employee` table but `telegram_id` is `null`

**System Response**:
- 🔔 Send Make.com webhook alert
- Webhook payload includes: `activeUser: false`, `hasTelegramId: false`
- Alert sent **daily** until CL completes Telegram registration

**CL Action Required**: Complete Telegram Bot registration to get `telegram_id`

---

### State 3: Has Telegram, Not Approved ⚠️
**Condition**: Crew Leader has `telegram_id` but `status !== 'active'` (e.g., `status === 'pending'`)

**System Response**:
- 🔔 Send Make.com webhook alert (to Admin)
- Webhook payload includes: `activeUser: false`, `hasTelegramId: true`
- Alert sent **daily** until Admin approves

**Admin Action Required**: Approve CL in BotZilla admin panel (change `status` to `'active'`)

---

### State 4: Active & Approved ✅
**Condition**: Crew Leader has `telegram_id` AND `status === 'active'`

**System Response**:
- ✅ Send Telegram notification directly to CL
- Mark `notification_sent = true` in database
- Notification sent **once only** (not repeated)
- Log notification in `job_state_change_log`

**No Action Required**: CL receives job notification successfully

---

## Special Cases

### Case 1: Job Returns to "Requires Crew Lead"

**Scenario**: A job previously in "Plans In Progress" returns to "Requires Crew Lead" (e.g., crew leader was unassigned)

**System Behavior**:
1. Detects status change: `oldStatus === 'Plans In Progress'` → `newStatus === 'Requires Crew Lead'`
2. **RESETS** notification state:
   - `notification_sent = false`
   - `last_notification_sent_at = null`
   - `crew_leader_id = null`
3. Notifies **Operation Manager** (not crew leader)
4. Allows new notification when new CL is assigned

**Reason**: Job needs new crew leader assignment, so old notification state is cleared

---

### Case 2: Crew Leader Changed

**Scenario**: A job in "Plans In Progress" has its crew leader changed (e.g., original CL removed, new CL assigned)

**System Behavior**:
1. Detects CL change: `existingJob.crew_leader_id !== newCrewLeaderId`
2. **RESETS** notification state:
   - `notification_sent = false`
   - `last_notification_sent_at = null`
3. Evaluates new CL's registration status
4. Sends appropriate notification (Telegram or webhook)

**Reason**: New crew leader must be notified, even if previous CL was already notified

---

### Case 3: Job Returns from "Pending Review" to "Plans In Progress"

**Scenario**: An estimate marked as "Sold" creates a job. Later, the scope of work changes, so the estimate is modified and the job returns from "Pending Review" to "Plans In Progress" to re-plan the work.

**System Behavior**:
1. Detects status change: `oldStatus === 'Pending Review'` → `newStatus === 'Plans In Progress'`
2. **RESETS** notification state:
   - `notification_sent = false`
   - `last_notification_sent_at = null`
3. **KEEPS** existing crew leader: `crew_leader_id` is NOT set to `null` (unlike "Requires Crew Lead" scenario)
4. Evaluates **SCENARIO 1** (status changed to "Plans In Progress")
5. **IF** CL is active with telegram:
   - ✅ Sends **new Telegram notification** to same CL
   - Message context: "Job returned to Plans In Progress" (plan modified)
6. **IF** CL without telegram or not approved:
   - 🔔 Sends Make.com alert (daily reminder)

**Reason**: Crew leader needs to be re-notified because the job plan has changed, requiring new work to be done. The system allows re-notification by resetting `notification_sent` when the status changes back to "Plans In Progress".

**Key Difference from "Requires Crew Lead"**:
- "Requires Crew Lead" → `crew_leader_id` is cleared (needs new CL)
- "Pending Review" → "Plans In Progress" → `crew_leader_id` is kept (same CL, new plan)

---

### Case 4: Inconsistent Data Cleanup

**Scenario**: A job has `notification_sent = true` but `crew_leader_id = null` (data inconsistency)

**System Behavior**:
1. Detects inconsistency during sync
2. **RESETS** notification state:
   - `notification_sent = false`
   - `last_notification_sent_at = null`
3. Logs warning for audit purposes

**Reason**: Prevents "ghost notifications" where system thinks it notified but no CL exists

---

## Database Schema

### Key Tables

#### `job` Table
```sql
CREATE TABLE botzilla.job (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    attic_tech_job_id INTEGER UNIQUE,
    attic_tech_estimate_id INTEGER,
    status_id INTEGER REFERENCES botzilla.job_status(id),
    last_known_status_id INTEGER REFERENCES botzilla.job_status(id),
    crew_leader_id INTEGER REFERENCES botzilla.employee(id),
    branch_id INTEGER REFERENCES botzilla.branch(id),
    estimate_id INTEGER REFERENCES botzilla.estimate(id),
    notification_sent BOOLEAN DEFAULT false NOT NULL,
    last_notification_sent_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    closing_date TIMESTAMP,
    -- ... other fields
);
```

**Key Fields for Notifications**:
- `notification_sent`: 
  - `true` = Telegram notification already sent (don't repeat)
  - `false` = Not yet notified OR webhook/alert sent (repeat daily)
- `last_notification_sent_at`: Timestamp of last notification
- `last_known_status_id`: Previous status (for change detection)
- `status_id`: Current status
- `crew_leader_id`: FK to `employee.id` (can be null)

---

#### `job_state_change_log` Table (Audit Trail)
```sql
CREATE TABLE botzilla.job_state_change_log (
    id SERIAL PRIMARY KEY,
    job_sync_id INTEGER REFERENCES botzilla.job_sync(id) ON DELETE CASCADE,
    attic_tech_job_id INTEGER NOT NULL,
    previous_status_id INTEGER REFERENCES botzilla.job_status(id),
    new_status_id INTEGER REFERENCES botzilla.job_status(id),
    notified_user_type VARCHAR(50), -- 'crew_leader', 'operation_manager'
    notified_user_id INTEGER,
    notified_telegram_id VARCHAR(20),
    changed_at TIMESTAMP DEFAULT NOW(),
    change_metadata JSONB
);
```

**Purpose**: Track all job status changes and who was notified

---

#### `employee` Table
```sql
CREATE TABLE botzilla.employee (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    telegram_id VARCHAR(50), -- From Telegram registration
    status VARCHAR(20), -- 'active', 'pending', 'inactive'
    role VARCHAR(50), -- 'crew_member', 'crew_leader', 'operation_manager', etc.
    branch_id INTEGER REFERENCES botzilla.branch(id),
    -- ... other fields
);
```

**Key Fields**:
- `telegram_id`: Obtained when user completes Telegram Bot registration
- `status`: 
  - `'pending'` = Registered but not approved by admin
  - `'active'` = Approved and can receive Telegram notifications
  - `'inactive'` = Deactivated
- `role`: Determines if user can be a crew leader

---

## Key Algorithms

### Algorithm 1: Find Crew Leader in Database

**Function**: `findCrewLeader(assignedCrew[])`

**Priority Order**:
1. Match by `telegram_id` (most reliable)
2. Match by `phone` (if no telegram_id match)
3. Match by concatenated name: `first_name + ' ' + last_name`

**Why Multiple Criteria**: Crew leaders might not have completed Telegram registration yet, so we use fallback matching

**Code Reference**: `backend/src/controllers/jobSync.controller.js:100-150`

---

### Algorithm 2: Detect Status Change

**Function**: `saveJobsToDb(jobsFromAT)`

**Logic**:
```javascript
const oldStatusId = existingJob.last_known_status_id || existingJob.status_id;
const newStatusId = status?.id;
const statusChanged = oldStatusId !== newStatusId;
```

**Why `last_known_status_id`**: 
- Allows detection of status changes even if `status_id` was manually modified
- Acts as "source of truth" for previous sync state

**Code Reference**: `backend/src/controllers/jobSync.controller.js:461-483`

---

### Algorithm 3: Determine Notification Type

**Function**: Inline logic in `saveJobsToDb()`

**Decision Tree**:
```
IF shouldNotify (status changed to "Plans In Progress")
  IF crewLeader EXISTS
    IF telegram_id NOT NULL
      IF status === 'active'
        → ✅ TELEGRAM NOTIFICATION
      ELSE
        → 🔔 MAKE.COM ALERT (pending approval)
      END IF
    ELSE
      → 🔔 MAKE.COM ALERT (no telegram)
    END IF
  ELSE IF crewLeaderFromAT EXISTS
    → 🔔 MAKE.COM ALERT (not in DB)
  END IF
END IF
```

**Code Reference**: `backend/src/controllers/jobSync.controller.js:534-690`

---

### Algorithm 4: Continuous Reminder Logic

**Function**: Inline logic in `saveJobsToDb()`

**Conditions for Daily Alerts**:
1. `!statusChanged` (no status change, but still problematic)
2. `status === 'Plans In Progress'` (active job)
3. One of:
   - `crewLeader && !crewLeader.telegram_id` (no telegram)
   - `crewLeader && crewLeader.telegram_id && crewLeader.status !== 'active'` (not approved)
   - `!crewLeader && crewLeaderFromAT` (not in DB)

**Why Daily**: Ensures crew leaders don't "fall through the cracks" and remain unregistered/unapproved indefinitely

**Code Reference**: `backend/src/controllers/jobSync.controller.js:591-638`

---

## FAQ

### Q1: Why are some notifications sent only once and others daily?

**A**: Telegram notifications are sent **once** when a crew leader is active and approved. This is marked with `notification_sent = true`. 

However, Make.com webhook alerts (for registration issues) are sent **daily** because they indicate an unresolved problem that requires action (registration, approval). `notification_sent` remains `false` so the system continues to remind until the issue is resolved.

---

### Q2: What happens if a crew leader completes registration mid-day?

**A**: The next daily sync will detect that the crew leader now has `telegram_id` and `status === 'active'`. Since `notification_sent` is still `false`, the system will send a Telegram notification and update `notification_sent = true`. No more Make.com alerts will be sent for that job.

---

### Q3: Can a job receive multiple notifications?

**A**: Yes, in these scenarios:
- **Status changes** (e.g., "Plans In Progress" → "Pending Review" → "Plans In Progress" again)
- **Crew leader changes** (old CL removed, new CL assigned)
- **Job returns to "Requires Crew Lead"** (CL unassigned)

Each time, `notification_sent` is reset to `false`, allowing a new notification cycle.

---

### Q4: What if a job has no crew leader assigned in Attic Tech?

**A**: If `job.assignedCrew` is empty or doesn't include a crew leader role:
- For status "Requires Crew Lead": **Operation Manager** is notified
- For status "Plans In Progress": System logs a warning but doesn't send notification

---

### Q5: How does the system handle multiple crew members vs. crew leader?

**A**: The `findCrewLeader()` function looks for a crew member with role `'Crew Leader'` in the `assignedCrew` array. Only the crew leader receives notifications, not regular crew members.

**Code Reference**: `backend/src/controllers/jobSync.controller.js:100-150`

---

### Q6: What if Attic Tech API is down during sync?

**A**: The sync will fail gracefully and log errors. Jobs won't be updated. The next daily sync will retry. No duplicate notifications are sent because `last_synced_at` and `notification_sent` flags prevent re-processing.

---

### Q7: Can an admin manually trigger notifications?

**A**: Not directly via UI currently. However, an admin can:
1. Manually trigger sync: `POST /api/job-sync/sync-jobs`
2. Reset notification flag in database to force re-notification (not recommended)

---

### Q8: How are Operation Managers determined?

**A**: Operation Managers are found by querying the `employee` table for users with:
- `role === 'operation_manager'`
- `branch_id` matching the job's branch
- `telegram_id` NOT NULL (must be registered)

**Code Reference**: `backend/src/controllers/jobSync.controller.js:305-346`

---

### Q9: What data is sent in Telegram notifications?

**A**: Telegram notifications include:
- Job name
- Customer name
- Customer phone (if available)
- Job address
- Branch name
- Salesperson name
- Job link to Attic Tech
- Crew leader name (for CL notifications)

**Code Reference**: `backend/src/controllers/jobSync.controller.js:854-877`

---

### Q10: What data is sent in Make.com webhook alerts?

**A**: Make.com webhook payloads include:
- `crewLeaderId` (or `null` if not in DB)
- `crewLeaderName`
- `crewLeaderEmail`
- `jobName`
- `branchName`
- `registrationUrl` (link to `/employee-registration`)
- `activeUser` (boolean: is CL approved?)
- `hasTelegramId` (boolean: did CL complete Telegram registration?)
- `notInDatabase` (boolean: is CL missing from BotZilla DB?)

**Code Reference**: `backend/src/services/makeWebhook.service.js:50-100`

---

## Implementation Files

### Core Controllers
- `backend/src/controllers/jobSync.controller.js` - Main sync logic
- `backend/src/controllers/automations.controller.js` - Additional automation flows

### Services
- `backend/src/services/makeWebhook.service.js` - Make.com webhook alerts
- `backend/src/services/jobCreationService.js` - Job creation utilities

### Models
- `backend/src/models/Job.js` - Job model with notification fields
- `backend/src/models/Employee.js` - Employee/Crew Leader model

### Migrations
- `backend/src/migrations/add_sync_fields_to_job.sql` - Added notification tracking fields
- `backend/src/migrations/job_sync_system_setup.sql` - Created `job_state_change_log` table
- `backend/src/migrations/fix_crew_leader_id_reference.sql` - Changed FK to reference `employee` table

---

## Configuration

### Environment Variables

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=<your_telegram_bot_token>

# Make.com Webhooks
MAKE_CREW_LEADER_ALERT_WEBHOOK=<make.com_webhook_url>

# Attic Tech API
ATTIC_TECH_API_URL=https://www.attic-tech.com/api
ATTIC_TECH_TOKEN=<your_attic_tech_token>

# Frontend URL (for registration links)
FRONTEND_URL=https://yallaprojects.com
```

### Cron Job Configuration

**File**: `backend/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'botzilla-backend',
      script: 'src/server.js',
      cron_restart: '0 8 * * *', // Run daily at 8:00 AM
      // ... other config
    }
  ]
};
```

**Alternative**: Use external cron job to trigger sync endpoint:
```bash
# Daily at 8:00 AM
0 8 * * * curl -X POST https://yallaprojects.com/api/job-sync/sync-jobs
```

---

## Testing

### Manual Testing

1. **Test Scenario 1: New Job with Active CL**
   ```bash
   # Create a job in Attic Tech with status "Plans In Progress" and assign active CL
   # Trigger sync
   curl -X POST https://yallaprojects.com/api/job-sync/sync-jobs
   # Expected: CL receives Telegram notification
   ```

2. **Test Scenario 2: CL Without Telegram**
   ```bash
   # Create a job and assign CL without telegram_id
   # Trigger sync
   curl -X POST https://yallaprojects.com/api/job-sync/sync-jobs
   # Expected: Make.com webhook alert sent
   ```

3. **Test Scenario 3: Job Returns to "Plans In Progress"**
   ```bash
   # Change job status from "Pending Review" to "Plans In Progress" in Attic Tech
   # Trigger sync
   curl -X POST https://yallaprojects.com/api/job-sync/sync-jobs
   # Expected: CL receives new Telegram notification (notification_sent was reset)
   ```

### Automated Testing

**File**: `backend/src/__tests__/controllers/jobSync.test.js`

```javascript
describe('Job Sync Controller', () => {
  test('should notify CL when job changes to Plans In Progress', async () => {
    // Test implementation
  });

  test('should send Make.com alert for CL without telegram', async () => {
    // Test implementation
  });

  test('should reset notification when job returns to Requires Crew Lead', async () => {
    // Test implementation
  });
});
```

---

## Monitoring & Logging

### Log Levels

The system uses Winston logger with the following log levels:

- **INFO**: Normal operations (job synced, notification sent)
- **WARN**: Issues requiring attention (CL not registered, pending approval)
- **ERROR**: Critical failures (API down, DB error)

### Example Logs

```
[INFO] 📝 Estado cambió para "John Smith Residence": Requires Crew Lead (ID 1) → Plans In Progress (ID 2)
[INFO] 🔔 Escenario 1: Estado cambió a "Plans In Progress" con Crew Leader asignado: John Smith Residence
[INFO] 📨 Notificación generada para Crew Leader: Mike Johnson (Job: John Smith Residence)
[INFO] ✅ Job 123 actualizado con Crew Leader: Mike Johnson (telegram_id: 987654321)
[WARN] ⚠️  Crew Leader "David Lee" no tiene telegram_id. Enviando alerta de registro...
```

### Monitoring Queries

**Check jobs without notifications sent**:
```sql
SELECT 
    j.id, 
    j.name, 
    js.name AS status,
    e.first_name || ' ' || e.last_name AS crew_leader,
    e.telegram_id,
    e.status AS cl_status,
    j.notification_sent,
    j.last_synced_at
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.employee e ON j.crew_leader_id = e.id
WHERE j.notification_sent = false
  AND js.name = 'Plans In Progress'
ORDER BY j.last_synced_at DESC;
```

**Check notification history**:
```sql
SELECT 
    jscl.changed_at,
    jscl.attic_tech_job_id,
    js1.name AS previous_status,
    js2.name AS new_status,
    jscl.notified_user_type,
    jscl.notified_telegram_id
FROM botzilla.job_state_change_log jscl
LEFT JOIN botzilla.job_status js1 ON jscl.previous_status_id = js1.id
LEFT JOIN botzilla.job_status js2 ON jscl.new_status_id = js2.id
ORDER BY jscl.changed_at DESC
LIMIT 50;
```

---

## Troubleshooting

### Issue 1: Notifications Not Being Sent

**Symptoms**: Job status changed but no Telegram notification or Make.com alert

**Possible Causes**:
1. `notification_sent` flag not reset properly
2. Crew leader search algorithm failed to find CL
3. Telegram Bot token invalid
4. Make.com webhook URL incorrect

**Solution**:
```sql
-- Check notification status
SELECT notification_sent, last_notification_sent_at, crew_leader_id
FROM botzilla.job
WHERE attic_tech_job_id = <job_id>;

-- Manually reset if needed (for testing only)
UPDATE botzilla.job
SET notification_sent = false, last_notification_sent_at = null
WHERE attic_tech_job_id = <job_id>;
```

---

### Issue 2: Duplicate Notifications

**Symptoms**: Crew leader receives multiple notifications for the same job

**Possible Causes**:
1. `notification_sent` flag not being set to `true` after sending
2. Multiple sync jobs running simultaneously
3. Status change logic triggered incorrectly

**Solution**:
- Check logs for duplicate sync executions
- Verify `notification_sent` is updated in DB after sending
- Ensure only one cron job is configured

---

### Issue 3: Crew Leader Not Found

**Symptoms**: Job has crew leader in Attic Tech but system shows `crew_leader_id = null`

**Possible Causes**:
1. Name mismatch between Attic Tech and BotZilla
2. Crew leader not registered in BotZilla
3. Multiple employees with similar names

**Solution**:
- Verify crew leader exists in `employee` table
- Check name matching algorithm (telegram_id → phone → name)
- Manually create employee record if missing

---

### Issue 4: Operation Manager Not Notified

**Symptoms**: Job with "Requires Crew Lead" status but no notification sent

**Possible Causes**:
1. No operation manager assigned to branch
2. Operation manager missing `telegram_id`
3. Branch association incorrect

**Solution**:
```sql
-- Check operation managers for branch
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS name,
    e.telegram_id,
    e.status,
    b.name AS branch
FROM botzilla.employee e
JOIN botzilla.branch b ON e.branch_id = b.id
WHERE e.role = 'operation_manager'
  AND b.id = <branch_id>;
```

---

## Appendix A: Make.com Webhook Payload Examples

### Payload 1: CL Not in Database
```json
{
  "crewLeaderId": null,
  "crewLeaderName": "John Doe",
  "crewLeaderEmail": "john.doe@example.com",
  "jobName": "Smith Residence - Insulation",
  "branchName": "Los Angeles",
  "registrationUrl": "https://yallaprojects.com/employee-registration",
  "notInDatabase": true,
  "activeUser": false,
  "hasTelegramId": false
}
```

### Payload 2: CL Without Telegram
```json
{
  "crewLeaderId": 123,
  "crewLeaderName": "Mike Johnson",
  "crewLeaderEmail": "mike.johnson@example.com",
  "jobName": "Williams Attic - Air Sealing",
  "branchName": "Orange County",
  "registrationUrl": "https://yallaprojects.com/employee-registration",
  "notInDatabase": false,
  "activeUser": false,
  "hasTelegramId": false
}
```

### Payload 3: CL Pending Approval
```json
{
  "crewLeaderId": 456,
  "crewLeaderName": "David Lee",
  "crewLeaderEmail": "david.lee@example.com",
  "jobName": "Brown House - Insulation",
  "branchName": "San Diego",
  "registrationUrl": "https://yallaprojects.com/employee-registration",
  "notInDatabase": false,
  "activeUser": false,
  "hasTelegramId": true
}
```

---

## Appendix B: Telegram Notification Format

### Notification to Crew Leader
```
🔔 New Job Assignment

Job: Smith Residence - Insulation
Customer: John Smith
Phone: (555) 123-4567
Address: 123 Main St, Los Angeles, CA 90001
Branch: Los Angeles
Salesperson: Sarah Williams

🔗 View in Attic Tech: https://www.attic-tech.com/jobs/12345

Good luck! 🚀
```

### Notification to Operation Manager
```
⚠️ New Job Requires Crew Leader

Job: Williams Attic - Air Sealing
Customer: Emily Williams
Phone: (555) 987-6543
Address: 456 Oak Ave, Orange, CA 92868
Branch: Orange County
Salesperson: Michael Brown

Please assign a crew leader in Attic Tech.

🔗 View in Attic Tech: https://www.attic-tech.com/jobs/67890
```

---

## Version History

| Version | Date       | Changes                                                                 |
|---------|------------|-------------------------------------------------------------------------|
| 1.0     | 2025-09-15 | Initial notification system implementation                              |
| 1.1     | 2025-09-20 | Added crew leader registration state detection                          |
| 1.2     | 2025-10-01 | Implemented continuous reminders for incomplete registrations           |
| 1.3     | 2025-10-15 | Added Operation Manager notifications for "Requires Crew Lead" status   |
| 1.4     | 2025-10-28 | Added "Pending Review → Plans In Progress" scenario documentation       |

---

**End of Documentation**

