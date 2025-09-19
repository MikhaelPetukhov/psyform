'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add timezone field to Practitioners
    await queryInterface.addColumn('Practitioners', 'timezone', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Europe/Moscow',
      comment: 'IANA timezone identifier for the practitioner'
    });

    // Update existing practitioners to have Moscow timezone
    await queryInterface.sequelize.query(`
      UPDATE "Practitioners" SET timezone = 'Europe/Moscow' WHERE timezone IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove timezone field
    await queryInterface.removeColumn('Practitioners', 'timezone');
  }
};
