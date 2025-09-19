'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Clients table
    await queryInterface.createTable('Clients', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      tgUserId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      tgChatId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tgUsername: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tgPhone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      avatar: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // TgAuthCodes table
    await queryInterface.createTable('TgAuthCodes', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      codeHash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      tgUserId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tgChatId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tgUsername: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tgPhone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      usedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add fields to Bookings
    await queryInterface.addColumn('Bookings', 'ClientId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Clients',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('Bookings', 'clientConfirmation', {
      type: Sequelize.ENUM('pending', 'confirmed', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    });

    await queryInterface.addColumn('Bookings', 'reminderSentAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Bookings', 'meetLink', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Bookings', 'meetLink');
    await queryInterface.removeColumn('Bookings', 'reminderSentAt');
    await queryInterface.removeColumn('Bookings', 'clientConfirmation');
    await queryInterface.removeColumn('Bookings', 'ClientId');

    // Drop enum type for Postgres if exists
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Bookings_clientConfirmation') THEN
            DROP TYPE "enum_Bookings_clientConfirmation";
          END IF;
        END $$;
      `);
    }

    await queryInterface.dropTable('TgAuthCodes');
    await queryInterface.dropTable('Clients');
  },
};
