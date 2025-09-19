'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helpers for idempotency
    const tableHasColumn = async (table, column) => {
      try {
        const desc = await queryInterface.describeTable(table);
        return !!desc && Object.prototype.hasOwnProperty.call(desc, column);
      } catch (_) {
        return false;
      }
    };

    // 1) Create Practitioners table
    try {
      await queryInterface.createTable('Practitioners', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        slug: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        displayName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        plan: {
          type: Sequelize.ENUM('free', 'pro'),
          allowNull: false,
          defaultValue: 'free',
        },
        tgUserId: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        },
        tgUsername: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        tgPhone: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      });
    } catch (_) { /* table may already exist */ }

    // 2) Add practitionerId to existing tables and FK constraints
    const addFk = async (table) => {
      const has = await tableHasColumn(table, 'practitionerId');
      if (!has) {
        await queryInterface.addColumn(table, 'practitionerId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Practitioners',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
      try {
        await queryInterface.addIndex(table, ['practitionerId'], {
          name: `${table.toLowerCase()}_practitioner_idx`,
        });
      } catch (_) { /* index may already exist */ }
    };

    await addFk('AvailableSlots');
    await addFk('Bookings');
    await addFk('Clients');
    await addFk('ScheduleSettings');

    // 3) AvailableSlots: drop global unique(slotTime), add composite unique(practitionerId, slotTime)
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      // Best-effort: drop by conventional name if exists
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailableSlots_slotTime_key') THEN
            ALTER TABLE "AvailableSlots" DROP CONSTRAINT "AvailableSlots_slotTime_key";
          END IF;
        END $$;
      `);
    } else {
      // Generic try-catch for other dialects
      try { await queryInterface.removeConstraint('AvailableSlots', 'AvailableSlots_slotTime_key'); } catch (_) {}
    }

    try {
      await queryInterface.addConstraint('AvailableSlots', {
        type: 'unique',
        fields: ['practitionerId', 'slotTime'],
        name: 'available_slots_practitioner_slot_time_unique',
      });
    } catch (_) { /* constraint may already exist */ }

    // Helpful index for bookings by practitioner and time
    try {
      await queryInterface.addIndex('Bookings', ['practitionerId', 'slotTime'], {
        name: 'bookings_practitioner_slot_time_idx',
      });
    } catch (_) { /* index may already exist */ }

    // 4) Clients: drop global unique(tgUserId) to allow same tgUserId across different practitioners
    try {
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Clients_tgUserId_key') THEN
              ALTER TABLE "Clients" DROP CONSTRAINT "Clients_tgUserId_key";
            END IF;
          END $$;
        `);
      } else {
        await queryInterface.removeConstraint('Clients', 'Clients_tgUserId_key');
      }
    } catch (_) {
      // ignore if constraint name differs or doesn't exist
    }

    // Optionally, you could add a composite unique here: (practitionerId, tgUserId)
    try {
      await queryInterface.addConstraint('Clients', {
        type: 'unique',
        fields: ['practitionerId', 'tgUserId'],
        name: 'clients_practitioner_tguserid_unique',
      });
    } catch (_) { /* constraint may already exist */ }

    // 5) ScheduleSettings: ensure one schedule per practitioner
    try {
      await queryInterface.addConstraint('ScheduleSettings', {
        type: 'unique',
        fields: ['practitionerId'],
        name: 'schedule_settings_practitioner_unique',
      });
    } catch (_) { /* constraint may already exist */ }
  },

  async down(queryInterface, Sequelize) {
    // Revert ScheduleSettings unique
    try { await queryInterface.removeConstraint('ScheduleSettings', 'schedule_settings_practitioner_unique'); } catch (_) {}

    // Revert Clients unique
    try { await queryInterface.removeConstraint('Clients', 'clients_practitioner_tguserid_unique'); } catch (_) {}

    // Re-add global unique(tgUserId) if needed
    try {
      await queryInterface.addConstraint('Clients', {
        type: 'unique',
        fields: ['tgUserId'],
        name: 'Clients_tgUserId_key',
      });
    } catch (_) {}

    // AvailableSlots composite unique -> drop, bring back global unique(slotTime)
    try { await queryInterface.removeConstraint('AvailableSlots', 'available_slots_practitioner_slot_time_unique'); } catch (_) {}

    try {
      await queryInterface.addConstraint('AvailableSlots', {
        type: 'unique',
        fields: ['slotTime'],
        name: 'AvailableSlots_slotTime_key',
      });
    } catch (_) {}

    // Drop added indexes
    try { await queryInterface.removeIndex('Bookings', 'bookings_practitioner_slot_time_idx'); } catch (_) {}
    try { await queryInterface.removeIndex('AvailableSlots', 'available_slots_practitioner_slot_time_unique'); } catch (_) {}

    // Drop practitionerId columns
    for (const table of ['ScheduleSettings', 'Clients', 'Bookings', 'AvailableSlots']) {
      try { await queryInterface.removeColumn(table, 'practitionerId'); } catch (_) {}
    }

    // Drop Practitioners table
    await queryInterface.dropTable('Practitioners');

    // Cleanup ENUM types for Postgres
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Practitioners_plan') THEN
            DROP TYPE "enum_Practitioners_plan";
          END IF;
        END $$;
      `);
    }
  }
};
