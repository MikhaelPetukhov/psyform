module.exports = (sequelize, DataTypes) => {
  const CallSession = sequelize.define('CallSession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roomId: { type: DataTypes.STRING, allowNull: false },
    hostId: { type: DataTypes.UUID, allowNull: true },
    clientId: { type: DataTypes.UUID, allowNull: true },
    bookingId: { type: DataTypes.UUID, allowNull: true },
    practitionerId: { type: DataTypes.UUID, allowNull: false },
    startAt: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM('created','active','warning','ended','expired'), allowNull: false, defaultValue: 'created' },
  }, {
    indexes: [
      { fields: ['roomId'] },
      { fields: ['expiresAt'] },
      { fields: ['bookingId'] },
      { fields: ['practitionerId'] },
    ]
  });

  CallSession.associate = (models) => {
    CallSession.hasMany(models.JoinToken, { foreignKey: 'sessionId', as: 'tokens' });
    CallSession.hasMany(models.CallLog, { foreignKey: 'sessionId', as: 'logs' });
  };

  return CallSession;
};
