'use strict';

const gulp = require('gulp');
const fs = require('fs');
const pkg = require('./package.json');
const iopackage = require('./io-package.json');
const version = (pkg && pkg.version) ? pkg.version : iopackage.common.version;
const fileName = 'words.js';
const EMPTY = '';
const translate = require('./lib/tools.js').translateText;
const languages = {
  en: {},
  de: {},
  ru: {},
  pt: {},
  nl: {},
  fr: {},
  it: {},
  es: {},
  pl: {},
  'zh-cn': {}
};

function lang2data(lang, isFlat) {
  let string = isFlat ? '' : '{\n';
  let count = 0;
  for (const w in lang) {
    if (lang.hasOwnProperty(w)) {
      count++;
      if (isFlat) {
        string += (lang[w] === '' ? (isFlat[w] || w) : lang[w]) + '\n';
      } else {
        const key = '    "' + w.replace(/"/g, '\\"') + '": ';
        string += key + '"' + lang[w].replace(/"/g, '\\"') + '",\n';
      }
    }
  }

  if (!count) {
    return isFlat ? '' : '{\n}';
  }

  if (isFlat) {
    return string;
  }

  return string.slice(0, Math.max(0, string.length - 2)) + '\n}';
}

function readWordJs(src) {
  try {
    let words;
    words = fs.existsSync(src + 'js/' + fileName) ? fs.readFileSync(src + 'js/' + fileName).toString() : fs.readFileSync(src + fileName).toString();

    words = words.substring(words.indexOf('{'), words.length);
    words = words.slice(0, Math.max(0, words.lastIndexOf(';')));

    const resultFunc = new Function('return ' + words + ';');

    return resultFunc();
  } catch {
    return null;
  }
}

function padRight(text, totalLength) {
  return text + (text.length < totalLength ? new Array(totalLength - text.length).join(' ') : '');
}

function writeWordJs(data, src) {
  let text = '';
  text += '/*global systemDictionary:true */\n';
  text += '\'use strict\';\n\n';
  text += 'systemDictionary = {\n';
  for (const word in data) {
    if (data.hasOwnProperty(word)) {
      text += '    ' + padRight('"' + word.replace(/"/g, '\\"') + '": {', 50);
      let line = '';
      for (const lang in data[word]) {
        if (data[word].hasOwnProperty(lang)) {
          line += '"' + lang + '": "' + padRight(data[word][lang].replace(/"/g, '\\"') + '",', 50) + ' ';
        }
      }

      if (line) {
        line = line.trim();
        line = line.slice(0, Math.max(0, line.length - 1));
      }

      text += line + '},\n';
    }
  }

  text += '};';
  if (fs.existsSync(src + 'js/' + fileName)) {
    fs.writeFileSync(src + 'js/' + fileName, text);
  } else {
    fs.writeFileSync(String(src) + fileName, text);
  }
}

function words2languages(src) {
  const langs = Object.assign({}, languages);
  const data = readWordJs(src);
  if (data) {
    for (const word in data) {
      if (data.hasOwnProperty(word)) {
        for (const lang in data[word]) {
          if (data[word].hasOwnProperty(lang)) {
            langs[lang][word] = data[word][lang];
            //  Pre-fill all other languages
            for (const j in langs) {
              if (langs.hasOwnProperty(j)) {
                langs[j][word] = langs[j][word] || EMPTY;
              }
            }
          }
        }
      }
    }

    if (!fs.existsSync(src + 'i18n/')) {
      fs.mkdirSync(src + 'i18n/');
    }

    for (const l in langs) {
      if (!langs.hasOwnProperty(l)) {
        continue;
      }

      const keys = Object.keys(langs[l]);
      keys.sort();
      const object = {};
      for (const key of keys) {
        object[key] = langs[l][key];
      }

      if (!fs.existsSync(src + 'i18n/' + l)) {
        fs.mkdirSync(src + 'i18n/' + l);
      }

      fs.writeFileSync(src + 'i18n/' + l + '/translations.json', lang2data(object));
    }
  } else {
    console.error('Cannot read or parse ' + fileName);
  }
}

function words2languagesFlat(src) {
  const langs = Object.assign({}, languages);
  const data = readWordJs(src);
  if (data) {
    for (const word in data) {
      if (data.hasOwnProperty(word)) {
        for (const lang in data[word]) {
          if (data[word].hasOwnProperty(lang)) {
            langs[lang][word] = data[word][lang];
            //  Pre-fill all other languages
            for (const j in langs) {
              if (langs.hasOwnProperty(j)) {
                langs[j][word] = langs[j][word] || EMPTY;
              }
            }
          }
        }
      }
    }

    const keys = Object.keys(langs.en);
    keys.sort();
    for (const l in langs) {
      if (!langs.hasOwnProperty(l)) {
        continue;
      }

      const object = {};
      for (const key of keys) {
        object[key] = langs[l][key];
      }

      langs[l] = object;
    }

    if (!fs.existsSync(src + 'i18n/')) {
      fs.mkdirSync(src + 'i18n/');
    }

    for (const ll in langs) {
      if (!langs.hasOwnProperty(ll)) {
        continue;
      }

      if (!fs.existsSync(src + 'i18n/' + ll)) {
        fs.mkdirSync(src + 'i18n/' + ll);
      }

      fs.writeFileSync(src + 'i18n/' + ll + '/flat.txt', lang2data(langs[ll], langs.en));
    }

    fs.writeFileSync(src + 'i18n/flat.txt', keys.join('\n'));
  } else {
    console.error('Cannot read or parse ' + fileName);
  }
}

function languagesFlat2words(src) {
  const dirs = fs.readdirSync(src + 'i18n/');
  const langs = {};
  const bigOne = {};
  const order = Object.keys(languages);
  dirs.sort((a, b) => {
    const posA = order.indexOf(a);
    const posB = order.indexOf(b);
    if (posA === -1 && posB === -1) {
      if (a > b) {
        return 1;
      }

      if (a < b) {
        return -1;
      }

      return 0;
    }

    if (posA === -1) {
      return -1;
    }

    if (posB === -1) {
      return 1;
    }

    if (posA > posB) {
      return 1;
    }

    if (posA < posB) {
      return -1;
    }

    return 0;
  });
  const keys = fs.readFileSync(src + 'i18n/flat.txt').toString().split('\n');

  for (const lang of dirs) {
    if (lang === 'flat.txt') {
      continue;
    }

    const values = fs.readFileSync(src + 'i18n/' + lang + '/flat.txt').toString().split('\n');
    langs[lang] = {};
    keys.forEach((word, i) => {
      langs[lang][word] = values[i];
    });

    const words = langs[lang];
    for (const word in words) {
      if (words.hasOwnProperty(word)) {
        bigOne[word] = bigOne[word] || {};
        if (words[word] !== EMPTY) {
          bigOne[word][lang] = words[word];
        }
      }
    }
  }

  // Read actual words.js
  const aWords = readWordJs();

  const temporaryIgnore = new Set(['flat.txt']);
  if (aWords) {
    // Merge words together
    for (const w in aWords) {
      if (aWords.hasOwnProperty(w)) {
        if (!bigOne[w]) {
          console.warn('Take from actual words.js: ' + w);
          bigOne[w] = aWords[w];
        }

        dirs.forEach(lang => {
          if (temporaryIgnore.has(lang)) {
            return;
          }

          if (!bigOne[w][lang]) {
            console.warn('Missing "' + lang + '": ' + w);
          }
        });
      }
    }
  }

  writeWordJs(bigOne, src);
}

function languages2words(src) {
  const dirs = fs.readdirSync(src + 'i18n/');
  const langs = {};
  const bigOne = {};
  const order = Object.keys(languages);
  dirs.sort((a, b) => {
    const posA = order.indexOf(a);
    const posB = order.indexOf(b);
    if (posA === -1 && posB === -1) {
      if (a > b) {
        return 1;
      }

      if (a < b) {
        return -1;
      }

      return 0;
    }

    if (posA === -1) {
      return -1;
    }

    if (posB === -1) {
      return 1;
    }

    if (posA > posB) {
      return 1;
    }

    if (posA < posB) {
      return -1;
    }

    return 0;
  });
  for (const lang of dirs) {
    if (lang === 'flat.txt') {
      continue;
    }

    langs[lang] = fs.readFileSync(src + 'i18n/' + lang + '/translations.json').toString();
    langs[lang] = JSON.parse(langs[lang]);
    const words = langs[lang];
    for (const word in words) {
      if (words.hasOwnProperty(word)) {
        bigOne[word] = bigOne[word] || {};
        if (words[word] !== EMPTY) {
          bigOne[word][lang] = words[word];
        }
      }
    }
  }

  // Read actual words.js
  const aWords = readWordJs();

  const temporaryIgnore = new Set(['flat.txt']);
  if (aWords) {
    // Merge words together
    for (const w in aWords) {
      if (aWords.hasOwnProperty(w)) {
        if (!bigOne[w]) {
          console.warn('Take from actual words.js: ' + w);
          bigOne[w] = aWords[w];
        }

        dirs.forEach(lang => {
          if (temporaryIgnore.has(lang)) {
            return;
          }

          if (!bigOne[w][lang]) {
            console.warn('Missing "' + lang + '": ' + w);
          }
        });
      }
    }
  }

  writeWordJs(bigOne, src);
}

async function translateNotExisting(object, baseText) {
  let t = object.en;
  if (!t) {
    t = baseText;
  }

  if (t) {
    for (const l in languages) {
      if (!object[l]) {
        object[l] = await translate(t, l);
      }
    }
  }
}

// TASKS

gulp.task('adminWords2languages', done => {
  words2languages('./admin/');
  done();
});

gulp.task('adminWords2languagesFlat', done => {
  words2languagesFlat('./admin/');
  done();
});

gulp.task('adminLanguagesFlat2words', done => {
  languagesFlat2words('./admin/');
  done();
});

gulp.task('adminLanguages2words', done => {
  languages2words('./admin/');
  done();
});

gulp.task('updatePackages', done => {
  iopackage.common.version = pkg.version;
  iopackage.common.news = iopackage.common.news || {};
  if (!iopackage.common.news[pkg.version]) {
    const news = iopackage.common.news;
    const newNews = {};

    newNews[pkg.version] = {
      en: 'news',
      de: 'neues',
      ru: 'новое',
      pt: 'novidades',
      nl: 'nieuws',
      fr: 'nouvelles',
      it: 'notizie',
      es: 'noticias',
      pl: 'nowości',
      'zh-cn': '新'
    };
    iopackage.common.news = Object.assign(newNews, news);
  }

  fs.writeFileSync('io-package.json', JSON.stringify(iopackage, null, 4));
  done();
});

gulp.task('updateReadme', done => {
  const readme = fs.readFileSync('README.md').toString();
  const pos = readme.indexOf('## Changelog\n');
  if (pos !== -1) {
    const readmeStart = readme.slice(0, Math.max(0, pos + '## Changelog\n'.length));
    const readmeEnd = readme.slice(Math.max(0, pos + '## Changelog\n'.length));

    if (!readme.includes(version)) {
      const timestamp = new Date();
      const date = timestamp.getFullYear() + '-' +
                    ('0' + (timestamp.getMonth() + 1).toString(10)).slice(-2) + '-' +
                    ('0' + (timestamp.getDate()).toString(10)).slice(-2);

      let news = '';
      if (iopackage.common.news && iopackage.common.news[pkg.version]) {
        news += '* ' + iopackage.common.news[pkg.version].en;
      }

      fs.writeFileSync('README.md', readmeStart + '### ' + version + ' (' + date + ')\n' + (news ? news + '\n\n' : '\n') + readmeEnd);
    }
  }

  done();
});

gulp.task('translate', async done => {
  if (iopackage && iopackage.common) {
    if (iopackage.common.news) {
      for (const k in iopackage.common.news) {
        const nw = iopackage.common.news[k];
        await translateNotExisting(nw);
      }
    }

    if (iopackage.common.titleLang) {
      await translateNotExisting(iopackage.common.titleLang, iopackage.common.title);
    }

    if (iopackage.common.desc) {
      await translateNotExisting(iopackage.common.desc);
    }

    if (fs.existsSync('./admin/i18n/en/translations.json')) {
      const enTranslations = require('./admin/i18n/en/translations.json');
      for (const l in languages) {
        let existing = {};
        if (fs.existsSync('./admin/i18n/' + l + '/translations.json')) {
          existing = require('./admin/i18n/' + l + '/translations.json');
        }

        for (const t in enTranslations) {
          if (!existing[t]) {
            existing[t] = await translate(enTranslations[t], l);
          }
        }

        if (!fs.existsSync('./admin/i18n/' + l + '/')) {
          fs.mkdirSync('./admin/i18n/' + l + '/');
        }

        fs.writeFileSync('./admin/i18n/' + l + '/translations.json', JSON.stringify(existing, null, 4));
      }
    }
  }

  fs.writeFileSync('io-package.json', JSON.stringify(iopackage, null, 4));
});

gulp.task('translateAndUpdateWordsJS', gulp.series('translate', 'adminLanguages2words'));

gulp.task('default', gulp.series('updatePackages', 'updateReadme'));
