// corkcal: Corkboard's link to the Mac's Calendar app (EventKit). It reads events, and adds, changes or removes only
// the events Corkboard itself made (from day notes on a linked calendar card).
// Bundled in the app (Contents/Resources/bin/corkcal) and run by src/main/calendar.js. Prints one JSON value and exits.
//
//   corkcal status                        → {"status": "notDetermined" | "restricted" | "denied" | "authorized" | "writeOnly"}
//   corkcal request                       → asks for access (macOS shows its prompt the first time), then prints the status
//   corkcal calendars                     → [{"id", "title", "color": "#rrggbb", "source", "writable", "default"}]
//   corkcal events <fromMs> <toMs> [ids]  → [{"id", "eid", "title", "start", "end", "allDay", "cal", "color"}]; ids: comma-separated
//   corkcal add <json>                    → {"eid", "calendar"}; json: {"title", "start", "end", "allDay", "cal"?} (cal: else the default)
//   corkcal update <eid> <json>           → {"eid"}, or {"missing": true} if that event is gone
//   corkcal remove <eid>                  → {"ok": true} (also when it was already gone)
//
// Errors: {"error": "..."} and exit code 1.
import AppKit
import EventKit
import Foundation

let store = EKEventStore()

func emit(_ value: Any) -> Never {
  let data = (try? JSONSerialization.data(withJSONObject: value, options: [])) ?? Data("null".utf8)
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
  exit(0)
}
func fail(_ message: String) -> Never {
  let data = (try? JSONSerialization.data(withJSONObject: ["error": message], options: [])) ?? Data()
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
  exit(1)
}

func status() -> String {
  switch EKEventStore.authorizationStatus(for: .event).rawValue {
  case 0: return "notDetermined"
  case 1: return "restricted"
  case 2: return "denied"
  case 3: return "authorized"  // .authorized before macOS 14, .fullAccess since
  case 4: return "writeOnly"
  default: return "denied"
  }
}

func hex(_ color: CGColor?) -> String {
  guard let c = color, let ns = NSColor(cgColor: c)?.usingColorSpace(.sRGB) else { return "#888888" }
  let r = Int((ns.redComponent * 255).rounded()), g = Int((ns.greenComponent * 255).rounded()), b = Int((ns.blueComponent * 255).rounded())
  return String(format: "#%02x%02x%02x", max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
}

func ms(_ d: Date) -> Int64 { Int64((d.timeIntervalSince1970 * 1000).rounded()) }

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: corkcal status | request | calendars | events <fromMs> <toMs> [ids]") }

switch args[1] {
case "status":
  emit(["status": status()])

case "request":
  if status() != "notDetermined" { emit(["status": status()]) }
  let done = DispatchSemaphore(value: 0)
  if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { _, _ in done.signal() }
  } else {
    store.requestAccess(to: .event) { _, _ in done.signal() }
  }
  // the prompt waits for her; the app gives up after a few minutes
  while done.wait(timeout: .now() + 0.1) == .timedOut {
    RunLoop.current.run(until: Date().addingTimeInterval(0.1))
  }
  emit(["status": status()])

case "calendars":
  guard status() == "authorized" else { fail("not allowed") }
  let list = store.calendars(for: .event)
    .sorted { ($0.source.title, $0.title) < ($1.source.title, $1.title) }
    .map { cal -> [String: Any] in
      [
        "id": cal.calendarIdentifier, "title": cal.title, "color": hex(cal.cgColor), "source": cal.source.title,
        "writable": cal.allowsContentModifications,
        "default": cal.calendarIdentifier == store.defaultCalendarForNewEvents?.calendarIdentifier
      ]
    }
  emit(list)

case "events":
  guard status() == "authorized" else { fail("not allowed") }
  guard args.count >= 4, let from = Double(args[2]), let to = Double(args[3]), to > from, to - from <= 400 * 86_400_000 else {
    fail("events needs a range of up to 400 days")
  }
  var cals = store.calendars(for: .event)
  if args.count >= 5, !args[4].isEmpty {
    let ids = Set(args[4].split(separator: ",").map(String.init))
    cals = cals.filter { ids.contains($0.calendarIdentifier) }
    if cals.isEmpty { emit([Any]()) }
  }
  let pred = store.predicateForEvents(
    withStart: Date(timeIntervalSince1970: from / 1000), end: Date(timeIntervalSince1970: to / 1000), calendars: cals)
  let list = store.events(matching: pred)
    .sorted { $0.startDate < $1.startDate }
    .prefix(2000)
    .map { e -> [String: Any] in
      [
        "id": (e.eventIdentifier ?? UUID().uuidString) + "@" + String(ms(e.startDate)),
        "eid": e.eventIdentifier ?? "",
        "title": e.title ?? "",
        "start": ms(e.startDate), "end": ms(e.endDate), "allDay": e.isAllDay,
        "cal": e.calendar.calendarIdentifier, "color": hex(e.calendar.cgColor)
      ]
    }
  emit(Array(list))

case "add", "update":
  guard status() == "authorized" else { fail("not allowed") }
  let isAdd = args[1] == "add"
  guard args.count >= (isAdd ? 3 : 4),
    let obj = try? JSONSerialization.jsonObject(with: Data(args[isAdd ? 2 : 3].utf8)) as? [String: Any],
    let title = obj["title"] as? String, let start = obj["start"] as? Double, let end = obj["end"] as? Double, end >= start
  else { fail("\(args[1]) needs a title, a start and an end") }
  let event: EKEvent
  if isAdd {
    event = EKEvent(eventStore: store)
    let chosen = (obj["cal"] as? String).flatMap { store.calendar(withIdentifier: $0) }
    guard let cal = (chosen?.allowsContentModifications == true ? chosen : nil) ?? store.defaultCalendarForNewEvents else {
      fail("there is no calendar to add events to")
    }
    event.calendar = cal
  } else {
    guard let found = store.event(withIdentifier: args[2]) else { emit(["missing": true]) }
    event = found
  }
  event.title = String(title.prefix(200))
  event.isAllDay = (obj["allDay"] as? Bool) ?? false
  event.startDate = Date(timeIntervalSince1970: start / 1000)
  event.endDate = Date(timeIntervalSince1970: end / 1000)
  do { try store.save(event, span: .thisEvent, commit: true) } catch { fail("couldn't save the event: \(error.localizedDescription)") }
  emit(["eid": event.eventIdentifier ?? "", "calendar": event.calendar?.title ?? ""])

case "remove":
  guard status() == "authorized" else { fail("not allowed") }
  guard args.count >= 3 else { fail("remove needs an event id") }
  if let event = store.event(withIdentifier: args[2]) {
    do { try store.remove(event, span: .thisEvent, commit: true) } catch { fail("couldn't remove the event: \(error.localizedDescription)") }
  }
  emit(["ok": true])

default:
  fail("unknown command: \(args[1])")
}
