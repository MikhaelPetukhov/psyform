const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AvailableSlot = sequelize.define('AvailableSlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  slotTime: {
    type: DataTypes.DATE,
    allowNull: false,
    unique: true, // Each slot time must be unique
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isBooked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

module.exports = AvailableSlot;
