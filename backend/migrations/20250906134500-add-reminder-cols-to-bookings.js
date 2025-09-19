"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Bookings", "reminder24hSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("Bookings", "reminder1hSentAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Bookings", "reminder24hSentAt");
    await queryInterface.removeColumn("Bookings", "reminder1hSentAt");
  }
};
