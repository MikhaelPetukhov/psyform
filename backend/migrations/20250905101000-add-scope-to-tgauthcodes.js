'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Add scope column with default 'client'
      await queryInterface.addColumn(
        'TgAuthCodes',
        'scope',
        {
          type: Sequelize.ENUM('client', 'admin'),
          allowNull: false,
          defaultValue: 'client',
        },
        { transaction: t }
      );

      // Optional index to filter by scope
      try {
        await queryInterface.addIndex('TgAuthCodes', ['scope'], { transaction: t });
      } catch (_) { /* ignore if fails */ }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      try {
        await queryInterface.removeIndex('TgAuthCodes', ['scope'], { transaction: t });
      } catch (_) { /* ignore */ }

      await queryInterface.removeColumn('TgAuthCodes', 'scope', { transaction: t });

      // Drop enum type in Postgres to avoid leftover
      try {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TgAuthCodes_scope";', { transaction: t });
      } catch (_) { /* ignore */ }
    });
  }
};
