'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // preferredContact
    await queryInterface.addColumn('Bookings', 'preferredContact', {
      type: Sequelize.ENUM('whatsapp', 'telegram', 'phone'),
      allowNull: false,
      defaultValue: 'phone',
    });

    // contactVerified
    await queryInterface.addColumn('Bookings', 'contactVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // WhatsApp fields
    await queryInterface.addColumn('Bookings', 'whatsappValid', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.addColumn('Bookings', 'whatsappWaId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns in reverse order
    await queryInterface.removeColumn('Bookings', 'whatsappWaId');
    await queryInterface.removeColumn('Bookings', 'whatsappValid');
    await queryInterface.removeColumn('Bookings', 'contactVerified');

    // Drop ENUM then column if needed; for Postgres, ENUM type needs cleanup.
    await queryInterface.removeColumn('Bookings', 'preferredContact');

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      // Clean up ENUM type manually
      await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_Bookings_preferredContact\";");
    }
  }
};
