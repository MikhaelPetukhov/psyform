'use strict';
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ensure Practitioners table exists and insert default practitioner if missing
    try {
      await queryInterface.describeTable('Practitioners');
    } catch (e) {
      // Table not found — nothing to seed
      return;
    }

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM "Practitioners" WHERE slug = :slug LIMIT 1`,
      { replacements: { slug: 'mikhael' } }
    );

    if (!rows || rows.length === 0) {
      const id = randomUUID();
      await queryInterface.bulkInsert('Practitioners', [{
        id,
        slug: 'mikhael',
        displayName: 'Mikhael',
        plan: 'free',
        tgUserId: null,
        tgUsername: null,
        tgPhone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.bulkDelete('Practitioners', { slug: 'mikhael' });
    } catch (_) {}
  },
};
