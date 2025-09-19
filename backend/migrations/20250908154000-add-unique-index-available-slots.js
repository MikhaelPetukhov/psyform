'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Deduplicate rows by (practitionerId, slotTime, endTime) keeping the earliest created
    try {
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY "practitionerId", "slotTime", "endTime" ORDER BY COALESCE("createdAt", NOW()) ASC) AS rn
          FROM "AvailableSlots"
        )
        DELETE FROM "AvailableSlots" a
        USING ranked r
        WHERE a.id = r.id AND r.rn > 1;
      `);
    } catch (e) { /* ignore */ }

    // Unique index on (practitionerId, slotTime, endTime)
    await queryInterface.addIndex('AvailableSlots', ['practitionerId', 'slotTime', 'endTime'], {
      name: 'available_slots_unique_practitioner_time',
      unique: true,
    });

    // Optional partial index for Postgres to speed lookups of open slots
    try {
      const dialect = queryInterface.sequelize.getDialect();
      if (dialect === 'postgres') {
        await queryInterface.sequelize.query(
          'CREATE INDEX IF NOT EXISTS available_slots_open_idx ON "AvailableSlots" ("practitionerId", "slotTime") WHERE "isBooked" = false;'
        );
      }
    } catch (e) {
      // Ignore if partial index not supported
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('AvailableSlots', 'available_slots_unique_practitioner_time');
    } catch (_) {}

    try {
      const dialect = queryInterface.sequelize.getDialect();
      if (dialect === 'postgres') {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS available_slots_open_idx;');
      }
    } catch (e) {}
  }
};
