module.exports = (sequelize, DataTypes) => {

const TgAuthCode = sequelize.define('TgAuthCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  codeHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  tgUserId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tgChatId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tgUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Multi-tenant scope (optional, set on first verification)
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Scope of the code: client (default) or admin
  scope: {
    type: DataTypes.ENUM('client', 'admin'),
    allowNull: false,
    defaultValue: 'client',
  },
}, {
  tableName: 'TgAuthCodes',
  timestamps: true,
});

return TgAuthCode;
};
