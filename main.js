const whois = require('whois-json')

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
    label: 'Forbidden countries 2 character codes (US, FR, ...). One per line.',
    type: 'input-textarea',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'allowed_countries',
    label: 'Allowed countries 2 character codes (US, FR, ...). One per line. If empty, all countries are allowed by default',
    type: 'input-textarea',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'error_message',
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

  const allowed = await readCountriesConf(logger, settingsManager, 'allowed_countries')
  const forbidden = await readCountriesConf(logger, settingsManager, 'forbidden_countries')
  if ( allowed.length === 0 && forbidden.length === 0 ) {
    logger.debug('No configuration for this plugin')
    return result
  }
  const errorMessage = await settingsManager.getSetting('error_message')

  const ip = params.ip
  //const ip = '50.122.1.12'
  if ( ip === null || ip === undefined ) {
    logger.error('Ip is not available. Pleaser check the peertube-plugin_georegister compatibility with your peertube version.')
    return result
  }

  const countries = await getCountries(logger, ip)
  if ( ! countries.length ) {
    logger.error('Cant find country for ip ' + ip + ', I will allow the registration.')
    return result
  }

  // First, the white list.
  // TODO

  return result
  //return { allowed: false, errorMessage: errorMessage }
}

const countryRegex = RegExp('[A-Z]{2}')
async function readCountriesConf(logger, settingsManager, name) {
  const s = await settingsManager.getSetting(name)
  let a = s === undefined ? [] : s.split(/\n/)
  a = a.map(c => c.trim().toUpperCase())
  a = a.filter(c => c != '')

  const invalid = a.filter(c => ! countryRegex.test(c))
  if ( invalid.length ) {
    logger.error('There are invalid countries in ' + name + ': '. join(', ', invalid))
    a = a.filter(c => countryRegex.test(c))
  }

  logger.debug('Countries in conf ' + name + ' are: ' + a.join(', '))
  return a
}

async function getCountries(logger, ip) {
  // Note: there might be several countries in whois informations. So this function returns an array.
  logger.debug('The client IP is ' + ip + '. Trying the Whois.')
  const json = await whois(ip, {follow: 3})
  // If a key is seen multiple times by whois-json, the result will be: "FR US"
  if ( ! ( 'country' in json ) ) {
    logger.debug('No country key in the result')
    return []
  }
  return json.country.trim().split(/\s+/)
}
