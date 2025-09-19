'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix practitionerId constraints - make them NOT NULL where required
    await queryInterface.changeColumn('AvailableSlots', 'practitionerId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'Practitioners',
        key: 'id'
      }
    });

    await queryInterface.changeColumn('Bookings', 'practitionerId', {
      type: Sequelize.UUID,
      allowNull: false
    });

    // Fix displayName in Practitioners - make it NOT NULL
    await queryInterface.changeColumn('Practitioners', 'displayName', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // Fix price field - change from STRING to DECIMAL with explicit USING for Postgres
    // 1) Pre-normalize any non-numeric characters just in case
    await queryInterface.sequelize.query(`
      UPDATE "Practitioners"
      SET "price" = NULLIF(regexp_replace(COALESCE("price"::text, ''), '[^0-9\.-]', '', 'g'), '')
      WHERE "price" IS NOT NULL;
    `);
    // 2) Convert type with USING cast
    await queryInterface.sequelize.query(`
      ALTER TABLE "Practitioners"
      ALTER COLUMN "price" TYPE DECIMAL(10,2)
      USING NULLIF("price"::text, '')::DECIMAL(10,2);
    `);
    // 3) Ensure nullability as intended (allowNull: true)
    await queryInterface.sequelize.query(`
      ALTER TABLE "Practitioners" ALTER COLUMN "price" DROP NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert changes
    await queryInterface.changeColumn('AvailableSlots', 'practitionerId', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.changeColumn('Bookings', 'practitionerId', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.changeColumn('Practitioners', 'displayName', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Revert DECIMAL back to TEXT/STRING safely
    await queryInterface.sequelize.query(`
      ALTER TABLE "Practitioners"
      ALTER COLUMN "price" TYPE TEXT
      USING "price"::TEXT;
    `);
  }
};
