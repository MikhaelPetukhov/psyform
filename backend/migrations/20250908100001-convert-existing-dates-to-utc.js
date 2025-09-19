'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Convert existing dates from Europe/Moscow to UTC
    // Assuming all existing dates were created in Moscow timezone
    
    await queryInterface.sequelize.query(`
      -- Convert AvailableSlots times from Europe/Moscow to UTC
      UPDATE "AvailableSlots" 
      SET 
        "slotTime" = "slotTime" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "endTime" = "endTime" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "createdAt" = "createdAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "updatedAt" = "updatedAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC'
      WHERE "sourceTimezone" = 'Europe/Moscow';
    `);

    await queryInterface.sequelize.query(`
      -- Convert Bookings times from Europe/Moscow to UTC
      UPDATE "Bookings" 
      SET 
        "slotTime" = "slotTime" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "endTime" = "endTime" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "createdAt" = "createdAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "updatedAt" = "updatedAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
        "reminderSentAt" = CASE 
          WHEN "reminderSentAt" IS NOT NULL 
          THEN "reminderSentAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC'
          ELSE NULL 
        END,
        "reminder24hSentAt" = CASE 
          WHEN "reminder24hSentAt" IS NOT NULL 
          THEN "reminder24hSentAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC'
          ELSE NULL 
        END,
        "reminder1hSentAt" = CASE 
          WHEN "reminder1hSentAt" IS NOT NULL 
          THEN "reminder1hSentAt" AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC'
          ELSE NULL 
        END
      WHERE "sourceTimezone" = 'Europe/Moscow';
    `);

    console.log('✅ Converted existing dates from Europe/Moscow to UTC');
  },

  async down(queryInterface, Sequelize) {
    // Convert back from UTC to Europe/Moscow (for rollback)
    await queryInterface.sequelize.query(`
      UPDATE "AvailableSlots" 
      SET 
        "slotTime" = "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "endTime" = "endTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "createdAt" = "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "updatedAt" = "updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow'
      WHERE "sourceTimezone" = 'Europe/Moscow';
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Bookings" 
      SET 
        "slotTime" = "slotTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "endTime" = "endTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "createdAt" = "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "updatedAt" = "updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow',
        "reminderSentAt" = CASE 
          WHEN "reminderSentAt" IS NOT NULL 
          THEN "reminderSentAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow'
          ELSE NULL 
        END,
        "reminder24hSentAt" = CASE 
          WHEN "reminder24hSentAt" IS NOT NULL 
          THEN "reminder24hSentAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow'
          ELSE NULL 
        END,
        "reminder1hSentAt" = CASE 
          WHEN "reminder1hSentAt" IS NOT NULL 
          THEN "reminder1hSentAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow'
          ELSE NULL 
        END
      WHERE "sourceTimezone" = 'Europe/Moscow';
    `);
  }
};
