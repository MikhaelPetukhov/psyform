-- Проверка всех слотов
SELECT 
    id,
    "slotTime"::timestamp,
    "endTime"::timestamp, 
    "isBooked",
    "practitionerId",
    "createdAt"::timestamp
FROM "AvailableSlots" 
ORDER BY "slotTime";

-- Количество слотов
SELECT COUNT(*) as total_slots FROM "AvailableSlots";

-- Слоты на 7 сентября 2025
SELECT 
    id,
    "slotTime"::timestamp,
    "isBooked",
    "practitionerId"
FROM "AvailableSlots" 
WHERE DATE("slotTime") = '2025-09-07'
ORDER BY "slotTime";

-- Все бронирования
SELECT 
    id,
    "slotTime"::timestamp,
    "clientId",
    name,
    phone,
    telegram,
    "AvailableSlotId"
FROM "Bookings"
ORDER BY "slotTime";
