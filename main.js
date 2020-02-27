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
    label: 'Forbidden countries 2 character codes. Coma separated list. Ex: "US,FR,VN".',
    type: 'input',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'allowed_countries',
    label: 'Allowed countries 2 character codes. Coma separated list. If empty, all countries are allowed by default',
    type: 'input',
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
  if ( ip === null || ip === undefined ) {
    logger.error('Ip is not available. Pleaser check the peertube-plugin_georegister compatibility with your peertube version.')
    return result
  }

  const countries = await getCountries(logger, ip)
  // Here, countries is always an array. But it can be empty if getCountries failed.
  // In case of fail:
  // - if there is a whitelist, the user will be blocked
  // - else he will always be able to register

  // First, the white list.
  if ( allowed.length ) {
    if ( ! testCountries(logger, allowed, countries) ) {
      logger.info('Due to the allowed_countries, this user cannot signup. IP: ' + ip)
      return { allowed: false, errorMessage: errorMessage }
    }
  }

  // Then the blacklist
  if ( forbidden.length ) {
    if ( testCountries(logger, forbidden, countries) ) {
      logger.info('Due to the forbidden_countries, this user cannot signup. IP: ' + ip)
      return { allowed: false, errorMessage: errorMessage }
    }
  }

  return result
}

const countryRegex = RegExp('[A-Z]{2}')
async function readCountriesConf(logger, settingsManager, name) {
  const s = await settingsManager.getSetting(name)
  let a = s === undefined ? [] : s.split(/,/)
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
  let json
  try {
    json = await whois(ip, {follow: 3})
  } catch(err) {
    logger.error('The whois failed with error: ' + err)
    json = {}
  }
  // If a key is seen multiple times by whois-json, the result will be: "FR US"
  if ( ! ( 'country' in json ) ) {
    logger.debug('No country key in the result')
    return []
  }
  const countries = json.country.trim().split(/\s+/).map(c => c.toUpperCase())
  logger.debug('Countries for ip ' + ip + ' are: ' + countries.join(', '))
  return countries
}

function testCountries(logger, config, user) {
  for ( let i = 0; i < user.length; i++ ) {
    const c = user[i]
    if ( config.indexOf(c) >= 0 ) {
      logger.debug('The country ' + c + ' is found in the array')
      return true
    }
  }
  return false
}