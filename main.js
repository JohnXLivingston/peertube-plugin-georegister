const whois = require('whois')

async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  peertubeHelpers
}) {
  registerSetting({
    name: 'forbidden_countries',
    label: 'Forbidden countries codes. Coma separated list. Ex: "US,RU"',
    type: 'input',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'allowed_countries',
    label: 'Allowed countries codes. Coma separated list. If empty, all countries are allowed by default',
    type: 'input',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'errorMessage',
    label: 'Error message',
    type: 'input',
    private: true,
    default: 'Your country is not allowed due to spam reasons. Please use the contact form.'
  })

  registerHook({
    target: 'filter:api.user.signup.allowed.result',
    handler: (result, params) => verifyIP(result, params, settingsManager, peertubeHelpers)
  })

}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

async function verifyIP(result, params, settingsManager, peertubeHelpers) {
  const logger = peertubeHelpers.logger
  logger.debug('Calling verifyIP...')
  if ( ! params || ! params.body ) {
    logger.debug('This is not a registration form submit. Ignoring.')
    return result;
  }

  if ( ! result ) {
    logger.error('The result parameter is falsey. This is unexpected. Check the peertube-plugin_georegister compatibility.')
    return result
  }
  if ( ! result.allowed ) {
    logger.debug('The registration is already refused.')
    return result
  }

  const allowed_setting = await settingsManager.getSetting('allowed_countries')
  const forbidden_setting = await settingsManager.getSetting('forbidden_countries')
  const allowed = allowed_setting === undefined ? [] : allowed_setting.split(/,/)
  const forbidden = forbidden_setting === undefined ? [] : forbidden_setting.split(/,/)
  if ( allowed.length === 0 && forbidden.length === 0 ) {
    logger.debug('No configuration for this plugin')
    return result
  }
  const errorMessage = await settingsManager.getSetting('errorMessage')

  const ip = params.ip
  if ( ip === null || ip === undefined ) {
    logger.error('Ip is not available. Pleaser check the peertube-plugin_georegister compatibility with your peertube version.')
    return result
  }

  logger.debug('The client IP is '+ip+'. Trying the Whois.')
  const p = new Promise()
  whois.lookup(ip, (err, data) => {
    if ( err ) {
      logger.error('The whois on '+ip+' failed. I will allow the regisration.')
      p.resolve(result)
      return
    }
    logger.debug('The whois return is:\n'+data)
    p.resolve({ allowed: false, errorMessage: errorMessage })
  })
  return await p
}
