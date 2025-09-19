'use strict';
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 1. Remove existing admin user (if any)
    await queryInterface.bulkDelete('Users', { username: adminUsername });

    // 2. Create admin user with credentials from env
    await queryInterface.bulkInsert('Users', [{
      id: randomUUID(),
      username: adminUsername,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    // 3. Check if schedule settings exist
    const settings = await queryInterface.sequelize.query(
      `SELECT * FROM "ScheduleSettings"`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // 4. Create default settings if they don't exist
    if (settings.length === 0) {
      await queryInterface.bulkInsert('ScheduleSettings', [{
        // JSONB columns must receive JSON, not Postgres ARRAY literal
        workingDays: JSON.stringify([1, 2, 3, 4, 5]),      // Mon-Fri
        workingHours: JSON.stringify({ start: '09:00', end: '18:00' }),
        sessionDuration: 60,                 // 60 minutes
        breakBetweenSessions: 15,            // 15 minutes
        generationPeriodDays: 30,
        lunchBreak: JSON.stringify({ enabled: true, start: '13:00', end: '14:00' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }], {});
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', { username: 'admin' }, {});
    await queryInterface.bulkDelete('ScheduleSettings', null, {});
  },
};
