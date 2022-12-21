const express = require("express");
const ytdl = require("ytdl-core");
const app = express();
const ytsr = require("@distube/ytsr");
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
function convertDurationtoSeconds(duration){
  const [minutes, seconds] = duration.split(':');
  return Number(minutes) * 60 + Number(seconds);
};
app.get("/", (req, res) => {
  res.json("ping,pong");
});

app.get("/youtube/search", async (req, res) => {
  try {
    let search = await ytsr(string_to_slug(req.query.q), {
      safeSearch: true,
      limit: 10,
    }).then((result) => {
      let videos = [];
      if (result.items.length > 0) {
        result.items.forEach((video) => {
          videos.push({
            id: video.id,
            original_title: video.name,
            img: video.thumbnail,
            duration: convertDurationtoSeconds(video.duration),
          });
        });
      }
      return videos;
    });
    res.json({ videos: search });
  } catch (error) {
    res.json({
      videos: [],
    });
  }
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

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});
