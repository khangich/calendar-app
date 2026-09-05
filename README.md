# Calendar App

A small Electron desktop calendar with recurring events.

## Run

```
npm start
```

(Requires Node.js)

## Features

- Month view with prev / next / Today navigation
- Events with **none / daily / weekly / monthly / yearly** recurrence
  - Optional start/end times (e.g. 4:30 PM – 6:30 PM); events are sorted by time
  - Monthly/yearly repeats clamp to month length (Jan 31 -> Feb 28)
- Repeating events either continue forever or **end on a chosen date**
- **Event types** — starts with Class, Homework, Exam, Work, Personal, Other.
  Click **Manage…** in the editor to add your own types (name + color) or
  delete ones you don't need; events in a deleted type fall back to Other.
  Types live in `types.json`. Grid chips are tinted by type and the day pane
  groups that day's events under color-coded type headers
- **Type sidebar** (left, Google-Calendar style): click a type to hide or
  show its events on the grid and day pane; hidden types are remembered
  (localStorage). Manage… at the bottom opens the type manager
- Click a day to select it; sidebar lists that day's events
- Double-click a day to add an event; pencil icon (or double-click an event) to edit
- Event chips + tooltips on the grid; `↻` marks recurring events
- Keyboard: arrows move day, **Enter** add on selected day, **N** new event, **T** today, **PgUp/PgDn** change month, **Esc** close dialog
- Data persists in `events.json` next to the app (path shown in the sidebar footer)

## Tests

Recurrence engine has unit tests:

```
npm test
```

## Structure

| File            | Purpose                                  |
| --------------- | ---------------------------------------- |
| `main.js`       | Electron main process, JSON persistence  |
| `preload.js`    | Safe IPC bridge                          |
| `recurrence.js` | Recurrence engine (shared with tests)    |
| `renderer.js`   | UI logic                                 |
| `index.html`    | Layout + event editor dialog             |
