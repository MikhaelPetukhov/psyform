const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScheduleSetting = sequelize.define('ScheduleSetting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  workingDays: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: false,
    defaultValue: [1, 2, 3, 4, 5], // Mon-Fri
  },
  workingHours: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: { start: '09:00', end: '18:00' },
  },
  sessionDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60, // in minutes
  },
  breakBetweenSessions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10, // in minutes
  },
  lunchBreak: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: { enabled: true, start: '13:00', end: '14:00' },
  },
});

module.exports = ScheduleSetting;
