import WidgetKit
import SwiftUI

private let appGroup = "group.com.vigilanzagpg.app.watch"
private let contextKey = "watchDutyContextV2"

struct VigilanzaEntry: TimelineEntry {
    let date: Date
    let context: [String: Any]
}

private struct DutyItem {
    let start: Date
    let end: Date
    let startText: String
    let endText: String
    let place: String

    init?(_ data: [String: Any]) {
        guard let start = Self.date(data["inizioTimestamp"]),
              let end = Self.date(data["fineTimestamp"]), end > start else { return nil }
        self.start = start
        self.end = end
        self.startText = data["inizio"] as? String ?? ""
        self.endText = data["fine"] as? String ?? ""
        self.place = data["luogo"] as? String ?? ""
    }

    static func date(_ value: Any?) -> Date? {
        guard let seconds = (value as? NSNumber)?.doubleValue, seconds > 0 else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }
}

private struct DutyState {
    let current: DutyItem?
    let next: DutyItem?
    let isResting: Bool

    init(_ context: [String: Any], now: Date) {
        var items = (context["turni"] as? [[String: Any]] ?? [])
            .compactMap(DutyItem.init)
            .sorted { $0.start < $1.start }

        if items.isEmpty,
           let start = DutyItem.date(context["inizioTimestamp"]),
           let end = DutyItem.date(context["fineTimestamp"]), end > start {
            let legacy: [String: Any] = [
                "inizioTimestamp": start.timeIntervalSince1970,
                "fineTimestamp": end.timeIntervalSince1970,
                "inizio": context["inizio"] as? String ?? "",
                "fine": context["fine"] as? String ?? "",
                "luogo": context["luogo"] as? String ?? ""
            ]
            if let item = DutyItem(legacy) { items = [item] }
        }

        current = items.first { now >= $0.start && now < $0.end }
        next = items.first { $0.start > now }
        let restUntil = DutyItem.date(context["riposoFinoTimestamp"])
        isResting = current == nil && restUntil.map { now < $0 } == true
    }

    var primary: DutyItem? { current ?? next }
    var target: Date? { current?.end ?? next?.start }
    var status: String {
        if current != nil { return "IN SERVIZIO" }
        if isResting { return "RIPOSO" }
        if next != nil { return "PROSSIMO" }
        return "FUORI SERVIZIO"
    }
}

struct VigilanzaProvider: TimelineProvider {
    func placeholder(in context: Context) -> VigilanzaEntry {
        VigilanzaEntry(date: .now, context: ["stato": "nessun_turno", "turni": []])
    }

    func getSnapshot(in context: Context, completion: @escaping (VigilanzaEntry) -> Void) {
        completion(entry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VigilanzaEntry>) -> Void) {
        let now = Date()
        let saved = UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) ?? [:]
        let items = (saved["turni"] as? [[String: Any]] ?? []).compactMap(DutyItem.init)
        let transitions = items.flatMap { [$0.start, $0.end] }.filter { $0 > now }
        let restUntil = DutyItem.date(saved["riposoFinoTimestamp"]).map { [$0] } ?? []
        let midnight = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now
        )
        let refreshDates = Array(Set(transitions + restUntil + [midnight])).sorted()
        let entries = ([now] + refreshDates).map { VigilanzaEntry(date: $0, context: saved) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(at date: Date) -> VigilanzaEntry {
        VigilanzaEntry(
            date: date,
            context: UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) ?? [:]
        )
    }
}

private enum ComplicationMode {
    case status
    case schedule
    case countdown
    case location
}

