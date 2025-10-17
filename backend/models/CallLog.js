module.exports = (sequelize, DataTypes) => {
  const CallLog = sequelize.define('CallLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sessionId: { type: DataTypes.UUID, allowNull: false },
    userHash: { type: DataTypes.STRING, allowNull: true },
    event: { type: DataTypes.STRING, allowNull: false },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  }, {
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['timestamp'] },
    ]
  });

  CallLog.associate = (models) => {
    CallLog.belongsTo(models.CallSession, { foreignKey: 'sessionId', as: 'session' });
  };

  return CallLog;
};
