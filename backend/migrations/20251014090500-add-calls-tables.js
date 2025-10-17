'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CallSessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      roomId: { type: Sequelize.STRING, allowNull: false },
      hostId: { type: Sequelize.UUID, allowNull: true },
      clientId: { type: Sequelize.UUID, allowNull: true },
      bookingId: { type: Sequelize.UUID, allowNull: true },
      practitionerId: { type: Sequelize.UUID, allowNull: false },
      startAt: { type: Sequelize.DATE, allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.ENUM('created','active','warning','ended','expired'), allowNull: false, defaultValue: 'created' },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('CallSessions', ['roomId']);
    await queryInterface.addIndex('CallSessions', ['expiresAt']);
    await queryInterface.addIndex('CallSessions', ['bookingId']);
    await queryInterface.addIndex('CallSessions', ['practitionerId']);

    await queryInterface.createTable('JoinTokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      sessionId: { type: Sequelize.UUID, allowNull: false, references: { model: 'CallSessions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      userId: { type: Sequelize.UUID, allowNull: true },
      role: { type: Sequelize.ENUM('host','guest'), allowNull: false },
      jwt: { type: Sequelize.TEXT, allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('JoinTokens', ['sessionId']);
    await queryInterface.addIndex('JoinTokens', ['expiresAt']);

    await queryInterface.createTable('CallLogs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      sessionId: { type: Sequelize.UUID, allowNull: false, references: { model: 'CallSessions', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      userHash: { type: Sequelize.STRING, allowNull: true },
      event: { type: Sequelize.STRING, allowNull: false },
      timestamp: { type: Sequelize.DATE, allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('CallLogs', ['sessionId']);
    await queryInterface.addIndex('CallLogs', ['timestamp']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CallLogs');
    await queryInterface.dropTable('JoinTokens');
    await queryInterface.dropTable('CallSessions');
    // Cleanup ENUM types to prevent dangling types in Postgres
    try { await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_JoinTokens_role"'); } catch (_) {}
    try { await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CallSessions_status"'); } catch (_) {}
  }
};
