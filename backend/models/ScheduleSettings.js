const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScheduleSettings = sequelize.define('ScheduleSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // e.g., [1, 2, 3, 4, 5] for Monday-Friday
  workingDays: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: false,
    defaultValue: [1, 2, 3, 4, 5], // Default to Mon-Fri
  },
  // e.g., '09:00'
  slotTime: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '10:00:00',
  },
  // e.g., '18:00'
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '18:00:00',
  },
  // Duration of each appointment in minutes
  slotDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60, // 60 minutes
  },
  // Break between appointments in minutes
  breakDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15, // 15 minutes
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

module.exports = ScheduleSettings;
