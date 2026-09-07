import SwiftUI
import WidgetKit
import WatchConnectivity

private let appGroup = "group.com.vigilanzagpg.app.watch"
private let contextKey = "watchDutyContextV2"

private struct DutyItem: Identifiable {
    let id: String
    let start: Date
    let end: Date
    let startText: String
    let endText: String
    let place: String
    let address: String

    init?(_ data: [String: Any]) {
        guard let start = Self.date(data["inizioTimestamp"]),
              let end = Self.date(data["fineTimestamp"]),
              end > start else { return nil }
        self.id = data["id"] as? String ?? String(start.timeIntervalSince1970)
        self.start = start
        self.end = end
        self.startText = data["inizio"] as? String ?? ""
        self.endText = data["fine"] as? String ?? ""
        self.place = data["luogo"] as? String ?? ""
        self.address = data["indirizzo"] as? String ?? ""
    }

    static func date(_ value: Any?) -> Date? {
        let seconds = (value as? NSNumber)?.doubleValue ?? Double(value as? String ?? "")
        guard let seconds, seconds > 0 else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }
}

private struct DutySchedule {
    let current: DutyItem?
    let next: DutyItem?
    let isResting: Bool

    init(context: [String: Any], now: Date) {
        var items = (context["turni"] as? [[String: Any]] ?? [])
            .compactMap(DutyItem.init)
            .sorted { $0.start < $1.start }

        if items.isEmpty,
           let start = DutyItem.date(context["inizioTimestamp"]),
           let end = DutyItem.date(context["fineTimestamp"]), end > start {
            let legacy: [String: Any] = [
                "id": "legacy-primary",
                "inizioTimestamp": start.timeIntervalSince1970,
                "fineTimestamp": end.timeIntervalSince1970,
                "inizio": context["inizio"] as? String ?? "",
                "fine": context["fine"] as? String ?? "",
                "luogo": context["luogo"] as? String ?? "",
                "indirizzo": context["indirizzo"] as? String ?? ""
            ]
            if let item = DutyItem(legacy) { items = [item] }
        }

        current = items.first { now >= $0.start && now < $0.end }
        next = items.first { $0.start > now }
        let restUntil = DutyItem.date(context["riposoFinoTimestamp"])
        isResting = current == nil && restUntil.map { now < $0 } == true
    }
}

final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published private(set) var context: [String: Any] = [:]
    @Published private(set) var diagnostic = "Apri Vigilanza GPG su iPhone"

    private override init() {
        super.init()
        if let saved = UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) {
            context = saved
        }
        guard WCSession.isSupported() else {
            diagnostic = "Connessione iPhone non disponibile"
            return
        }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        if !session.receivedApplicationContext.isEmpty {
            apply(session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.diagnostic = "Errore connessione: \(error.localizedDescription)"
            } else if !session.receivedApplicationContext.isEmpty {
                self.apply(session.receivedApplicationContext)
            }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.apply(applicationContext) }
    }

    private func apply(_ newContext: [String: Any]) {
        guard !newContext.isEmpty, newContext["stato"] is String else {
            diagnostic = "Dati iPhone non validi"
            return
        }
        guard let shared = UserDefaults(suiteName: appGroup) else {
            diagnostic = "Archivio condiviso non disponibile"
            return
        }

        let incomingDate = DutyItem.date(newContext["aggiornatoTimestamp"])
        let savedDate = DutyItem.date(context["aggiornatoTimestamp"])
        if let incomingDate, let savedDate, incomingDate < savedDate { return }

        let incomingUser = newContext["utenteId"] as? String ?? ""
        let savedUser = context["utenteId"] as? String ?? ""
        if incomingUser.isEmpty {
            shared.removeObject(forKey: contextKey)
            context = [:]
            diagnostic = "Apri Vigilanza GPG su iPhone"
            WidgetCenter.shared.reloadAllTimelines()
            return
        }
        if !savedUser.isEmpty && savedUser != incomingUser {
            shared.removeObject(forKey: contextKey)
            context = [:]
        }

        shared.set(newContext, forKey: contextKey)
        context = newContext
        diagnostic = ""
        WidgetCenter.shared.reloadAllTimelines()
    }
}

struct ContentView: View {
    @StateObject private var session = WatchSessionManager.shared
    private let green = Color(red: 0.30, green: 0.88, blue: 0.42)
    private let panel = Color.white.opacity(0.075)

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            let schedule = DutySchedule(context: session.context, now: timeline.date)
            let primary = schedule.current ?? schedule.next

            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(schedule.current == nil ? Color.secondary : green)
                            .frame(width: 7, height: 7)
                        Text(statusTitle(schedule))
                            .font(.system(size: 15, weight: .black, design: .rounded))
                            .foregroundStyle(schedule.current == nil ? .white : green)
                        Spacer()
                    }

                    if let primary {
                        VStack(alignment: .leading, spacing: 7) {
                            if schedule.current == nil {
                                Text(dayLabel(primary.start, now: timeline.date))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            Text("\(primary.startText)  →  \(primary.endText)")
                                .font(.system(size: 26, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .minimumScaleFactor(0.72)
                                .lineLimit(1)
                            if !primary.place.isEmpty {
                                Text(primary.place.uppercased())
                                    .font(.headline.weight(.bold))
                                    .lineLimit(2)
                            }
                            if !primary.address.isEmpty {
                                Text(primary.address)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 13).fill(panel))

                        if let target = schedule.current?.end ?? schedule.next?.start {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(schedule.current == nil ? "INIZIA TRA" : "TEMPO RIMANENTE")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.secondary)
                                Text(countdown(target, now: timeline.date))
                                    .font(.title2.weight(.black))
                                    .monospacedDigit()
                            }
                        }
                    } else {
                        Text(session.context.isEmpty ? session.diagnostic : "Nessun servizio programmato")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .padding(.vertical, 8)
                    }

                    if let current = schedule.current,
                       let next = schedule.next,
                       next.id != current.id {
                        Divider()
                        VStack(alignment: .leading, spacing: 3) {
                            Text("PROSSIMO TURNO")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text("\(dayLabel(next.start, now: timeline.date)) · \(next.startText) → \(next.endText)")
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                            if !next.place.isEmpty {
                                Text(next.place).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            .background(Color.black)
        }
    }

    private func statusTitle(_ schedule: DutySchedule) -> String {
        if schedule.current != nil { return "IN SERVIZIO" }
        if schedule.isResting { return "RIPOSO" }
        if schedule.next != nil { return "PROSSIMO TURNO" }
        return "FUORI SERVIZIO"
    }

    private func dayLabel(_ date: Date, now: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Oggi" }
        if calendar.isDateInTomorrow(date) { return "Domani" }
        return date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
    }

    private func countdown(_ target: Date, now: Date) -> String {
        let seconds = max(0, Int(target.timeIntervalSince(now)))
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        return String(format: "%02dh %02dm", hours, minutes)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View { ContentView() }
}
