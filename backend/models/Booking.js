const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true, 
    validate: {
      isEmail: true,
    },
  },
  slotTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled', 'completed'),
    defaultValue: 'confirmed',
  },
  source: {
    type: DataTypes.ENUM('online_form', 'manual'),
    defaultValue: 'online_form',
  }
});

module.exports = Booking;