private struct VigilanzaComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VigilanzaEntry
    let mode: ComplicationMode

    var body: some View {
        let duty = DutyState(entry.context, now: entry.date)
        switch family {
        case .accessoryCircular:
            circular(duty)
        case .accessoryInline:
            inline(duty)
        case .accessoryRectangular:
            rectangular(duty)
        default:
            Text("GPG")
        }
    }

    @ViewBuilder
    private func circular(_ duty: DutyState) -> some View {
        switch mode {
        case .status:
            VStack(spacing: 1) {
                Image(systemName: duty.current == nil ? "shield" : "shield.fill")
                    .foregroundStyle(duty.current == nil ? Color.primary : Color.green)
                Text(shortStatus(duty)).font(.system(size: 9, weight: .black)).minimumScaleFactor(0.7)
            }
        case .schedule:
            VStack(spacing: 0) {
                Image(systemName: "clock")
                Text(duty.primary?.startText ?? "--:--")
                    .font(.system(size: 10, weight: .black)).monospacedDigit()
            }
        case .countdown:
            VStack(spacing: 0) {
                Image(systemName: duty.current == nil ? "hourglass" : "hourglass.bottomhalf.filled")
                if let target = duty.target, target > entry.date {
                    Text(target, style: .timer)
                        .font(.system(size: 9, weight: .black)).monospacedDigit().minimumScaleFactor(0.55)
                } else {
                    Text("--").font(.caption.weight(.bold))
                }
            }
        case .location:
            VStack(spacing: 0) {
                Image(systemName: "mappin.and.ellipse")
                Text(abbreviate(duty.primary?.place ?? "—"))
                    .font(.system(size: 9, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            }
        }
    }

    @ViewBuilder
    private func inline(_ duty: DutyState) -> some View {
        switch mode {
        case .status:
            Text("GPG · \(duty.status)")
        case .schedule:
            Text("GPG · \(duty.primary?.startText ?? "nessun turno")")
        case .countdown:
            if let target = duty.target, target > entry.date {
                HStack(spacing: 3) {
                    Text(duty.current == nil ? "Inizio" : "Fine")
                    Text(target, style: .timer).monospacedDigit()
                }
            } else {
                Text("GPG · nessun countdown")
            }
        case .location:
            Text("GPG · \(placeText(duty))")
        }
    }

    @ViewBuilder
    private func rectangular(_ duty: DutyState) -> some View {
        switch mode {
        case .status:
            VStack(alignment: .leading, spacing: 3) {
                Label(duty.status, systemImage: duty.current == nil ? "shield" : "shield.fill")
                    .font(.caption.weight(.black))
                if let primary = duty.primary {
                    Text("\(primary.startText) → \(primary.endText)")
                        .font(.caption2.weight(.semibold)).monospacedDigit()
                }
            }
        case .schedule:
            VStack(alignment: .leading, spacing: 2) {
                Text(duty.current == nil ? "PROSSIMO TURNO" : "TURNO ATTUALE")
                    .font(.caption2.weight(.bold))
                Text("\(duty.primary?.startText ?? "--:--") → \(duty.primary?.endText ?? "--:--")")
                    .font(.headline.weight(.black)).monospacedDigit()
            }
        case .countdown:
            VStack(alignment: .leading, spacing: 2) {
                Text(duty.current == nil ? "INIZIA TRA" : "TEMPO RIMANENTE")
                    .font(.caption2.weight(.bold))
                if let target = duty.target, target > entry.date {
                    Text(target, style: .timer)
                        .font(.headline.weight(.black)).monospacedDigit()
                } else {
                    Text("—").font(.headline)
                }
            }
        case .location:
            VStack(alignment: .leading, spacing: 2) {
                Label("POSTAZIONE", systemImage: "mappin.and.ellipse")
                    .font(.caption2.weight(.bold))
                Text(placeText(duty))
                    .font(.headline.weight(.bold)).lineLimit(2).minimumScaleFactor(0.7)
            }
        }
    }

    private func shortStatus(_ duty: DutyState) -> String {
        if duty.current != nil { return "SERVIZIO" }
        if duty.isResting { return "RIPOSO" }
        if duty.next != nil { return "PROSSIMO" }
        return "FUORI"
    }

    private func abbreviate(_ value: String) -> String {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count > 7 else { return clean }
        return String(clean.prefix(6)) + "…"
    }

    private func placeText(_ duty: DutyState) -> String {
        let place = duty.primary?.place ?? ""
        return place.isEmpty ? "Postazione non definita" : place
    }
}

struct VigilanzaStatoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VigilanzaGPG.Stato", provider: VigilanzaProvider()) { entry in
            VigilanzaComplicationView(entry: entry, mode: .status).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Stato servizio")
        .description("Mostra se sei in servizio, a riposo o fuori servizio.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct VigilanzaOrarioWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VigilanzaGPG.Orario", provider: VigilanzaProvider()) { entry in
            VigilanzaComplicationView(entry: entry, mode: .schedule).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Orario servizio")
        .description("Mostra l’orario del turno attuale o del prossimo turno.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct VigilanzaCountdownWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VigilanzaGPG.Countdown", provider: VigilanzaProvider()) { entry in
            VigilanzaComplicationView(entry: entry, mode: .countdown).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Countdown servizio")
        .description("Mostra il tempo all’inizio o alla fine del servizio.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct VigilanzaPostazioneWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VigilanzaGPG.Postazione", provider: VigilanzaProvider()) { entry in
            VigilanzaComplicationView(entry: entry, mode: .location).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Postazione servizio")
        .description("Mostra la postazione del turno attuale o futuro.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct VigilanzaGPGWidgetBundle: WidgetBundle {
    var body: some Widget {
        VigilanzaStatoWidget()
        VigilanzaOrarioWidget()
        VigilanzaCountdownWidget()
        VigilanzaPostazioneWidget()
    }
}
