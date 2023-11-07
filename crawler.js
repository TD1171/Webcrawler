// const axios = require('axios');
// const jsdom = require("jsdom");
// const { JSDOM } = jsdom;
// const prompt = require("prompt-sync")();
// const robotsParser = require("robots-parser")
// const fs = require('fs').promises;


// const start = prompt("Please enter the URL you wish to start from: ");
// const max = prompt("Please enter the max number of pages you wish to index: ");
// console.log(start);
// console.log(max);
// search(start, max);


const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const prompt = require('prompt-sync')();
const fs = require('fs');
const robotsParser = require('robots-parser');
const app = express();
const port = 3001;
const cheerio = require('cheerio');
let crawledPages = [];
const crawlUrl = prompt('Enter the URL to crawl: ');

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/search', async (req, res) => {
  const apiKey = 'k123'; 
  const { key, s, count = 10 } = req.query;

 
  if (key !== apiKey) {
    res.status(403).json({ error: 'Invalid key' });
    return;
  }

  
  const searchResults = await crawl(crawlUrl, s, count);

  
  const response = {
    results: searchResults.length,
    keyword: s,
    results: searchResults,
  };

  res.json(response);
});
async function computeScore(html, searchValue) {
  const $ = cheerio.load(html);
  const tags = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'b', 'strong', 'i', 'em', 'a', 'p'];
  const tagCounts = {};

  tags.forEach(tag => {
    const count = $(tag).text().match(new RegExp(searchValue, 'gi'))?.length || 0;
    tagCounts[tag] = count;
  });

  const score = Object.values(tagCounts).reduce((acc, count) => acc + count, 0);

  const dict = {
    title: $('title').text(),
    score: score
  };

  return dict;
}
async function robot(url) {
  const robotsTxtUrl = new URL('/robots.txt', url);
  const response = await axios.get(robotsTxtUrl.href);
  const robotsTxt = response.data;
  const robots = robotsParser(robotsTxt, url.href);
  const isAllowed = await robots.isAllowed(url.href);
  return isAllowed;
}
async function isLinkFollowable(link) {
  const response = await fetch(link);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const relValue = link.getAttribute('rel');
  if (relValue && relValue.toLowerCase().indexOf('nofollow') !== -1) {
    return false;
  }

  return true;
}
async function crawl(crawlUrl, searchValue, maxPages) {
  const visited = new Set();
  const stack = [crawlUrl];
  const crawledPages = [];
  let numPages = 0;

  const robotsUrl = `${new URL(crawlUrl).origin}/robots.txt`;
  const { data: robotsTxt } = await axios.get(robotsUrl);
  const robots = robotsParser(robotsUrl, robotsTxt);

  while (stack.length > 0 && numPages < maxPages) {
    const nextUrl = stack.shift();
    if (visited.has(nextUrl)) continue;

    visited.add(nextUrl);
    console.log(nextUrl)
    console.log(numPages);
    try {
      const { data: html } = await axios.get(nextUrl);
      const dom = new JSDOM(html);
      const metaTag = dom.window.document.querySelector(`meta[name='robots']`);

      if (metaTag && (metaTag.content.includes('noindex') || metaTag.content.includes('nofollow'))) continue;
      if (!robots.isAllowed(nextUrl)) continue;


      const dict = {
        url: nextUrl,
        score: 0
      };
      dict.score = (await computeScore(html, searchValue)).score;

      await fs.promises.appendFile('out.json', JSON.stringify(dict) + '\n');
      crawledPages.push(dict);
      numPages++;
      await new Promise(r => setTimeout(r, 1500));
      
      const hrefTags = Array.from(dom.window.document.querySelectorAll('a')).map(a => a.getAttribute('href'));
      const relTags = Array.from(dom.window.document.querySelectorAll('a')).map(a => a.getAttribute('rel'));
      
      for (let i = 0; i < hrefTags.length; i++) {
        const linkedUrl = new URL(hrefTags[i], nextUrl).href;
        console.log(linkedUrl);
        if (visited.has(linkedUrl) || !robots.isAllowed(linkedUrl) || (relTags[i] && relTags[i].includes('noindex'))) continue;
        stack.push(linkedUrl);
      }
    } catch (e) {
      console.error
    }
  }

  return crawledPages;
}


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
//old crawl method
async function search(url, maxPages) {
    const visited = new Set([]);
    const queue = [url];
    let numPages = 0;
    let robots = null;
    const filename = "info.json";
    await fs.writeFile(filename, '');
    console.log(filename);
  
    while (queue.length > 0 && numPages < maxPages) {
      const nextUrl = queue.shift();
      console.log(nextUrl);
      console.log(queue.length);
  
      if (visited.has(nextUrl)) continue;
  
  
      visited.add(nextUrl);
      console.log(nextUrl);
      numPages++;
      console.log(numPages);
  
      // checker = await noIndexPageChecker(nextUrl);
      robots = await fetchRobots(nextUrl, robots);
      title = await fetchTitle(nextUrl);
      tf = await isPageCrawlable(nextUrl);
      console.log(tf);
      console.log(title);
      const html = await fetchHtml(nextUrl); 
      if (!isAllowed(nextUrl, robots) || html === null) {
        continue;
      }
  
  
      const links = await fetchLinks(html, nextUrl);
  
  
      for (const l of links) {
        if (visited.has(l) || !isAllowed(l, robots)) continue;
        queue.push(l);
        
      }
  
  
      const pageData = {
        url: nextUrl,
        date: new Date().toISOString(),
        content: html
      };
      await appendPageDataToFile(pageData, filename);
  
  
      await delay(1000);
    }
    console.log(visited)
    console.log(numPages);
  }
  async function fetchTitle(url) {
    let title = null;
    try {
      const response = await axios.get(url);
      const dom = new JSDOM(response.data);
      title = dom.window.document.querySelector('title').textContent;
    } catch (error) {
      console.error(`Failed to fetch ${url}: ${error}`);
    }
    return title;
}
async function fetchTitle(url) {
  let title = null;
  try {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    title = dom.window.document.querySelector('title').textContent;
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error}`);
  }
  return title;
}
async function noIndexPageChecker(url) {
  const response = await fetch(url);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const metaRobots = doc.querySelector('meta[name="robots"][content*="noindex"]');
  if (metaRobots) {
    const links = doc.querySelectorAll('a');
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (link.href.indexOf(url) !== 0) {
        return false;
      }
    }
    return true;
  } else {
    return true;
  }
}
async function fetchRobots(url, robots) {
  if (robots !== null) return robots;


  const baseurl = new URL(start).origin;
  const robotsUrl = `${baseurl}/robots.txt`;


  try {
    const robotsHtml = await axios.get(robotsUrl);
    robots = robotsParser(robotsUrl, robotsHtml.data);
  } catch (error) {
    console.error(`Failed to fetch ${robotsUrl}: ${error}`);
  }


  return robots;
}

async function isPageCrawlable(url) {
  const robotsTxtUrl = new URL('/robots.txt', url);
  const response = await fetch(robotsTxtUrl.href);
  const robotsTxt = await response.text();
  const { isAllowed } = await robotsParser(robotsTxt, url.href);
  return isAllowed;
}
async function fetchHtml(url) {
  let html = null;
  try {
    const response = await axios.get(url);
    html = response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error}`);
  }
  return html;
}


async function fetchLinks(html, baseUrl) {
  const dom = new JSDOM(html);
  const links = Array.from(dom.window.document.querySelectorAll('a')).map(a => a.href);
  const rels = Array.from(dom.window.document.querySelectorAll('a')).map(a => a.getAttribute('rel'));
  const result = [];
  for (let i = 0; i < links.length; i++) {
    const l = new URL(links[i], baseUrl).href;
    if (rels[i] !== null && rels[i].includes("noindex")) continue;
    result.push(l);
  }
  return result;
}


async function appendPageDataToFile(pageData, filename) {
  await fs.appendFile(filename, JSON.stringify(pageData) + '\n');
}


function isAllowed(url, robots) {
  if (robots !== null && !robots.isAllowed(url)) return false;
  return true;
}


async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
