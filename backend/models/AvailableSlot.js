module.exports = (sequelize, DataTypes) => {

const AvailableSlot = sequelize.define('AvailableSlot', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  slotTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Start time in UTC (timestamptz)'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'End time in UTC (timestamptz)'
  },
  sourceTimezone: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Europe/Moscow',
    comment: 'Original timezone when slot was created'
  },
  isBooked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Multi-tenant scope
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: false, // Required for multi-tenant isolation
    references: {
      model: 'Practitioners',
      key: 'id'
    }
  },
}, {
  indexes: [
    {
      fields: ['practitionerId']
    },
    {
      fields: ['slotTime']
    },
    {
      fields: ['isBooked']
    },
    {
      fields: ['practitionerId', 'slotTime']
    }
  ]
});

return AvailableSlot;
};
