'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make clientPhone optional
    await queryInterface.changeColumn('Bookings', 'clientPhone', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Enforce NOT NULL on slotTime and endTime
    await queryInterface.changeColumn('Bookings', 'slotTime', {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn('Bookings', 'endTime', {
      type: Sequelize.DATE,
      allowNull: false,
    });

    // Add comment column
    await queryInterface.addColumn('Bookings', 'comment', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert comment column
    await queryInterface.removeColumn('Bookings', 'comment');

    // Revert NOT NULL constraints
    await queryInterface.changeColumn('Bookings', 'slotTime', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.changeColumn('Bookings', 'endTime', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Make clientPhone required again
    await queryInterface.changeColumn('Bookings', 'clientPhone', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
