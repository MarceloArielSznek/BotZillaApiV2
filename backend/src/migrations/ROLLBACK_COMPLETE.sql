-- ============================================
-- ROLLBACK SCRIPT - COMPLETE FOLLOW-UP SYSTEM
-- ============================================
-- ⚠️ WARNING: This will PERMANENTLY DELETE all data related to:
--   - Payment Methods
--   - Branch Configuration + Multiplier Ranges
--   - WA Tax Rates
--   - Follow-Up System (tickets, chats, statuses, labels)
--   - New columns in estimate table
--
-- USE ONLY IN CASE OF EMERGENCY!
-- ============================================

BEGIN;

-- Step 1: Eliminar columna follow_up_ticket_id de estimate
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS follow_up_ticket_id;

-- Step 2: Eliminar tablas del sistema Follow-Up (en orden correcto por FKs)
DROP TABLE IF EXISTS chat_message CASCADE;
DROP TABLE IF EXISTS chat CASCADE;
DROP TABLE IF EXISTS follow_up_ticket CASCADE;
DROP TABLE IF EXISTS follow_up_label CASCADE;
DROP TABLE IF EXISTS follow_up_status CASCADE;

-- Step 3: Eliminar columnas de tax de estimate
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS wa_tax_rate CASCADE;
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS wa_tax_amount CASCADE;
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS wa_zip_code CASCADE;

-- Step 4: Eliminar tabla de WA Tax Rates
DROP TABLE IF EXISTS wa_tax_rate CASCADE;

-- Step 5: Eliminar columna snapshot_multiplier_ranges de estimate
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS snapshot_multiplier_ranges CASCADE;

-- Step 6: Eliminar columnas de branch
ALTER TABLE IF EXISTS branch DROP COLUMN IF EXISTS attic_tech_branch_id CASCADE;

-- Step 7: Eliminar tablas de Branch Configuration (en orden por FKs)
DROP TABLE IF EXISTS branch_multiplier_config CASCADE;
DROP TABLE IF EXISTS multiplier_range CASCADE;
DROP TABLE IF EXISTS branch_configuration CASCADE;

-- Step 8: Eliminar columnas de estimate relacionadas a payment method y sub services
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS payment_method_id CASCADE;
ALTER TABLE IF EXISTS estimate DROP COLUMN IF EXISTS sub_services_retail_cost CASCADE;

-- Step 9: Eliminar tabla de Payment Methods
DROP TABLE IF EXISTS payment_method CASCADE;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔄 ROLLBACK COMPLETED SUCCESSFULLY';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'All Follow-Up System tables and columns have been removed.';
    RAISE NOTICE 'The database schema has been reverted to its previous state.';
    RAISE NOTICE '==========================================';
END $$;

COMMIT;

-- ============================================
-- POST-ROLLBACK VERIFICATION
-- ============================================
-- Run these queries to verify rollback was successful:

-- 1. Verify tables are gone
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--     'payment_method',
--     'branch_configuration',
--     'multiplier_range',
--     'branch_multiplier_config',
--     'wa_tax_rate',
--     'follow_up_ticket',
--     'follow_up_status',
--     'follow_up_label',
--     'chat',
--     'chat_message'
-- );
-- Should return: 0 rows

-- 2. Verify estimate columns are gone
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'estimate' 
-- AND column_name IN (
--     'payment_method_id',
--     'snapshot_multiplier_ranges',
--     'sub_services_retail_cost',
--     'wa_tax_rate',
--     'wa_tax_amount',
--     'wa_zip_code',
--     'follow_up_ticket_id'
-- );
-- Should return: 0 rows

-- 3. Verify branch columns are gone
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'branch' 
-- AND column_name = 'attic_tech_branch_id';
-- Should return: 0 rows

