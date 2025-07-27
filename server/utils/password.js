const bcrypt = require('bcrypt');

const generatePasswordHash = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

const validatePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

module.exports = {
  generatePasswordHash,
  validatePassword
};