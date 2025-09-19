'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect && queryInterface.sequelize.getDialect();

    await queryInterface.sequelize.transaction(async (t) => {
      if (dialect === 'postgres') {
        // Drop existing default (array) to avoid type conflicts
        await queryInterface.sequelize.query(
          'ALTER TABLE "ScheduleSettings" ALTER COLUMN "workingDays" DROP DEFAULT;',
          { transaction: t }
        );

        // Convert int[] to jsonb array
        await queryInterface.sequelize.query(
          'ALTER TABLE "ScheduleSettings" ALTER COLUMN "workingDays" TYPE jsonb USING to_jsonb("workingDays");',
          { transaction: t }
        );

        // Set new JSONB default
        await queryInterface.sequelize.query(
          "ALTER TABLE \"ScheduleSettings\" ALTER COLUMN \"workingDays\" SET DEFAULT '[1,2,3,4,5]'::jsonb;",
          { transaction: t }
        );
      } else {
        // Fallback for other dialects (e.g. sqlite in dev) – use JSON type
        await queryInterface.changeColumn(
          'ScheduleSettings',
          'workingDays',
          {
            type: Sequelize.JSON,
            allowNull: false,
            defaultValue: [1, 2, 3, 4, 5],
          },
          { transaction: t }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect && queryInterface.sequelize.getDialect();

    await queryInterface.sequelize.transaction(async (t) => {
      if (dialect === 'postgres') {
        // Drop JSONB default first
        await queryInterface.sequelize.query(
          'ALTER TABLE "ScheduleSettings" ALTER COLUMN "workingDays" DROP DEFAULT;',
          { transaction: t }
        );

        // Convert jsonb array back to integer[]
        await queryInterface.sequelize.query(
          `ALTER TABLE "ScheduleSettings"
           ALTER COLUMN "workingDays" TYPE integer[]
           USING (
             CASE
               WHEN jsonb_typeof("workingDays") = 'array' THEN
                 (SELECT COALESCE(array_agg(value::int), ARRAY[]::integer[])
                    FROM jsonb_array_elements_text("workingDays") AS value)
               ELSE ARRAY[]::integer[]
             END
           );`,
          { transaction: t }
        );

        // Restore integer[] default
        await queryInterface.sequelize.query(
          'ALTER TABLE "ScheduleSettings" ALTER COLUMN "workingDays" SET DEFAULT ARRAY[1,2,3,4,5]::integer[];',
          { transaction: t }
        );
      } else {
        // Fallback: revert to TEXT holding JSON string (approximation)
        await queryInterface.changeColumn(
          'ScheduleSettings',
          'workingDays',
          {
            type: Sequelize.TEXT,
            allowNull: false,
            defaultValue: JSON.stringify([1, 2, 3, 4, 5]),
          },
          { transaction: t }
        );
      }
    });
  },
};
