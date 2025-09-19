#!/bin/bash

echo "=== АНАЛИЗ БАЗЫ ДАННЫХ PSYBOOKING ==="
echo "Дата: $(date)"
echo

# Проверка подключения
echo "1. ПРОВЕРКА ПОДКЛЮЧЕНИЯ:"
psql -U user -d psybooking -c "SELECT current_database(), current_user, version();"
echo

# Структура таблиц
echo "2. СТРУКТУРА ТАБЛИЦ:"
echo "--- AvailableSlots ---"
psql -U user -d psybooking -c "\d \"AvailableSlots\""
echo

echo "--- Bookings ---"  
psql -U user -d psybooking -c "\d \"Bookings\""
echo

echo "--- Clients ---"
psql -U user -d psybooking -c "\d \"Clients\""
echo

echo "--- Practitioners ---"
psql -U user -d psybooking -c "\d \"Practitioners\""
echo

# Подсчет записей
echo "3. КОЛИЧЕСТВО ЗАПИСЕЙ:"
psql -U user -d psybooking -c "
SELECT 
    'AvailableSlots' as table_name, COUNT(*) as count FROM \"AvailableSlots\"
UNION ALL SELECT 
    'Bookings' as table_name, COUNT(*) as count FROM \"Bookings\"
UNION ALL SELECT 
    'Clients' as table_name, COUNT(*) as count FROM \"Clients\"
UNION ALL SELECT 
    'Practitioners' as table_name, COUNT(*) as count FROM \"Practitioners\";
"
echo

# Все слоты
echo "4. ВСЕ ДОСТУПНЫЕ СЛОТЫ:"
psql -U user -d psybooking -c "
SELECT 
    id,
    \"slotTime\",
    \"endTime\",
    \"isBooked\",
    \"practitionerId\",
    \"createdAt\"
FROM \"AvailableSlots\" 
ORDER BY \"slotTime\";
"
echo

# Все бронирования
echo "5. ВСЕ БРОНИРОВАНИЯ:"
psql -U user -d psybooking -c "
SELECT 
    id,
    name,
    phone,
    telegram,
    \"slotTime\",
    \"endTime\",
    \"clientId\",
    \"AvailableSlotId\",
    status,
    \"clientConfirmation\"
FROM \"Bookings\"
ORDER BY \"slotTime\";
"
echo

# Проверка целостности
echo "6. ПРОБЛЕМЫ ЦЕЛОСТНОСТИ:"
echo "--- Зависшие слоты (isBooked=true без бронирований) ---"
psql -U user -d psybooking -c "
SELECT 
    s.id as slot_id,
    s.\"slotTime\",
    s.\"isBooked\",
    s.\"practitionerId\",
    b.id as booking_id
FROM \"AvailableSlots\" s 
LEFT JOIN \"Bookings\" b ON s.id = b.\"AvailableSlotId\"
WHERE s.\"isBooked\" = true AND b.id IS NULL;
"
echo

echo "--- Бронирования без слотов ---"
psql -U user -d psybooking -c "
SELECT 
    b.id as booking_id,
    b.name,
    b.\"slotTime\",
    b.\"AvailableSlotId\",
    s.id as slot_id
FROM \"Bookings\" b
LEFT JOIN \"AvailableSlots\" s ON b.\"AvailableSlotId\" = s.id
WHERE b.\"AvailableSlotId\" IS NOT NULL AND s.id IS NULL;
"
echo

# Поиск проблемного слота на 10:00
echo "7. ПОИСК СЛОТА НА 10:00 (7 сентября 2025):"
psql -U user -d psybooking -c "
SELECT 
    s.id as slot_id,
    s.\"slotTime\",
    s.\"isBooked\",
    b.id as booking_id,
    b.name,
    b.phone
FROM \"AvailableSlots\" s
LEFT JOIN \"Bookings\" b ON s.id = b.\"AvailableSlotId\"
WHERE DATE(s.\"slotTime\") = '2025-09-07'
  AND EXTRACT(HOUR FROM s.\"slotTime\") = 10
ORDER BY s.\"slotTime\";
"
echo

echo "=== АНАЛИЗ ЗАВЕРШЕН ==="
