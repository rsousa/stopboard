const params = new URLSearchParams(window.location.search);
const requestedTheme = params.get("theme");
const theme = ["cff", "tpg", "tl", "travys"].includes(requestedTheme) ? requestedTheme : "cff";
const stopIds = params.getAll("stop_id").length
  ? params.getAll("stop_id").map((stop) => stop.trim()).filter(Boolean)
  : (params.get("stops") || "").split(",").map((stop) => stop.trim()).filter(Boolean);
const apiEndpoint = params.get("endpoint") || "https://api.opentransportdata.swiss/ojp20";
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.kiosk = params.get("kiosk") === "1" ? "true" : "false";
if (theme !== "cff") document.querySelector("#page-title").textContent = `${theme === "travys" ? "TRAVYS" : theme.toUpperCase()} public transport`;

const stopsElement = document.querySelector("#stops");
const statusElement = document.querySelector("#status-text");
const updatedElement = document.querySelector("#updated");
let renderedData = [];
let lastSuccessfulUpdate = null;

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function tick() {
  const now = new Date();
  document.querySelector("#today").textContent = formatDate(now);
  document.querySelector("#clock-time").textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function formatMode(value) {
  const mode = String(value).toLowerCase();
  if (mode.includes("tram")) return "Tram";
  if (mode.includes("bus")) return "Bus";
  if (mode.includes("train") || mode.includes("rail")) return "Train";
  return "Service";
}

function render(data) {
  renderedData = data;
  stopsElement.innerHTML = data.map((stop) => `
    <section class="stop">
      <header class="stop-heading">
        <div class="stop-name"><span class="pin" aria-hidden="true">●</span>${escapeHtml(stop.name)}</div>
        <span class="stop-id">${escapeHtml(stop.id || "")}</span>
      </header>
      ${stop.departures.length ? groupDeparturesByLine(stop.departures).map((line) => `
        <article class="line-entry">
          <div class="line-summary">
            <span class="line-badge route-${escapeHtml(line.line)}">${escapeHtml(line.line)}<span class="line-mode">${escapeHtml(line.mode || "service")}</span></span>
            <span class="mode-icon ${line.mode.toLowerCase().includes("tram") ? "tram-icon" : "bus-icon"}" aria-hidden="true">${modeIcon(line.mode)}</span>
          </div>
          <div class="line-directions">
            ${line.departures.map((departure) => `
              <div class="direction-row">
                <div class="direction-copy">
                  <div class="destination">${escapeHtml(departure.destination)}</div>
                  ${departure.via ? `<div class="via">${escapeHtml(departure.via)}</div>` : ""}
                </div>
                <div class="times" aria-label="Departure times">${departure.times.map((time, index) => `<span class="time ${index === 0 ? "soon" : ""}">${escapeHtml(time)}</span>`).join("")}</div>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("") : `<div class="empty">No upcoming departures found.</div>`}
    </section>
  `).join("");
}

function groupDeparturesByLine(departures) {
  const lines = new Map();
  departures.forEach((departure) => {
    const line = lines.get(departure.line) || { line: departure.line, mode: departure.mode || "service", departures: [] };
    line.departures.push(departure);
    lines.set(departure.line, line);
  });
  return [...lines.values()];
}

function modeIcon(mode) {
  if (mode.toLowerCase().includes("tram")) {
    return '<img src="https://icons.app.sbb.ch/picto/tram-left.svg" alt="" loading="eager">';
  }
  return '<img src="https://icons.app.sbb.ch/picto/bus-left.svg" alt="" loading="eager">';
}

function normalizeDestination(value) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function filterTpgStop(stop, index) {
  if (theme !== "tpg") return stop;
  const allowedLines = index === 0 ? new Set(["10"]) : new Set(["14", "18"]);
  const unique = new Map();
  stop.departures
    .filter((departure) => allowedLines.has(departure.line))
    .forEach((departure) => {
      const key = `${departure.line}|${departure.direction || normalizeDestination(departure.destination)}`;
      const existing = unique.get(key);
      if (existing) {
        existing.times = [...new Set([...existing.times, ...departure.times])];
        existing.timeValues = [...new Set([...existing.timeValues, ...departure.timeValues])].sort((first, second) => first - second);
      } else {
        unique.set(key, { ...departure, times: [...departure.times], timeValues: [...departure.timeValues] });
      }
    });
  return { ...stop, departures: [...unique.values()] };
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[character]));
}

function stopReference(value) {
  return value.startsWith("ch:") ? value : `ch:1:sloid:${value}`;
}

function createStopEventRequest(stopId) {
  const timestamp = new Date().toISOString();
  return `<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
    <OJPRequest><siri:ServiceRequest>
      <siri:ServiceRequestContext><siri:Language>en</siri:Language></siri:ServiceRequestContext>
      <siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp><siri:RequestorRef>StopBoard</siri:RequestorRef>
      <OJPStopEventRequest><siri:RequestTimestamp>${timestamp}</siri:RequestTimestamp>
        <Location><PlaceRef><StopPlaceRef>${escapeXml(stopReference(stopId).replace("ch:1:sloid:", ""))}</StopPlaceRef><Name><Text /></Name></PlaceRef><DepArrTime>${timestamp}</DepArrTime></Location>
        <Params><NumberOfResults>10</NumberOfResults><StopEventType>departure</StopEventType><IncludePreviousCalls>false</IncludePreviousCalls><IncludeOnwardCalls>false</IncludeOnwardCalls><UseRealtimeData>full</UseRealtimeData></Params>
      </OJPStopEventRequest>
    </siri:ServiceRequest></OJPRequest>
  </OJP>`;
}

function parseOjpResponse(xml, stopId) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The transport API returned invalid XML");
  const problem = [...document.getElementsByTagName("*")].find((node) => node.localName === "StopEventProblemType")?.textContent?.trim();
  if (problem === "STOPEVENT_NOEVENTFOUND") return { name: stopId, id: stopId, departures: [] };
  const events = [...document.getElementsByTagName("*")].filter((node) => node.localName === "StopEventResult");
  const grouped = new Map();
  events.forEach((event) => {
    const nodes = [...event.getElementsByTagName("*")];
    const text = (names) => nodes.find((node) => names.includes(node.localName))?.textContent?.trim() || "";
    const time = text(["EstimatedTime"]) || text(["TimetabledTime"]);
    const line = text(["PublicCode", "PublishedServiceName", "PublishedLineName", "LineName"]) || "?";
    const direction = text(["DirectionRef"]);
    const destination = text(["DestinationText", "DestinationName"]) || "Unknown destination";
    const key = `${line}|${direction || normalizeDestination(destination)}`;
    if (!time) return;
    const departure = grouped.get(key) || { line, direction, mode: formatMode(text(["PtMode", "Mode"])), destination, times: [], timeValues: [] };
    departure.times.push(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date(time)));
    departure.timeValues.push(new Date(time).getTime());
    grouped.set(key, departure);
  });
  const nameNode = [...document.getElementsByTagName("*")].find((node) => ["StopPlaceName", "StopPointName", "StopName", "PlaceName"].includes(node.localName));
  return {
    name: nameNode?.textContent?.trim() || stopId,
    id: stopId,
    departures: [...grouped.values()].map((departure) => {
      const unique = new Map(departure.timeValues.map((value, index) => [value, departure.times[index]]));
      const sorted = [...unique.entries()].sort(([first], [second]) => first - second);
      return { ...departure, timeValues: sorted.map(([value]) => value), times: sorted.map(([, value]) => value) };
    }).sort((first, second) => first.timeValues[0] - second.timeValues[0])
  };
}

