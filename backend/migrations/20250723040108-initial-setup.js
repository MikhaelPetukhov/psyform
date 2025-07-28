'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable('ScheduleSettings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      workingDays: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: false,
        defaultValue: [1, 2, 3, 4, 5],
      },
      // Legacy compatibility fields
      slotTime: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '09:00:00',
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '18:00:00',
      },
      slotDuration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      breakDuration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 15,
      },

      workingHours: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { start: '09:00', end: '18:00' },
      },
      sessionDuration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      breakBetweenSessions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10,
      },
      lunchBreak: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { enabled: true, start: '13:00', end: '14:00' },
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

    await queryInterface.createTable('AvailableSlots', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      slotTime: {
        type: Sequelize.DATE,
        allowNull: false,
        unique: true,
      },
      endTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      isBooked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.createTable('Bookings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      clientName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      clientPhone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      clientEmail: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      slotTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('confirmed', 'cancelled', 'completed'),
        defaultValue: 'confirmed',
      },
      endTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      source: {
        type: Sequelize.ENUM('online_form', 'manual'),
        defaultValue: 'online_form',
      },
      AvailableSlotId: {
        type: Sequelize.UUID,
        references: {
          model: 'AvailableSlots',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Bookings');
    await queryInterface.dropTable('AvailableSlots');
    await queryInterface.dropTable('ScheduleSettings');
    await queryInterface.dropTable('Users');
  }
};
