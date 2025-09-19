'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Add tgUserId (unique)
      try {
        await queryInterface.addColumn('Users', 'tgUserId', {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        }, { transaction: t });
      } catch (_) { /* column may already exist */ }

      // Add role enum
      try {
        await queryInterface.addColumn('Users', 'role', {
          type: Sequelize.ENUM('admin', 'super_admin'),
          allowNull: false,
          defaultValue: 'admin',
        }, { transaction: t });
      } catch (_) { /* column may already exist or enum exists */ }

      // Add practitionerId FK
      try {
        await queryInterface.addColumn('Users', 'practitionerId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Practitioners', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction: t });
      } catch (_) { /* column may already exist */ }

      try {
        await queryInterface.addIndex('Users', ['practitionerId'], { name: 'users_practitioner_idx', transaction: t });
      } catch (_) { /* ignore */ }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (t) => {
      try { await queryInterface.removeIndex('Users', 'users_practitioner_idx', { transaction: t }); } catch (_) {}
      try { await queryInterface.removeColumn('Users', 'practitionerId', { transaction: t }); } catch (_) {}
      try { await queryInterface.removeColumn('Users', 'tgUserId', { transaction: t }); } catch (_) {}
      try { await queryInterface.removeColumn('Users', 'role', { transaction: t }); } catch (_) {}
      // Cleanup ENUM type
      try { await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_role";', { transaction: t }); } catch (_) {}
    });
  }
};
