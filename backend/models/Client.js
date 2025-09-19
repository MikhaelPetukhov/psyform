module.exports = (sequelize, DataTypes) => {

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
  tgPhone: {
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
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Preferred timezone persisted across devices
  clientTimezone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Multi-tenant scope
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'Clients',
  timestamps: true,
});

// Define associations
Client.associate = function(models) {
  Client.hasMany(models.Booking, {
    foreignKey: 'clientId',
    as: 'bookings'
  });
  Client.belongsTo(models.Practitioner, {
    foreignKey: 'practitionerId',
    as: 'practitioner'
  });
};

return Client;
};
