<p align="center">
  <img src="client/src/components/arkiv.svg" alt="arkiv" height="96">
</p>

<p align="center"><b>a shared photo archive, pinned to the globe.</b></p>

<p align="center"><a href="https://aaarkivvv.vercel.app">aaarkivvv.vercel.app</a> · <a href="docs/design-system.md">design system</a></p>

---

## the idea

anyone can add a photo with a name, a short caption, the day it was taken and a pin where it happened. each one becomes a dot on a spinning globe. click a dot to open the moment, and follow the thin lines to other photos taken on the same day or by the same person.

## features

- **explore:** a 3d globe of every photo. hover a dot to see its name, click it to open a card, and expand the photo full screen with its full caption.
- **connections:** link dots by **date** (photos from the same day) or by **author** (one person's photos as a trail in date order), then step through them with the arrows.
- **upload:** drag a photo in, browse for one or take one with your camera. add a name, your name, a caption and a date, then drop a pin on the globe. phones get a two-step form.
- **fits the screen:** the explore card and the upload form are built to fit desktop and phone screens without scrolling.

## how it's built

| part | tool |
| --- | --- |
| front end | react (create react app) |
| globe | mapbox gl js, globe projection, recoloured at runtime to the brand palette |
| photo hosting | cloudinary (unsigned uploads straight from the browser) |
| database | mongodb atlas via mongoose |
| api | a vercel serverless function (`api/markers.js`) |
| hosting | vercel |
| type | abc areal and abc areal mono by dinamo |

uploads go from the browser to cloudinary first. the returned image url, the text fields and the pin's coordinates are then posted to `/api/markers` and saved to mongodb. the globe reads the same endpoint back as geojson.

```
api/markers.js         serverless api: GET returns geojson, POST saves a photo entry
server.js              local-only express wrapper around the same handler
vercel.json            build, output and spa rewrite settings
client/src/
  components/          Landing, Map (explore), UploadForm, LocationPicker, CameraCapture, About, Header
  styles/tokens.css    design tokens: colours, radii, fonts, motion
  styles/mapTheme.js   applies the brand colours to the mapbox style
```

## run it locally

you need node 18+, a mongodb atlas connection string and a public mapbox token.

```bash
npm install
npm install --prefix client
```

create two env files (both are git-ignored; see the `.env.example` files):

```bash
# .env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>

# client/.env
REACT_APP_MAPBOX_TOKEN=pk.your_public_mapbox_token
```

then start the api (port 5001) and the client (port 3000) in two terminals:

```bash
npm start
```

```bash
npm start --prefix client
```

open http://localhost:3000. the client proxies `/api` calls to the local api.

## deploy

the repo deploys to vercel as is. `vercel.json` installs both packages, builds the client into `client/build` and serves `api/` as serverless functions. set `MONGO_URI` and `REACT_APP_MAPBOX_TOKEN` in the vercel project's environment variables.

## credits

made by **aalok sud**: [portfolio](https://www.aalok.space/?view=creative-technology) · [github](https://github.com/aalokok)

typeface: abc areal by [dinamo](https://abcdinamo.com).
