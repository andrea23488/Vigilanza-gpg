import SwiftUI
import WidgetKit
import WatchConnectivity

private let appGroup = "group.com.vigilanzagpg.app.watch"
private let contextKey = "watchDutyContextV2"

private struct DutyPresentation {
    let status: String
    let start: Date?
    let end: Date?
    let startText: String
    let endText: String
    let place: String

    init(context: [String: Any], now: Date = Date()) {
        let primaryStart = Self.date(context["inizioTimestamp"])
        let primaryEnd = Self.date(context["fineTimestamp"])
        let nextStart = Self.date(context["prossimoInizioTimestamp"])
        let nextEnd = Self.date(context["prossimoFineTimestamp"])
        let rawStatus = context["stato"] as? String ?? "nessun_turno"

        if let primaryStart, let primaryEnd, now >= primaryStart, now < primaryEnd {
            status = "in_servizio"
            start = primaryStart
            end = primaryEnd
            startText = context["inizio"] as? String ?? ""
            endText = context["fine"] as? String ?? ""
            place = context["luogo"] as? String ?? ""
        } else if let nextStart, let nextEnd, nextStart > now {
            status = rawStatus == "riposo" ? "riposo" : "prossimo_turno"
            start = nextStart
            end = nextEnd
            startText = context["prossimoInizio"] as? String ?? ""
            endText = context["prossimoFine"] as? String ?? ""
            place = context["prossimoLuogo"] as? String ?? ""
        } else if let primaryStart, let primaryEnd, primaryStart > now {
            status = rawStatus == "riposo" ? "riposo" : "prossimo_turno"
            start = primaryStart
            end = primaryEnd
            startText = context["inizio"] as? String ?? ""
            endText = context["fine"] as? String ?? ""
            place = context["luogo"] as? String ?? ""
        } else {
            status = rawStatus == "riposo" ? "riposo" : "nessun_turno"
            start = nil
            end = nil
            startText = ""
            endText = ""
            place = ""
        }
    }

    private static func date(_ value: Any?) -> Date? {
        let seconds: Double?
        if let number = value as? NSNumber { seconds = number.doubleValue }
        else if let number = value as? Double { seconds = number }
        else if let string = value as? String { seconds = Double(string) }
        else { seconds = nil }
        guard let seconds, seconds > 0 else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }
}

final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published private(set) var context: [String: Any] = [:]
    @Published private(set) var diagnostic = "In attesa dei dati dall’iPhone"

    private override init() {
        super.init()
        if let saved = UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) {
            context = saved
            diagnostic = "Dati salvati disponibili"
        }
        guard WCSession.isSupported() else {
            diagnostic = "WatchConnectivity non disponibile"
            return
        }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        if !session.receivedApplicationContext.isEmpty {
            apply(session.receivedApplicationContext, source: "Contesto iPhone recuperato")
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.diagnostic = "Errore connessione: \(error.localizedDescription)"
            } else if !session.receivedApplicationContext.isEmpty {
                self.apply(session.receivedApplicationContext, source: "Sincronizzato con iPhone")
            } else if self.context.isEmpty {
                self.diagnostic = activationState == .activated
                    ? "Connesso, apri Vigilanza GPG su iPhone"
                    : "Connessione iPhone non attiva"
            }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async {
            self.apply(applicationContext, source: "Aggiornato da iPhone")
        }
    }

    private func apply(_ newContext: [String: Any], source: String) {
        guard !newContext.isEmpty, newContext["stato"] is String else {
            diagnostic = "Dati iPhone non validi"
            return
        }
        guard let shared = UserDefaults(suiteName: appGroup) else {
            diagnostic = "App Group non disponibile"
            return
        }
        shared.set(newContext, forKey: contextKey)
        context = newContext
        diagnostic = source
        WidgetCenter.shared.reloadAllTimelines()
    }
}

struct ContentView: View {
    @StateObject private var session = WatchSessionManager.shared
    private let green = Color(red: 0.35, green: 0.91, blue: 0.43)

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            let duty = DutyPresentation(context: session.context, now: timeline.date)
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "shield.fill")
                        Text("VIGILANZA GPG")
                            .font(.caption2.weight(.bold))
                        Spacer()
                    }
                    .foregroundStyle(duty.status == "in_servizio" ? green : .white)

                    Text(title(duty.status))
                        .font(.title3.weight(.black))
                        .foregroundStyle(duty.status == "in_servizio" ? green : .white)

                    if !duty.startText.isEmpty {
                        Text("\(duty.startText)  →  \(duty.endText)")
                            .font(.system(size: 27, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .minimumScaleFactor(0.72)
                            .lineLimit(1)
                    }

                    if !duty.place.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("POSTAZIONE")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text(duty.place.uppercased())
                                .font(.headline.weight(.bold))
                                .lineLimit(2)
                        }
                    }

                    if let countdown = countdown(duty, now: timeline.date) {
                        Divider()
                        Text(countdown.label)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(countdown.value)
                            .font(.title2.weight(.bold))
                            .monospacedDigit()
                    }

                    if session.context.isEmpty {
                        Text(session.diagnostic)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            .background(Color.black)
        }
    }

    private func title(_ status: String) -> String {
        switch status {
        case "in_servizio": return "IN SERVIZIO"
        case "prossimo_turno": return "PROSSIMO TURNO"
        case "riposo": return "RIPOSO"
        default: return "NESSUN TURNO"
        }
    }

    private func countdown(_ duty: DutyPresentation, now: Date) -> (label: String, value: String)? {
        let target: Date?
        let label: String
        if duty.status == "in_servizio" {
            target = duty.end
            label = "Tempo rimanente"
        } else {
            target = duty.start
            label = "Inizia tra"
        }
        guard let target, target > now else { return nil }
        let seconds = Int(target.timeIntervalSince(now))
        return (label, String(format: "%02dh %02dm", seconds / 3600, (seconds % 3600) / 60))
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View { ContentView() }
}
