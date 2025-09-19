module.exports = (sequelize, DataTypes) => {

const Practitioner = sequelize.define('Practitioner', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Public slug for admin panel routes like /psychologist/:slug (based on Telegram username)
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  // Separate public slug for booking page like /p/:publicSlug
  publicSlug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  displayName: {
    type: DataTypes.STRING,
    allowNull: false, // Required for practitioner identification
  },
  // Subscription plan
  plan: {
    type: DataTypes.ENUM('free', 'pro'),
    allowNull: false,
    defaultValue: 'free',
  },
  // Telegram linkage for psychologist admin identity
  tgUserId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  tgUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgChatId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tgPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  specialization: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  about: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  clientMessageTemplate: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Timezone for the practitioner (IANA timezone)
  timezone: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Europe/Moscow',
    validate: {
      isValidTimezone(value) {
        try {
          // Test if it's a valid IANA timezone
          Intl.DateTimeFormat(undefined, { timeZone: value });
        } catch (e) {
          throw new Error('Invalid timezone');
        }
      }
    }
  },
}, {
  tableName: 'Practitioners',
  timestamps: true,
});

// Define associations
Practitioner.associate = function(models) {
  Practitioner.hasMany(models.Booking, {
    foreignKey: 'practitionerId',
    as: 'bookings'
  });
  Practitioner.hasMany(models.Client, {
    foreignKey: 'practitionerId',
    as: 'clients'
  });
  Practitioner.hasMany(models.AvailableSlot, {
    foreignKey: 'practitionerId',
    as: 'availableSlots'
  });
};

return Practitioner;
};
