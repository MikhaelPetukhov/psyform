'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TgAuthCodes', 'practitionerId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Practitioners',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('TgAuthCodes', ['practitionerId'], {
      name: 'tgauthcodes_practitioner_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    try { await queryInterface.removeIndex('TgAuthCodes', 'tgauthcodes_practitioner_idx'); } catch (_) {}
    await queryInterface.removeColumn('TgAuthCodes', 'practitionerId');
  },
};
