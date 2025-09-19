"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Practitioners', 'publicSlug', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });

    // Fill existing rows with a derived value: form-<slug>, ensuring uniqueness
    const [rows] = await queryInterface.sequelize.query('SELECT id, slug FROM "Practitioners"');
    const used = new Set();
    for (const row of rows) {
      let base = `form-${String(row.slug || '').trim()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!base) base = 'form';
      let candidate = base; let i = 0;
      while (used.has(candidate)) { i += 1; candidate = `${base}-${i}`; }
      used.add(candidate);
      await queryInterface.sequelize.query('UPDATE "Practitioners" SET "publicSlug" = :slug WHERE id = :id', {
        replacements: { slug: candidate, id: row.id },
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Practitioners', 'publicSlug');
  }
};
