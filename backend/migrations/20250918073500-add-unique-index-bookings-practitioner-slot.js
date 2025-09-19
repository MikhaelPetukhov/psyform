'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Deduplicate by (practitionerId, slotTime), keep earliest created
    try {
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY "practitionerId", "slotTime" ORDER BY COALESCE("createdAt", NOW()) ASC) AS rn
          FROM "Bookings"
        )
        DELETE FROM "Bookings" b
        USING ranked r
        WHERE b.id = r.id AND r.rn > 1;
      `);
    } catch (e) { /* ignore */ }

    await queryInterface.addIndex('Bookings', ['practitionerId', 'slotTime'], {
      name: 'bookings_unique_practitioner_slot',
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('Bookings', 'bookings_unique_practitioner_slot');
    } catch (_) {}
  }
};
