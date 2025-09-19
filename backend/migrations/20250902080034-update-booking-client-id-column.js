'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename the column from ClientId to clientId if needed
    const table = await queryInterface.describeTable('Bookings');
    if (table.ClientId && !table.clientId) {
      await queryInterface.renameColumn('Bookings', 'ClientId', 'clientId');
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert the column name back to ClientId if needed
    const table = await queryInterface.describeTable('Bookings');
    if (table.clientId && !table.ClientId) {
      await queryInterface.renameColumn('Bookings', 'clientId', 'ClientId');
    }
  }
}
