module.exports = (sequelize, DataTypes) => {
const dialect = sequelize.getDialect && sequelize.getDialect();
const isSqlite = dialect === 'sqlite';

const ScheduleSetting = sequelize.define('ScheduleSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Legacy fields
  slotTime: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '09:00:00',
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '18:00:00',
  },
  slotDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
  },
  breakDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15,
  },
  // New flexible fields
  // Use JSON for SQLite (stored as TEXT) and JSONB for Postgres
  workingDays: {
    type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
    allowNull: false,
    defaultValue: [1, 2, 3, 4, 5],
  },
  workingHours: {
    type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
    allowNull: false,
    defaultValue: { start: '09:00', end: '18:00' },
  },
  sessionDuration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
  },
  breakBetweenSessions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  generationPeriodDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  lunchBreak: {
    type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
    allowNull: false,
    defaultValue: { enabled: true, start: '13:00', end: '14:00' },
  },
  // Multi-tenant scope
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'ScheduleSettings',
  timestamps: true,
});

return ScheduleSetting;
};
