'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ScheduleSettings', 'generationPeriodDays', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ScheduleSettings', 'generationPeriodDays');
  },
};
