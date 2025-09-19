'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Bookings', 'telegramFound', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Bookings', 'telegramUserId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Bookings', 'telegramUsername', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Bookings', 'telegramFirstName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Bookings', 'telegramLastName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Bookings', 'telegramAvatar', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Bookings', 'telegramPhone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Bookings', 'telegramPhone');
    await queryInterface.removeColumn('Bookings', 'telegramAvatar');
    await queryInterface.removeColumn('Bookings', 'telegramLastName');
    await queryInterface.removeColumn('Bookings', 'telegramFirstName');
    await queryInterface.removeColumn('Bookings', 'telegramUsername');
    await queryInterface.removeColumn('Bookings', 'telegramUserId');
    await queryInterface.removeColumn('Bookings', 'telegramFound');
  },
};
