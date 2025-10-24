#!/bin/bash

# ============================================================================
# SCRIPT DE LIMPIEZA - ARCHIVOS DE TESTING Y TEMPORALES
# BotZilla V2 - Pre-Production Cleanup
# ============================================================================

set -e

echo "🧹 Iniciando limpieza de archivos innecesarios..."
echo ""

# Contador de archivos eliminados
count=0

# ============================================================================
# SECCIÓN 1: Scripts de Testing
# ============================================================================
echo "1️⃣  Eliminando scripts de testing..."

files_to_delete=(
    "backend/scripts/testJobSync.js"
    "backend/scripts/testJobSync.sh"
    "backend/scripts/testSyncEndpoint.js"
    "backend/scripts/testAtticTechAuth.js"
    "backend/scripts/testMultiplier.js"
    "backend/scripts/testInspectionReports.js"
    "backend/scripts/testPlansInProgressJobs.js"
    "backend/scripts/fetchAtticTechUsers.js"
    "backend/scripts/syncAtticTechUsersToDb.js"
    "backend/scripts/checkJobStatus.js"
    "backend/scripts/listCrewLeaders.js"
)

for file in "${files_to_delete[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    fi
done

echo ""

# ============================================================================
# SECCIÓN 2: Scripts SQL de Testing
# ============================================================================
echo "2️⃣  Eliminando scripts SQL de testing..."

sql_files_to_delete=(
    "backend/scripts/setupTwoJobsForTest.sql"
    "backend/scripts/prepareMultipleJobsForTest.sql"
    "backend/scripts/resetJobForTesting.sql"
    "backend/scripts/createTestCrewLeader.sql"
    "backend/scripts/enableTestingMode.sql"
    "backend/scripts/prepareJobForTest.sql"
)

for file in "${sql_files_to_delete[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    fi
done

echo ""

# ============================================================================
# SECCIÓN 3: Scripts de Debug
# ============================================================================
echo "3️⃣  Eliminando scripts de debug..."

debug_files=(
    "backend/scripts/debugKentTaxes.js"
    "backend/scripts/debugSpecificEstimate.js"
    "backend/scripts/debugMultiplierLogic.js"
    "backend/scripts/debugMultipliers.js"
    "backend/scripts/debugEstimatesStatus.js"
)

for file in "${debug_files[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    fi
done

echo ""

# ============================================================================
# SECCIÓN 4: Archivos JSON Temporales
# ============================================================================
echo "4️⃣  Eliminando archivos JSON temporales..."

json_files=(
    "backend/scripts/attic_tech_users_classified.json"
)

for file in "${json_files[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    fi
done

echo ""

# ============================================================================
# SECCIÓN 5: Documentación de Testing
# ============================================================================
echo "5️⃣  Eliminando documentación de testing..."

doc_files=(
    "backend/TESTING_MULTIPLE_NOTIFICATIONS.md"
    "backend/scripts/TEST_JOB_SYNC_README.md"
)

for file in "${doc_files[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    fi
done

echo ""

# ============================================================================
# SECCIÓN 6: Archivos de Migraciones Obsoletos (ya eliminados)
# ============================================================================
echo "6️⃣  Verificando archivos de migraciones obsoletos..."

obsolete_migrations=(
    "backend/src/migrations/job_sync_system_setup.sql"
    "backend/JOB_SYNC_MIGRATION_SUMMARY.md"
    "backend/src/models/JobSync.js"
)

for file in "${obsolete_migrations[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Eliminado: $file"
        ((count++))
    else
        echo "   ✓  Ya eliminado: $file"
    fi
done

echo ""

# ============================================================================
# SECCIÓN 7: Logs de desarrollo (opcional)
# ============================================================================
echo "7️⃣  Limpiando logs de desarrollo (opcional)..."

# Solo eliminar si existen y son grandes
if [ -d "backend/logs" ]; then
    log_count=$(find backend/logs -name "*.log" 2>/dev/null | wc -l)
    if [ $log_count -gt 0 ]; then
        echo "   ⚠️  Encontrados $log_count archivos de log"
        echo "   💡 Los logs NO se eliminarán automáticamente"
        echo "   💡 Puedes eliminarlos manualmente si lo deseas: rm backend/logs/*.log"
    fi
fi

echo ""

# ============================================================================
# RESUMEN
# ============================================================================
echo "============================================================================"
echo "✅ LIMPIEZA COMPLETADA"
echo "============================================================================"
echo ""
echo "📊 Total de archivos eliminados: $count"
echo ""
echo "📋 Archivos que quedan (necesarios para producción):"
echo "   ✅ Scripts de utilidad en backend/scripts/"
echo "   ✅ Migraciones SQL en backend/src/migrations/"
echo "   ✅ Documentación de producción"
echo "   ✅ Archivos de código fuente"
echo ""
echo "🎯 La aplicación está lista para commit y deployment"
echo ""

