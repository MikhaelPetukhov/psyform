"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1) Load existing practitioners and build a set of already used public slugs
      const [rows] = await queryInterface.sequelize.query('SELECT id, slug, "publicSlug" FROM "Practitioners"', { transaction });

      const normalize = (input) => {
        const s = String(input || '')
          .toLowerCase()
          .trim()
          .replace(/[@_]+/g, '-')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        return s || 'form';
      };

      const used = new Set();
      for (const r of rows) {
        if (r.publicSlug) used.add(String(r.publicSlug));
      }

      // 2) Backfill missing/empty publicSlug using normalized slug and ensure uniqueness
      for (const r of rows) {
        let current = (r.publicSlug || '').trim();
        if (!current) {
          let base = normalize(r.slug || 'practitioner');
          let candidate = base;
          let i = 0;
          while (used.has(candidate)) { i += 1; candidate = `${base}-${i}`; }
          used.add(candidate);
          await queryInterface.sequelize.query(
            'UPDATE "Practitioners" SET "publicSlug" = :slug WHERE id = :id',
            { transaction, replacements: { slug: candidate, id: r.id } }
          );
        }
      }

      // 3) Enforce NOT NULL
      await queryInterface.changeColumn(
        'Practitioners',
        'publicSlug',
        {
          type: Sequelize.STRING,
          allowNull: false,
        },
        { transaction }
      );

      // 4) Ensure UNIQUE constraint (if not already created by previous migration)
      try {
        await queryInterface.addConstraint('Practitioners', {
          fields: ['publicSlug'],
          type: 'unique',
          name: 'Practitioners_publicSlug_unique',
          transaction,
        });
      } catch (_) { /* constraint may already exist – ignore */ }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  },

  async down(queryInterface, Sequelize) {
    // Relax NOT NULL back to NULLABLE. Keep unique as it existed earlier.
    await queryInterface.changeColumn('Practitioners', 'publicSlug', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // We intentionally do not drop the UNIQUE constraint in down.
  }
};
