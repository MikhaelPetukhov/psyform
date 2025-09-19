module.exports = (sequelize, DataTypes) => {

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  clientTelegram: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Preferred contact method selected by client
  preferredContact: {
    type: DataTypes.ENUM('whatsapp', 'telegram', 'phone'),
    allowNull: false,
    defaultValue: 'phone',
  },
  // Whether the chosen contact was verified (e.g., WA exists, TG username resolved)
  contactVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Optional client comment from the booking form
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Telegram lookup persisted fields (resolved once at booking creation)
  telegramFound: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  telegramUserId: {
    // Telegram user IDs can exceed 32-bit; store as string to be safe
    type: DataTypes.STRING,
    allowNull: true,
  },
  telegramUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telegramFirstName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telegramLastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telegramAvatar: {
    // Base64-encoded small profile photo
    type: DataTypes.TEXT,
    allowNull: true,
  },
  telegramPhone: {
    // Sanitized phone returned by Telegram (digits only)
    type: DataTypes.STRING,
    allowNull: true,
  },
  // WhatsApp verification fields (if WA method was chosen)
  whatsappValid: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  whatsappWaId: {
    type: DataTypes.STRING,
    allowNull: true,
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
    comment: 'Original timezone when booking was created'
  },
  // Foreign key to the reserved AvailableSlot (optional association)
  AvailableSlotId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Link to Client (authorized via Telegram)
  clientId: {
    type: DataTypes.UUID,
    allowNull: true, // Can be null for admin-created bookings
    field: 'clientId', // колонка в БД в нижнем регистре
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled', 'completed'),
    defaultValue: 'confirmed',
  },
  // Client confirmation via bot inline buttons
  clientConfirmation: {
    type: DataTypes.ENUM('pending', 'confirmed', 'declined'),
    allowNull: false,
    defaultValue: 'pending',
  },
  // Reminder bookkeeping
  reminderSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Extended reminder flags
  reminder24hSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reminder1hSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Meeting link (video room)
  meetLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  source: {
    type: DataTypes.ENUM('online_form', 'manual'),
    defaultValue: 'online_form',
  },
  // Multi-tenant scope
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: false, // Required for multi-tenant isolation
  }
}, {
  indexes: [
    {
      fields: ['practitionerId']
    },
    {
      fields: ['slotTime']
    },
    {
      fields: ['clientId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['clientConfirmation']
    },
    {
      fields: ['practitionerId', 'slotTime']
    },
    {
      fields: ['reminder24hSentAt']
    },
    {
      fields: ['reminder1hSentAt']
    }
  ]
});

// Define associations
Booking.associate = function(models) {
  Booking.belongsTo(models.Client, {
    foreignKey: 'clientId',
    as: 'client'
  });
  Booking.belongsTo(models.Practitioner, {
    foreignKey: 'practitionerId',
    as: 'practitioner'
  });
  Booking.belongsTo(models.AvailableSlot, {
    foreignKey: 'AvailableSlotId',
    as: 'availableSlot'
  });
};

return Booking;
};