async function fetchStop(stopId, token) {
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: { Accept: "application/xml", "Content-Type": "application/xml", Authorization: token },
    body: createStopEventRequest(stopId)
  });
  if (!response.ok) throw new Error(`Transport API returned ${response.status}`);
  return parseOjpResponse(await response.text(), stopId);
}

async function loadDepartures() {
  const token = params.get("token");
  if (!token || !stopIds.length) {
    if (!renderedData.length) render([]);
    statusElement.textContent = !token ? "Add an API token to load live departures" : "Add at least one stop ID";
    updatedElement.textContent = "Live departures unavailable";
    return;
  }
  statusElement.textContent = "Loading live departures…";
  try {
    const data = (await Promise.all(stopIds.map((stopId) => fetchStop(stopId, token)))).map(filterTpgStop);
    render(data);
    lastSuccessfulUpdate = new Date();
    statusElement.textContent = data.some((stop) => stop.departures.length) ? "Live departures" : "No upcoming departures";
    updatedElement.textContent = `Updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(lastSuccessfulUpdate)}`;
  } catch (error) {
    statusElement.textContent = renderedData.length ? "Live departures · connection lost" : "Could not load live departures";
    updatedElement.textContent = lastSuccessfulUpdate
      ? `Last updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(lastSuccessfulUpdate)}`
      : error.message;
  }
}

document.querySelector("#refresh").addEventListener("click", loadDepartures);
tick();
setInterval(tick, 1000);
loadDepartures();
setInterval(loadDepartures, 60000);
