#!/bin/bash

# ============================================================================
# SCRIPT DE PREPARACIÓN PARA PRODUCCIÓN
# BotZilla V2 - Employee Onboarding & Job Sync System
# ============================================================================

set -e  # Exit on error

echo "🚀 Preparando deployment a producción..."
echo ""

# ============================================================================
# PASO 1: Limpiar archivos de testing/debug (NO van a producción)
# ============================================================================
echo "🧹 Limpiando archivos de testing..."

# Scripts de testing
rm -f backend/scripts/testJobSync.js
rm -f backend/scripts/testJobSync.sh
rm -f backend/scripts/fetchAtticTechUsers.js
rm -f backend/scripts/syncAtticTechUsersToDb.js
rm -f backend/scripts/checkJobStatus.js
rm -f backend/scripts/listCrewLeaders.js
rm -f backend/scripts/attic_tech_users_classified.json

# SQL de testing
rm -f backend/scripts/*.sql

# Documentación de testing
rm -f backend/TESTING_MULTIPLE_NOTIFICATIONS.md
rm -f backend/TEST_JOB_SYNC_README.md
rm -f backend/scripts/TEST_JOB_SYNC_README.md

echo "✅ Archivos de testing eliminados"
echo ""

# ============================================================================
# PASO 2: Agregar archivos al staging
# ============================================================================
echo "📦 Agregando archivos modificados..."

# Backend - Controllers
git add backend/src/app.js
git add backend/src/controllers/automations.controller.js
git add backend/src/controllers/employee.controller.js
git add backend/src/controllers/employeeRegistration.controller.js
git add backend/src/controllers/jobs.controller.js
git add backend/src/controllers/atticTechSync.controller.js
git add backend/src/controllers/atticTechUser.controller.js
git add backend/src/controllers/jobSync.controller.js

# Backend - Models
git add backend/src/models/Employee.js
git add backend/src/models/Job.js

# Backend - Routes
git add backend/src/routes/employees.routes.js
git add backend/src/routes/atticTechSync.routes.js
git add backend/src/routes/atticTechUser.routes.js
git add backend/src/routes/jobStatus.routes.js
git add backend/src/routes/jobSync.routes.js

# Backend - Middleware & Services
git add backend/src/middleware/auth.flexible.middleware.js
git add backend/src/services/makeWebhook.service.js

# Backend - Migrations
git add backend/src/migrations/add_operation_manager_role.sql
git add backend/src/migrations/add_attic_tech_user_id_to_employee.sql
git add backend/src/migrations/add_sync_fields_to_job.sql
git add backend/src/migrations/expected_schema.sql
git add backend/src/migrations/verify_schema.sql

# Backend - Documentation
git add backend/OPERATION_MANAGER_NOTIFICATION_GUIDE.md

# Frontend - Components
git add frontend/src/components/employees/AwaitingRegistrationTable.tsx
git add frontend/src/components/employees/OnboardingDashboard.tsx
git add frontend/src/components/employees/OnboardingTab.tsx
git add frontend/src/components/jobs/JobDetailsModal.tsx

# Frontend - Pages
git add frontend/src/pages/EmployeeRegistration.tsx
git add frontend/src/pages/Jobs.tsx

# Frontend - Services
git add frontend/src/services/atticTechSyncService.ts
git add frontend/src/services/atticTechUserService.ts
git add frontend/src/services/employeeService.ts
git add frontend/src/services/jobService.ts
git add frontend/src/services/statusService.ts

# Deployment Plans & Guides
git add PRODUCTION_DEPLOYMENT_PLAN.md
git add SQL_MIGRATION_INSTRUCTIONS.md
git add SCHEMA_VALIDATION_GUIDE.md
git add READY_FOR_PRODUCTION.md
git add prepare-production.sh
git add cleanup.sh

# Registrar archivos eliminados
git add -u backend/scripts/
git add -u backend/src/migrations/
git add -u backend/

echo "✅ Archivos agregados al staging"
echo ""

# ============================================================================
# PASO 3: Mostrar status
# ============================================================================
echo "📊 Estado actual del repositorio:"
git status
echo ""

# ============================================================================
# PASO 4: Confirmar commit
# ============================================================================
echo "⚠️  ¿Deseas hacer commit de estos cambios? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    echo "💾 Creando commit..."
    git commit -m "feat: Employee Onboarding & Job Sync System

Major Features:
- Employee onboarding flow with Attic Tech synchronization
- Simplified registration for Attic Tech employees
- Legacy records synchronization (sales_person/crew_member)
- Job sync system with automatic status change detection
- Notifications for Crew Leaders when assigned to jobs
- Notifications for Operation Managers for new jobs requiring crew lead
- Job status column in Jobs view
- Estimate details tab in Job Details modal

Backend Changes:
- New controllers: atticTechSync, atticTechUser, jobSync
- New middleware: auth.flexible (JWT + API Key)
- New routes: atticTechSync, atticTechUser, jobStatus, jobSync
- Updated models: Employee, Job (new sync fields)
- Database migrations for new columns and indexes
- New role: Operation Manager

Frontend Changes:
- OnboardingDashboard component with AT sync
- AwaitingRegistrationTable component
- Improved OnboardingTab with activation flow
- Enhanced JobDetailsModal with Estimate tab
- AT user search in EmployeeRegistration
- Job status filter in Jobs view

Database Migrations:
- add_operation_manager_role.sql
- add_attic_tech_user_id_to_employee.sql
- add_sync_fields_to_job.sql"

    echo "✅ Commit creado exitosamente"
    echo ""
    
    echo "⚠️  ¿Deseas hacer push a origin/master? (y/n)"
    read -r push_response
    
    if [[ "$push_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo ""
        echo "🚀 Pushing to origin/master..."
        git push origin master
        echo "✅ Push completado"
    else
        echo "⏸️  Push cancelado. Ejecuta 'git push origin master' cuando estés listo."
    fi
else
    echo "❌ Commit cancelado"
    exit 0
fi

echo ""
echo "============================================================================"
echo "✅ PREPARACIÓN COMPLETA"
echo "============================================================================"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo ""
echo "1. Revisar PRODUCTION_DEPLOYMENT_PLAN.md"
echo "2. Hacer backup de la base de datos de producción"
echo "3. Ejecutar migraciones SQL en producción"
echo "4. Pull del código en servidor de producción"
echo "5. Reiniciar servicios (pm2 restart)"
echo "6. Ejecutar tests post-deployment"
echo ""
echo "🔗 Ver plan completo: cat PRODUCTION_DEPLOYMENT_PLAN.md"
echo ""

