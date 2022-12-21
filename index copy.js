const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const puppeteer = require("puppeteer");
const http = require("http");
const url = require("url");
const ytdl = require("ytdl-core");
const app = express();
app.use(cors());

function string_to_slug(str) {
  str = str.replace(/^\s+|\s+$/g, ""); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to = "aaaaeeeeiiiioooouuuunc------";
  for (var i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes

  return str;
}

async function searchTonokira(term) {
  let browser = await puppeteer.launch({ headless: true });
  let page = await browser.newPage();
  await page.goto(`https://tononkira.serasera.org/tononkira?lohateny=${term}`);
  let video_details = await page.evaluate(() => {
    var lists = document.querySelectorAll("#main .border");
    let items = Array.from(lists);
    let infos = items.map((item, index) => {
      if (index > 0) {
        let title = item.querySelector("a:nth-child(1)").innerText;
        let link = item.querySelector("a:nth-child(1)").getAttribute("href");
        let artist = item.querySelector("a:nth-child(2)").innerText;
        return { id: index, title, link, artist };
      }
    });
    return infos;
  });
  return video_details;
}
async function getTonokira(url) {
  let browser = await puppeteer.launch({ headless: true });
  let page = await browser.newPage();
  await page.goto(`${url}`);
  let tonokira = await page.evaluate(() => {
    document.querySelector("#main .col-md-8 .border-bottom").remove();
    document.querySelector("#main .col-md-8 .print").remove();
    document.querySelector("#main .col-md-8 .no-print").remove();
    document.querySelector("#main .col-md-8 .text-end").remove();
    let content = document.querySelector("#main .col-md-8").innerHTML;
    let breakContent = content.replace(/<br\s*\\?>/g, "\n");
    let removeLinks = breakContent.replace(/(?:https?|ftp):\/\/[\n\S]+/g, "");
    let removeLast = removeLinks.replace("--------", "");
    let splitContent = removeLast
      .split("\n")
      .map(function (s) {
        return s.replace(/^\s*|\s*$/g, "");
      })
      .filter(function (x) {
        return x;
      });
    let contentFormatted = splitContent.splice(0, splitContent.length - 1);
    return contentFormatted.join(" ");
  });
  await browser.close();
  return tonokira;
}
async function scrapeVideoFromYoutube(term) {
  let browser = await puppeteer.launch({ headless: true });
  let page = await browser.newPage();
  await page.goto(`https://www.youtube.com/results?search_query=${term}`);
  let video_details = await page.evaluate(() => {
    let videos = document.querySelectorAll("ytd-video-renderer");
    let video_items = Array.from(videos);
    let infos = video_items.map((video) => {
      let title = video.querySelector("a[id='video-title']").innerText;
      let id = video
        .querySelector("a[id='video-title']")
        .getAttribute("href")
        .replace("/watch?v=", "");
      return {
        id,
        original_title: title,
        artist: title,
        duration: null,
        publishedAt: new Date(),
      };
    });
    return infos;
  });
  await browser.close();
  return video_details;
}

app.get("/", (req, res) => {
  res.send("api ikalo");
});
app.get("/youtube/search", async (req, res) => {
  await scrapeVideoFromYoutube(string_to_slug(req.query.q))
    .then((v) => res.json({ videos: v }))
    .catch((err) => {
      console.log(err);
      return;
    });
});
app.get("/youtube/stream/", async (req, res, next) => {
  let data;
  let filterURL;

  try {
    data = await ytdl.getInfo(
      "https://www.youtube.com/watch?v=" + req.query.videoId
    );
  } catch (err) {
    next(err);
    return;
  }

  try {
    filterURL = ytdl.chooseFormat(data.formats, {
      filter: "audioonly",
      quality: "highest",
    }).url;
  } catch (err) {
    next(err);
    return;
  }

  res.json({
    url: filterURL,
  });
});

app.get("/tonokira/search", async (req, res) => {
  let paroles = [];
  await searchTonokira(string_to_slug(req.query.q))
    .then((v) => {
      res.json(v);
    })
    .catch((err) => {
      console.log(err);
      res.json({
        error: err.message,
      });
    });
});

app.get("/tonokira/get", async (req, res) => {
  let url = req.query.url;
  await getTonokira(url)
    .then((response) => {
      console.log(response);
      res.json(response);
    })
    .catch((err) => {
      console.log(err);
      res.json({
        error: err,
      });
    });
});
const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});
