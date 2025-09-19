let dbReady = false;

function setDbReady(val) {
  dbReady = !!val;
}

function getDbReady() {
  return dbReady;
}

module.exports = { setDbReady, getDbReady };
