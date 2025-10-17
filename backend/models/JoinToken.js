module.exports = (sequelize, DataTypes) => {
  const JoinToken = sequelize.define('JoinToken', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sessionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: true },
    role: { type: DataTypes.ENUM('host','guest'), allowNull: false },
    jwt: { type: DataTypes.TEXT, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['expiresAt'] },
    ]
  });

  JoinToken.associate = (models) => {
    JoinToken.belongsTo(models.CallSession, { foreignKey: 'sessionId', as: 'session' });
  };

  return JoinToken;
};
