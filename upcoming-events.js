const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));
const today = new Date();
today.setHours(0, 0, 0, 0);

let events = [];
let anchorYear = today.getFullYear();
let anchorMonth = today.getMonth();
let viewMode = "month";
let query = "";

const elements = {
  monthTitle: document.getElementById("monthTitle"),
  monthPicker: document.getElementById("monthPicker"),
  grid: document.getElementById("calendarGrid"),
  upcomingList: document.getElementById("upcomingList"),
  agendaList: document.getElementById("agendaList"),
  monthWorkspace: document.getElementById("monthWorkspace"),
  agendaWorkspace: document.getElementById("agendaWorkspace"),
  monthViewButton: document.getElementById("monthViewButton"),
  agendaViewButton: document.getElementById("agendaViewButton"),
  eventCount: document.getElementById("eventCount"),
  nextEventDate: document.getElementById("nextEventDate"),
  calendarUpdated: document.getElementById("calendarUpdated"),
  todayLabel: document.getElementById("todayLabel"),
  loadError: document.getElementById("loadError"),
  dialog: document.getElementById("eventDialog"),
};

document.getElementById("previousMonth").addEventListener("click", () => shiftMonth(-1));
document.getElementById("nextMonth").addEventListener("click", () => shiftMonth(1));
document.getElementById("todayButton").addEventListener("click", goToToday);
elements.monthTitle.addEventListener("click", () => {
  if (typeof elements.monthPicker.showPicker === "function") elements.monthPicker.showPicker();
  else elements.monthPicker.focus();
});
elements.monthPicker.addEventListener("change", (event) => {
  if (!event.target.value) return;
  [anchorYear, anchorMonth] = event.target.value.split("-").map(Number);
  anchorMonth -= 1;
  render();
});
elements.monthViewButton.addEventListener("click", () => setView("month"));
elements.agendaViewButton.addEventListener("click", () => setView("agenda"));
document.getElementById("eventSearch").addEventListener("input", (event) => {
  query = event.target.value.trim().toLowerCase();
  render();
});
document.getElementById("closeDialog").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

loadEvents();

async function loadEvents() {
  try {
    const response = await fetch("data/upcoming-events.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.events)) throw new Error("Invalid event data");
    if (/^\d{4}-\d{2}-\d{2}$/.test(payload.updatedAt || "")) {
      elements.calendarUpdated.dateTime = payload.updatedAt;
      elements.calendarUpdated.textContent = displayDate(payload.updatedAt, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    events = payload.events
      .filter(isValidEvent)
      .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
    render();
  } catch (error) {
    console.error("Unable to load upcoming events", error);
    elements.loadError.hidden = false;
    render();
  }
}

function isValidEvent(event) {
  return event && typeof event.id === "string" && typeof event.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.startDate);
}

function eventSortKey(event) {
  return `${event.startDate}T${event.time || "00:00"}`;
}

function localDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(dateString, options) {
  return new Intl.DateTimeFormat("en-GB", options).format(localDate(dateString));
}

function formatTime(time) {
  if (!time) return "All day";
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2000, 0, 1, hour, minute));
}

