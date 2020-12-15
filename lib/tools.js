const axios = require('axios');

/**
 * Tests whether the given variable is a real object and not an Array
 * @param {any} it The variable to test
 * @returns {it is Record<string, any>}
 */
function isObject(it) {
  // This is necessary because:
  // typeof null === 'object'
  // typeof [] === 'object'
  // [] instanceof Object === true
  return Object.prototype.toString.call(it) === '[object Object]';
}

/**
 * Tests whether the given variable is really an Array
 * @param {any} it The variable to test
 * @returns {it is any[]}
 */
function isArray(it) {
  if (Array.isArray !== null) {
    return Array.isArray(it);
  }

  return Object.prototype.toString.call(it) === '[object Array]';
}

/**
 * Translates text using the Google Translate API
 * @param {string} text The text to translate
 * @param {string} targetLang The target languate
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang) {
  if (targetLang === 'en') {
    return text;
  }

  try {
    const url = `http://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
    const response = await axios({url, timeout: 5000});
    if (isArray(response.data)) {
      // We got a valid response
      return response.data[0][0][0];
    }

    throw new Error('Invalid response for translate request');
  } catch (error) {
    throw new Error(`Could not translate to "${targetLang}": ${error}`);
  }
}

module.exports = {
  isArray,
  isObject,
  translateText
};
