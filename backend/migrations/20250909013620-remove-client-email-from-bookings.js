'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop clientEmail column if it exists
    const table = await queryInterface.describeTable('Bookings');
    if (table.clientEmail) {
      await queryInterface.removeColumn('Bookings', 'clientEmail');
    }
  },

  async down(queryInterface, Sequelize) {
    // Recreate clientEmail column (nullable)
    const table = await queryInterface.describeTable('Bookings');
    if (!table.clientEmail) {
      await queryInterface.addColumn('Bookings', 'clientEmail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  }
};
