'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Practitioners', 'specialization', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Practitioners', 'price', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Practitioners', 'about', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Practitioners', 'clientMessageTemplate', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Practitioners', 'clientMessageTemplate');
    await queryInterface.removeColumn('Practitioners', 'about');
    await queryInterface.removeColumn('Practitioners', 'price');
    await queryInterface.removeColumn('Practitioners', 'specialization');
  }
};