function dateRange(event) {
  const start = displayDate(event.startDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (!event.endDate || event.endDate === event.startDate) return `${start} · ${formatTime(event.time)}`;
  const end = displayDate(event.endDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${start} – ${end} · ${formatTime(event.time)}`;
}

function eventOccursOn(event, key) {
  return key >= event.startDate && key <= (event.endDate || event.startDate);
}

function eventMatches(event) {
  if (!query) return true;
  return [event.title, event.section, event.location, event.venue, event.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function futureEvents() {
  const todayKey = dateKey(today);
  return events.filter((event) => (event.endDate || event.startDate) >= todayKey);
}

function shiftMonth(delta) {
  const date = new Date(anchorYear, anchorMonth + delta, 1);
  anchorYear = date.getFullYear();
  anchorMonth = date.getMonth();
  render();
}

function goToToday() {
  anchorYear = today.getFullYear();
  anchorMonth = today.getMonth();
  render();
}

function setView(mode) {
  viewMode = mode;
  render();
}

function render() {
  elements.monthTitle.textContent = `${MONTHS[anchorMonth]} ${anchorYear}`;
  elements.monthPicker.value = `${anchorYear}-${String(anchorMonth + 1).padStart(2, "0")}`;
  elements.todayLabel.textContent = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(today);

  const upcoming = futureEvents();
  elements.eventCount.textContent = upcoming.length;
  const todayKey = dateKey(today);
  const nextEventKey = upcoming.length && upcoming[0].startDate < todayKey
    ? todayKey
    : upcoming[0]?.startDate;
  elements.nextEventDate.textContent = upcoming.length
    ? displayDate(nextEventKey, { day: "numeric", month: "short" })
    : "—";

  const monthSelected = viewMode === "month";
  elements.monthViewButton.setAttribute("aria-selected", String(monthSelected));
  elements.agendaViewButton.setAttribute("aria-selected", String(!monthSelected));
  elements.monthWorkspace.hidden = !monthSelected;
  elements.agendaWorkspace.hidden = monthSelected;

  renderMonth();
  renderUpcoming();
  renderAgenda();
}

function renderMonth() {
  elements.grid.innerHTML = "";
  elements.grid.setAttribute("aria-label", `${MONTHS[anchorMonth]} ${anchorYear}`);

  const first = new Date(anchorYear, anchorMonth, 1);
  const start = new Date(anchorYear, anchorMonth, 1 - first.getDay());
  const last = new Date(anchorYear, anchorMonth + 1, 0);
  const totalCells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
  const todayKey = dateKey(today);

  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    const dayEvents = events.filter((event) => eventOccursOn(event, key));

    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (date.getMonth() !== anchorMonth) cell.classList.add("outside-month");
    if (key === todayKey) cell.classList.add("today");
    cell.setAttribute("role", "gridcell");
    cell.tabIndex = key === todayKey ? 0 : -1;
    cell.setAttribute("aria-label", displayDate(key, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    cell.addEventListener("keydown", handleGridKeydown);

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = date.getDate();
    cell.appendChild(dayNumber);

    if (dayEvents.length) {
      const wrap = document.createElement("div");
      wrap.className = "day-events";
      dayEvents.slice(0, 3).forEach((event) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-event";
        button.dataset.section = event.section || "";
        if (!eventMatches(event)) button.classList.add("is-dimmed");
        button.textContent = `${event.time ? `${formatTime(event.time)} ` : ""}${event.title}`;
        button.setAttribute("aria-label", `${event.title}, ${dateRange(event)}`);
        button.addEventListener("click", () => openEvent(event));
        wrap.appendChild(button);
      });
      if (dayEvents.length > 3) {
        const more = document.createElement("span");
        more.className = "more-events";
        more.textContent = `+${dayEvents.length - 3} more`;
        wrap.appendChild(more);
      }
      cell.appendChild(wrap);
    }
    elements.grid.appendChild(cell);
  }

  if (!elements.grid.querySelector('[tabindex="0"]')) elements.grid.firstElementChild.tabIndex = 0;
}

function handleGridKeydown(event) {
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(event.key in moves)) return;
  event.preventDefault();
  const cells = [...elements.grid.querySelectorAll(".day-cell")];
  const next = cells[cells.indexOf(event.currentTarget) + moves[event.key]];
  if (!next) return;
  event.currentTarget.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}

function createEventRow(event, agenda = false) {
  const item = document.createElement("li");
  item.className = "event-row";
  item.dataset.section = event.section || "";
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `Open ${event.title}`);

  const date = document.createElement("div");
  date.className = "event-date";
  date.innerHTML = `${displayDate(event.startDate, { day: "numeric" })}<span>${SHORT_MONTHS[localDate(event.startDate).getMonth()]}</span>`;

  const copy = document.createElement("div");
  copy.className = "event-copy";
  const title = document.createElement("strong");
  title.textContent = event.title;
  const detail = document.createElement("span");
  detail.textContent = [formatTime(event.time), event.location].filter(Boolean).join(" · ");
  copy.append(title, detail);
  item.append(date, copy);

  if (agenda) {
    const meta = document.createElement("div");
    meta.className = "agenda-meta";
    meta.textContent = [event.section, event.venue].filter(Boolean).join(" · ");
    item.appendChild(meta);
  }

  item.addEventListener("click", () => openEvent(event));
  item.addEventListener("keydown", (keyboardEvent) => {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      openEvent(event);
    }
  });
  return item;
}

function renderUpcoming() {
  elements.upcomingList.innerHTML = "";
  const list = futureEvents().filter(eventMatches).slice(0, 6);
  if (!list.length) return renderEmpty(elements.upcomingList, query ? "No matching dates." : "Nothing is currently in the diary.");
  list.forEach((event) => elements.upcomingList.appendChild(createEventRow(event)));
}

function renderAgenda() {
  elements.agendaList.innerHTML = "";
  const list = futureEvents().filter(eventMatches);
  if (!list.length) return renderEmpty(elements.agendaList, query ? "No matching dates." : "Nothing is currently in the diary.");
  list.forEach((event) => elements.agendaList.appendChild(createEventRow(event, true)));
}

function renderEmpty(container, message) {
  const item = document.createElement("li");
  item.className = "empty-state";
  item.textContent = message;
  container.appendChild(item);
}

function openEvent(event) {
  document.getElementById("dialogSection").textContent = event.section || "Upcoming event";
  document.getElementById("dialogTitle").textContent = event.title;
  document.getElementById("dialogDate").textContent = dateRange(event);
  document.getElementById("dialogLocation").textContent = [event.venue, event.location].filter(Boolean).join(" · ");
  document.getElementById("dialogSummary").textContent = event.summary || "Details are available from the source.";

  const links = document.getElementById("dialogLinks");
  links.innerHTML = "";
  if (event.actionUrl) links.appendChild(createLink(event.actionUrl, event.action || "Event details"));
  if (event.sourceUrl && event.sourceUrl !== event.actionUrl) links.appendChild(createLink(event.sourceUrl, event.sourceName || "Source"));
  elements.dialog.showModal();
}

function createLink(url, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `${label} ↗`;
  return link;
}
