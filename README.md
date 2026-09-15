# StopBoard

A static, responsive departure board inspired by Swiss public transport displays. It has two themes:

- `cff` (default): clean red-and-white Swiss railway styling.
- `tpg`: the blue/violet route treatment and red header inspired by the supplied TPG display.
- `tl`: a blue-and-yellow Lausanne TL-inspired display.
- `travys`: a deep-blue and yellow TRAVYS-inspired display for the Vaud region.
- `zvv`: a cobalt-blue and yellow Zurich ZVV-inspired display.

## Run

No build step is needed. Open `index.html` directly, or serve this folder with any static web server:

```sh
npx serve .
```

## URL parameters

The board is configured through query parameters:

```text
index.html?theme=tpg&stop_id=ch%3A1%3Asloid%3A92122&kiosk=1
```

`theme` accepts `cff`, `tpg`, `tl`, `travys`, or `zvv`. Use repeated `stop_id` parameters when stop order matters; the first stop is rendered first. Full OJP references such as `ch:1:sloid:92122` are supported:

For the Zurich office at Thurgauerstrasse 101A in Glattpark/Opfikon, start with the nearby ZVV stop **Glattpark** and pass its SLOID returned by the OJP StopFinder API:

```text
index.html?theme=zvv&stop_id=ch%3A1%3Asloid%3AYOUR_GLATTPARK_SLOID&kiosk=1&token=YOUR_OJP20_TOKEN
```

```text
index.html?theme=tpg&stop_id=ch%3A1%3Asloid%3A92122&stop_id=ch%3A1%3Asloid%3A93165&token=YOUR_OJP20_TOKEN
```

The legacy comma-separated `stops` parameter is also supported. A line is shown only at its first configured stop, so repeated line numbers at subsequent stops are hidden.

The app uses the official OpenTransportData Swiss OJP StopEvent API by default. Pass the API key from the API Manager using `token`:

```text
index.html?theme=tpg&stops=8593165,8592791&token=YOUR_API_KEY
```

The endpoint can be overridden with `endpoint`, but the default is `https://api.opentransportdata.swiss/ojp20` (OJP 2.0). API keys are exposed in browser URLs and requests, so this frontend-only approach is suitable only for a restricted key. The API must also allow browser CORS requests.

Use `kiosk=1` for unattended TV operation. It hides the refresh control, refreshes automatically every minute, preserves the last successful board during network failures, and reports the last successful update time.

The original TPG timetable configuration uses these stop place references:

- `8593165`: the stop used for line 10
- `8592791`: the stop used for lines 14 and 18

The original application additionally filters requests by line references `ojp:92010:H`, `ojp:91018:`, and `ojp:91014:D`.
