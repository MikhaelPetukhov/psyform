-- Анализ всех таблиц в базе данных

-- 1. Структура таблицы AvailableSlots
\d "AvailableSlots"

-- 2. Структура таблицы Bookings  
\d "Bookings"

-- 3. Структура таблицы Clients
\d "Clients"

-- 4. Структура таблицы Practitioners
\d "Practitioners"

-- 5. Все слоты с подробностями
SELECT 
    id,
    "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    "endTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as end_time_local,
    "isBooked",
    "practitionerId",
    "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as created_at_local,
    "updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as updated_at_local
FROM "AvailableSlots" 
WHERE "slotTime" >= NOW() - INTERVAL '1 day'
ORDER BY "slotTime";

-- 6. Все бронирования с подробностями
SELECT 
    id,
    name,
    phone,
    telegram,
    "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    "endTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as end_time_local,
    "clientId",
    "AvailableSlotId",
    status,
    "clientConfirmation",
    "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as created_at_local
FROM "Bookings"
WHERE "slotTime" >= NOW() - INTERVAL '1 day'
ORDER BY "slotTime";

-- 7. Проверка целостности связей - зависшие слоты (isBooked=true но нет бронирования)
SELECT 
    s.id as slot_id,
    s."slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    s."isBooked",
    s."practitionerId",
    b.id as booking_id,
    b.name as booking_name
FROM "AvailableSlots" s 
LEFT JOIN "Bookings" b ON s.id = b."AvailableSlotId"
WHERE s."isBooked" = true AND b.id IS NULL;

-- 8. Обратная проверка - бронирования без слотов
SELECT 
    b.id as booking_id,
    b.name,
    b."slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    b."AvailableSlotId",
    s.id as slot_id,
    s."isBooked"
FROM "Bookings" b
LEFT JOIN "AvailableSlots" s ON b."AvailableSlotId" = s.id
WHERE b."AvailableSlotId" IS NOT NULL AND s.id IS NULL;

-- 9. Слоты на конкретную дату (7 сентября 2025)
SELECT 
    id,
    "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    "isBooked",
    "practitionerId"
FROM "AvailableSlots" 
WHERE DATE("slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney') = '2025-09-07'
ORDER BY "slotTime";

-- 10. Бронирования на конкретную дату (7 сентября 2025)
SELECT 
    id,
    name,
    phone,
    telegram,
    "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    "AvailableSlotId"
FROM "Bookings"
WHERE DATE("slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney') = '2025-09-07'
ORDER BY "slotTime";

-- 11. Поиск проблемного слота на 10:00 7 сентября 2025
SELECT 
    s.id as slot_id,
    s."slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney' as slot_time_local,
    s."isBooked",
    b.id as booking_id,
    b.name,
    b.phone
FROM "AvailableSlots" s
LEFT JOIN "Bookings" b ON s.id = b."AvailableSlotId"
WHERE DATE("slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney') = '2025-09-07'
  AND EXTRACT(HOUR FROM "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney') = 10
ORDER BY "slotTime";
