'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Describe Bookings table; if missing, bail (this project assumes it exists)
    let table = {};
    try {
      table = await queryInterface.describeTable('Bookings');
    } catch (_) {
      return; // nothing to do
    }

    // 1) Ensure clientId column exists and is correctly named
    if (table.ClientId && !table.clientId) {
      // Rename legacy ClientId -> clientId
      await queryInterface.renameColumn('Bookings', 'ClientId', 'clientId');
      // refresh table description
      table = await queryInterface.describeTable('Bookings');
    }

    if (!table.clientId && !table.ClientId) {
      await queryInterface.addColumn('Bookings', 'clientId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Clients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      table = await queryInterface.describeTable('Bookings');
    }

    // 2) Ensure clientConfirmation ENUM column exists
    if (!table.clientConfirmation) {
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        // Create enum type if it does not exist
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Bookings_clientConfirmation') THEN
              CREATE TYPE "enum_Bookings_clientConfirmation" AS ENUM ('pending','confirmed','declined');
            END IF;
          END $$;
        `);
      }
      await queryInterface.addColumn('Bookings', 'clientConfirmation', {
        type: Sequelize.ENUM('pending', 'confirmed', 'declined'),
        allowNull: false,
        defaultValue: 'pending',
      });
      table = await queryInterface.describeTable('Bookings');
    }

    // 3) Ensure reminderSentAt exists
    if (!table.reminderSentAt) {
      await queryInterface.addColumn('Bookings', 'reminderSentAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      table = await queryInterface.describeTable('Bookings');
    }

    // 4) Ensure meetLink exists
    if (!table.meetLink) {
      await queryInterface.addColumn('Bookings', 'meetLink', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Best-effort clean up; ignore errors if columns are already absent
    const safeRemove = async (table, column) => {
      try { await queryInterface.removeColumn(table, column); } catch (_) {}
    };

    await safeRemove('Bookings', 'meetLink');
    await safeRemove('Bookings', 'reminderSentAt');

    // Drop clientConfirmation then its enum type (if exists and unused)
    await safeRemove('Bookings', 'clientConfirmation');
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      try {
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Bookings_clientConfirmation') THEN
              DROP TYPE "enum_Bookings_clientConfirmation";
            END IF;
          END $$;
        `);
      } catch (_) {}
    }

    await safeRemove('Bookings', 'clientId');
  }
};
