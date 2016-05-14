/*eslint no-console: ["allow"]*/

const async = require('async');
const tagPageLinks = require('./util').tagPageLinks;
const contentLinks = require('./util').contentLinks;
const extractor = require('./../a');
const fs = require('fs');

const WORKERS = 8;
const train = JSON.parse(fs.readFileSync('./../train.json', { encoding: 'utf8' }));

const extractorQueue = async.queue((link, callback) => {
  console.log(`⛏  extracting ${decodeURI(link)}...`);
  extractor(link, { selector: '.article_content' })
    .then((words) => {
      for (const word in words) {
        if ({}.hasOwnProperty.call(words, word) === true) {
          train[word] = train.hasOwnProperty(word) ? train[word] + words[word] : words[word];
        }
      }

      console.log(`✅  done extracting from ${decodeURI(link)}`);
      callback();
    })
    .catch((err) => {
      callback(err);
    });
}, WORKERS);

extractorQueue.drain = () => {
  fs.writeFile('./../train.txt', Object.keys(train).join('\n'), (err) => {
    if (err) console.error(err);
  });

  fs.writeFile('./../train.json', JSON.stringify(train), (err) => {
    if (err) console.error(err);
  });
};

// queue for extracting content links from `pageLink`
const contentLinkQueue = async.queue((pageLink, callback) => {
  contentLinks(pageLink, 'http://www.ethiopianreporter.com')
    .then((cLinks) => {
      cLinks.forEach((cLink) => {
        extractorQueue.push(cLink);
      });

      callback();
    })
    .catch((err) => {
      callback(err);
    });
}, WORKERS);

// queue for extracting pages from `tagLink`
const tagPageLinkQueue = async.queue((tagLink, callback) => {
  tagPageLinks(tagLink)
    .then((tPageLinks) => {
      tPageLinks.forEach((tPageLink) => {
        contentLinkQueue.push(tPageLink);
      });

      callback();
    })
    .catch((err) => {
      callback(err);
    });
}, WORKERS);

process.argv.forEach((arg, index) => {
  if (index > 1) {
    tagPageLinkQueue.push(arg);
  }
});
