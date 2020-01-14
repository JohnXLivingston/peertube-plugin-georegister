async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager
}) {
  registerSetting({
    name: 'countries',
    label: 'Countries codes. Coma separated list. Ex: "US,RU"',
    type: 'input',
    private: true,
    default: ''
  })

  registerHook({
    target: "filter:api.user.signup.allowed.result",
    handler: (result, params) => verifyIP(result, params, settingsManager)
  })

}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

async function verifyIP(result, params, settingsManager) {

}
