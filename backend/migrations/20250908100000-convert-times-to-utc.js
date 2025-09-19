'use strict';

const { DateTime } = require('luxon');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Добавляем новые колонки с timezone информацией (если не существуют)
      const tablesInfo = await queryInterface.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'AvailableSlots' AND column_name = 'sourceTimezone'",
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );
      
      if (tablesInfo.length === 0) {
        await queryInterface.addColumn('AvailableSlots', 'sourceTimezone', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Europe/Moscow',
          comment: 'Исходный часовой пояс, в котором создан слот'
        }, { transaction });
      }
      
      const bookingsInfo = await queryInterface.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'Bookings' AND column_name = 'sourceTimezone'",
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );
      
      if (bookingsInfo.length === 0) {
        await queryInterface.addColumn('Bookings', 'sourceTimezone', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Europe/Moscow',
          comment: 'Исходный часовой пояс, в котором создана запись'
        }, { transaction });
      }

      // 2. Конвертируем существующие времена из Europe/Moscow в UTC
      console.log('Converting existing slot times from Europe/Moscow to UTC...');
      
      // Получаем все слоты
      const slots = await queryInterface.sequelize.query(
        'SELECT id, "slotTime", "endTime" FROM "AvailableSlots"',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );
      
      for (const slot of slots) {
        // Интерпретируем как Moscow время и конвертируем в UTC
        const slotTimeUTC = DateTime.fromJSDate(slot.slotTime, { zone: 'Europe/Moscow' }).toUTC();
        const endTimeUTC = DateTime.fromJSDate(slot.endTime, { zone: 'Europe/Moscow' }).toUTC();
        
        await queryInterface.sequelize.query(
          'UPDATE "AvailableSlots" SET "slotTime" = :slotTime, "endTime" = :endTime WHERE id = :id',
          {
            replacements: {
              id: slot.id,
              slotTime: slotTimeUTC.toJSDate(),
              endTime: endTimeUTC.toJSDate()
            },
            transaction
          }
        );
      }
      
      // Получаем все бронирования
      const bookings = await queryInterface.sequelize.query(
        'SELECT id, "slotTime", "endTime" FROM "Bookings"',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );
      
      for (const booking of bookings) {
        // Интерпретируем как Moscow время и конвертируем в UTC
        const slotTimeUTC = DateTime.fromJSDate(booking.slotTime, { zone: 'Europe/Moscow' }).toUTC();
        const endTimeUTC = DateTime.fromJSDate(booking.endTime, { zone: 'Europe/Moscow' }).toUTC();
        
        await queryInterface.sequelize.query(
          'UPDATE "Bookings" SET "slotTime" = :slotTime, "endTime" = :endTime WHERE id = :id',
          {
            replacements: {
              id: booking.id,
              slotTime: slotTimeUTC.toJSDate(),
              endTime: endTimeUTC.toJSDate()
            },
            transaction
          }
        );
      }
      
      // 3. Изменяем тип колонок на timestamptz для явного указания UTC
      await queryInterface.changeColumn('AvailableSlots', 'slotTime', {
        type: 'TIMESTAMPTZ',
        allowNull: false,
        comment: 'Время начала слота в UTC'
      }, { transaction });
      
      await queryInterface.changeColumn('AvailableSlots', 'endTime', {
        type: 'TIMESTAMPTZ',
        allowNull: false,
        comment: 'Время окончания слота в UTC'
      }, { transaction });
      
      await queryInterface.changeColumn('Bookings', 'slotTime', {
        type: 'TIMESTAMPTZ',
        allowNull: false,
        comment: 'Время начала записи в UTC'
      }, { transaction });
      
      await queryInterface.changeColumn('Bookings', 'endTime', {
        type: 'TIMESTAMPTZ',
        allowNull: false,
        comment: 'Время окончания записи в UTC'
      }, { transaction });
      
      // 4. Обновляем поля с reminder временами
      const reminderFields = ['reminderSentAt', 'reminder24hSentAt', 'reminder1hSentAt'];
      for (const field of reminderFields) {
        await queryInterface.changeColumn('Bookings', field, {
          type: 'TIMESTAMPTZ',
          allowNull: true,
          comment: `${field} в UTC`
        }, { transaction });
      }
      
      // 5. Обновляем системные поля createdAt/updatedAt
      const tables = ['AvailableSlots', 'Bookings', 'Clients', 'Practitioners', 'Users', 'ScheduleSettings'];
      for (const table of tables) {
        await queryInterface.changeColumn(table, 'createdAt', {
          type: 'TIMESTAMPTZ',
          allowNull: false,
          defaultValue: Sequelize.NOW
        }, { transaction });
        
        await queryInterface.changeColumn(table, 'updatedAt', {
          type: 'TIMESTAMPTZ',
          allowNull: false,
          defaultValue: Sequelize.NOW
        }, { transaction });
      }
      
      await transaction.commit();
      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Удаляем добавленные колонки
      await queryInterface.removeColumn('AvailableSlots', 'sourceTimezone', { transaction });
      await queryInterface.removeColumn('Bookings', 'sourceTimezone', { transaction });
      
      // Возвращаем обратно timestamp без timezone (но данные останутся в UTC)
      const tables = ['AvailableSlots', 'Bookings', 'Clients', 'Practitioners', 'Users', 'ScheduleSettings'];
      const timeFields = {
        'AvailableSlots': ['slotTime', 'endTime', 'createdAt', 'updatedAt'],
        'Bookings': ['slotTime', 'endTime', 'reminderSentAt', 'reminder24hSentAt', 'reminder1hSentAt', 'createdAt', 'updatedAt'],
        'Clients': ['createdAt', 'updatedAt'],
        'Practitioners': ['createdAt', 'updatedAt'],
        'Users': ['createdAt', 'updatedAt'],
        'ScheduleSettings': ['createdAt', 'updatedAt']
      };
      
      for (const table of tables) {
        const fields = timeFields[table];
        for (const field of fields) {
          await queryInterface.changeColumn(table, field, {
            type: Sequelize.DATE,
            allowNull: field.includes('reminder') ? true : false
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
