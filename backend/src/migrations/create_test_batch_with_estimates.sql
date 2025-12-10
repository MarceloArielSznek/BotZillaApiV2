-- Script para crear un batch de prueba con 2 estimates falsos
-- Ejecutar: PGPASSWORD=Fideo2022 psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f backend/src/migrations/create_test_batch_with_estimates.sql

DO $$
DECLARE
    lost_status_id INTEGER;
    test_branch_id INTEGER;
    test_salesperson_id INTEGER;
    test_user_id INTEGER;
    estimate1_id INTEGER;
    estimate2_id INTEGER;
    batch_id INTEGER;
BEGIN
    -- Obtener el status "Lost"
    SELECT id INTO lost_status_id FROM botzilla.estimate_status WHERE name = 'Lost' LIMIT 1;
    
    -- Obtener una branch (primera disponible)
    SELECT id INTO test_branch_id FROM botzilla.branch LIMIT 1;
    
    -- Obtener un salesperson (primero disponible)
    SELECT id INTO test_salesperson_id FROM botzilla.sales_person LIMIT 1;
    
    -- Obtener un usuario (primero disponible)
    SELECT id INTO test_user_id FROM botzilla."user" LIMIT 1;
    
    -- Verificar que tenemos los datos necesarios
    IF lost_status_id IS NULL THEN
        RAISE EXCEPTION 'Lost status not found';
    END IF;
    
    IF test_branch_id IS NULL THEN
        RAISE EXCEPTION 'No branch found';
    END IF;
    
    -- Crear Estimate 1: Nave Black
    INSERT INTO botzilla.estimate (
        name,
        customer_name,
        customer_phone,
        status_id,
        branch_id,
        sales_person_id,
        price,
        retail_cost,
        final_price,
        discount,
        at_created_date,
        at_updated_date,
        created_at,
        updated_at
    ) VALUES (
        'Nave Black - Test',
        'Nave Black',
        '+18589336622',
        lost_status_id,
        test_branch_id,
        test_salesperson_id,
        5000.00,
        12000.00,
        10800.00,
        10.00,
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '5 days',
        NOW(),
        NOW()
    ) RETURNING id INTO estimate1_id;
    
    -- Crear Estimate 2: Tyson Jhonson
    INSERT INTO botzilla.estimate (
        name,
        customer_name,
        customer_phone,
        status_id,
        branch_id,
        sales_person_id,
        price,
        retail_cost,
        final_price,
        discount,
        at_created_date,
        at_updated_date,
        created_at,
        updated_at
    ) VALUES (
        'Tyson Jhonson - Test',
        'Tyson Jhonson',
        '+14064226575',
        lost_status_id,
        test_branch_id,
        test_salesperson_id,
        7500.00,
        15000.00,
        13500.00,
        10.00,
        NOW() - INTERVAL '25 days',
        NOW() - INTERVAL '3 days',
        NOW(),
        NOW()
    ) RETURNING id INTO estimate2_id;
    
    -- Crear el SMS Batch
    INSERT INTO botzilla.sms_batch (
        name,
        description,
        created_by,
        status,
        total_estimates,
        created_at,
        updated_at
    ) VALUES (
        'Test Batch - Nave & Tyson',
        'Batch de prueba con 2 estimates falsos para testing de SMS',
        test_user_id,
        'draft',
        2,
        NOW(),
        NOW()
    ) RETURNING id INTO batch_id;
    
    -- Agregar los estimates al batch
    INSERT INTO botzilla.sms_batch_estimate (batch_id, estimate_id, added_at, status)
    VALUES 
        (batch_id, estimate1_id, NOW(), 'pending'),
        (batch_id, estimate2_id, NOW(), 'pending');
    
    RAISE NOTICE '✅ Batch creado exitosamente!';
    RAISE NOTICE '   Batch ID: %', batch_id;
    RAISE NOTICE '   Estimate 1 ID: % (Nave Black)', estimate1_id;
    RAISE NOTICE '   Estimate 2 ID: % (Tyson Jhonson)', estimate2_id;
    
END $$;

