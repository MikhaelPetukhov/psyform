module.exports = (sequelize, DataTypes) => {
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Telegram admin linkage (optional)
  tgUserId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  role: {
    type: DataTypes.ENUM('admin', 'super_admin'),
    allowNull: false,
    defaultValue: 'admin',
  },
  practitionerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
});

User.beforeCreate(async (user) => {
  const salt = await bcrypt.genSalt(10);
  // Ensure password exists; fallback to random if not provided
  const plain = user.password && typeof user.password === 'string' && user.password.length > 0
    ? user.password
    : crypto.randomBytes(24).toString('hex');
  user.password = await bcrypt.hash(plain, salt);
});

User.prototype.isValidPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

return User;
};
