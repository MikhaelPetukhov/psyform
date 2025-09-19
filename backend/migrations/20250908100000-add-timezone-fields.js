'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add timezone field to AvailableSlots
    await queryInterface.addColumn('AvailableSlots', 'sourceTimezone', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Europe/Moscow',
      comment: 'Original timezone when slot was created'
    });

    // Add timezone field to Bookings
    await queryInterface.addColumn('Bookings', 'sourceTimezone', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Europe/Moscow',
      comment: 'Original timezone when booking was created'
    });

    // Convert existing timestamp columns to timestamptz if they aren't already
    await queryInterface.sequelize.query(`
      -- Convert AvailableSlots timestamps to timestamptz
      ALTER TABLE "AvailableSlots" 
      ALTER COLUMN "slotTime" TYPE TIMESTAMPTZ USING "slotTime" AT TIME ZONE 'UTC',
      ALTER COLUMN "endTime" TYPE TIMESTAMPTZ USING "endTime" AT TIME ZONE 'UTC',
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
    `);

    await queryInterface.sequelize.query(`
      -- Convert Bookings timestamps to timestamptz
      ALTER TABLE "Bookings" 
      ALTER COLUMN "slotTime" TYPE TIMESTAMPTZ USING "slotTime" AT TIME ZONE 'UTC',
      ALTER COLUMN "endTime" TYPE TIMESTAMPTZ USING "endTime" AT TIME ZONE 'UTC',
      ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
      ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';
    `);

    // Convert other timestamp fields to timestamptz
    const timestampFields = [
      'reminderSentAt', 'reminder24hSentAt', 'reminder1hSentAt'
    ];

    for (const field of timestampFields) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Bookings" 
        ALTER COLUMN "${field}" TYPE TIMESTAMPTZ USING "${field}" AT TIME ZONE 'UTC';
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove timezone fields
    await queryInterface.removeColumn('AvailableSlots', 'sourceTimezone');
    await queryInterface.removeColumn('Bookings', 'sourceTimezone');

    // Note: We don't convert back from timestamptz to timestamp 
    // as this could cause data loss due to timezone info
  }
};
