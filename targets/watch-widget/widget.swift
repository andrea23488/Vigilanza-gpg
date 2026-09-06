import WidgetKit
import SwiftUI

private let appGroup = "group.com.vigilanzagpg.app.watch"
private let contextKey = "watchDutyContextV2"

struct VigilanzaEntry: TimelineEntry {
    let date: Date
    let context: [String: Any]
}

private struct DutyState {
    let status: String
    let start: Date?
    let end: Date?
    let startText: String
    let endText: String
    let place: String

    init(_ context: [String: Any], now: Date) {
        let primaryStart = Self.date(context["inizioTimestamp"])
        let primaryEnd = Self.date(context["fineTimestamp"])
        let nextStart = Self.date(context["prossimoInizioTimestamp"])
        let nextEnd = Self.date(context["prossimoFineTimestamp"])
        let raw = context["stato"] as? String ?? "nessun_turno"

        if let primaryStart, let primaryEnd, now >= primaryStart, now < primaryEnd {
            status = "in_servizio"; start = primaryStart; end = primaryEnd
            startText = context["inizio"] as? String ?? ""; endText = context["fine"] as? String ?? ""
            place = context["luogo"] as? String ?? ""
        } else if let nextStart, let nextEnd, nextStart > now {
            status = raw == "riposo" ? "riposo" : "prossimo_turno"; start = nextStart; end = nextEnd
            startText = context["prossimoInizio"] as? String ?? ""; endText = context["prossimoFine"] as? String ?? ""
            place = context["prossimoLuogo"] as? String ?? ""
        } else if let primaryStart, let primaryEnd, primaryStart > now {
            status = raw == "riposo" ? "riposo" : "prossimo_turno"; start = primaryStart; end = primaryEnd
            startText = context["inizio"] as? String ?? ""; endText = context["fine"] as? String ?? ""
            place = context["luogo"] as? String ?? ""
        } else {
            status = raw == "riposo" ? "riposo" : "nessun_turno"; start = nil; end = nil
            startText = ""; endText = ""; place = ""
        }
    }

    private static func date(_ value: Any?) -> Date? {
        guard let seconds = (value as? NSNumber)?.doubleValue, seconds > 0 else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }
}

struct VigilanzaProvider: TimelineProvider {
    func placeholder(in context: Context) -> VigilanzaEntry {
        VigilanzaEntry(date: .now, context: ["stato": "nessun_turno"])
    }

    func getSnapshot(in context: Context, completion: @escaping (VigilanzaEntry) -> Void) {
        completion(entry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VigilanzaEntry>) -> Void) {
        let now = Date()
        let saved = UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) ?? [:]
        let values = ["inizioTimestamp", "fineTimestamp", "prossimoInizioTimestamp", "prossimoFineTimestamp"]
            .compactMap { (saved[$0] as? NSNumber)?.doubleValue }
            .map { Date(timeIntervalSince1970: $0) }
            .filter { $0 > now }
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now)
        let refresh = ([midnight] + values).min() ?? Calendar.current.date(byAdding: .hour, value: 6, to: now)!
        completion(Timeline(entries: [VigilanzaEntry(date: now, context: saved)], policy: .after(refresh)))
    }

    private func entry(at date: Date) -> VigilanzaEntry {
        VigilanzaEntry(date: date, context: UserDefaults(suiteName: appGroup)?.dictionary(forKey: contextKey) ?? [:])
    }
}

struct VigilanzaComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VigilanzaEntry

    var body: some View {
        let duty = DutyState(entry.context, now: entry.date)
        switch family {
        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(systemName: duty.status == "in_servizio" ? "shield.fill" : "clock.fill")
                Text(shortStatus(duty.status)).font(.system(size: 9, weight: .black))
                Text(shortCountdown(duty)).font(.system(size: 9, weight: .bold)).monospacedDigit()
            }
        case .accessoryInline:
            Text(inlineText(duty))
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: "shield.fill")
                    Text(longStatus(duty.status)).font(.caption.weight(.black))
                    Spacer()
                    Text(shortCountdown(duty)).font(.caption.weight(.bold)).monospacedDigit()
                }
                if !duty.startText.isEmpty {
                    Text("\(duty.startText) → \(duty.endText)").font(.caption.weight(.semibold)).monospacedDigit()
                }
                if !duty.place.isEmpty {
                    Text(duty.place).font(.caption2).lineLimit(1)
                }
            }
        default:
            Text("GPG")
        }
    }

    private func longStatus(_ status: String) -> String {
        switch status { case "in_servizio": return "IN SERVIZIO"; case "prossimo_turno": return "PROSSIMO"; case "riposo": return "RIPOSO"; default: return "NESSUN TURNO" }
    }
    private func shortStatus(_ status: String) -> String {
        switch status { case "in_servizio": return "SERV."; case "prossimo_turno": return "PROSS."; case "riposo": return "RIPOSO"; default: return "LIBERO" }
    }
    private func target(_ duty: DutyState) -> Date? { duty.status == "in_servizio" ? duty.end : duty.start }
    private func shortCountdown(_ duty: DutyState) -> String {
        guard let target = target(duty), target > entry.date else { return "--" }
        let minutes = Int(target.timeIntervalSince(entry.date)) / 60
        return minutes >= 60 ? "\(minutes / 60)h" : "\(minutes)m"
    }
    private func inlineText(_ duty: DutyState) -> String {
        if duty.status == "in_servizio" { return "GPG · fine tra \(shortCountdown(duty))" }
        if duty.status == "prossimo_turno" || duty.status == "riposo" {
            return "GPG · \(longStatus(duty.status)) \(duty.startText)"
        }
        return "GPG · nessun turno"
    }
}

struct VigilanzaGPGWidget: Widget {
    let kind = "VigilanzaGPGComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: VigilanzaProvider()) { entry in
            VigilanzaComplicationView(entry: entry).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Vigilanza GPG")
        .description("Stato e orari del servizio.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct VigilanzaGPGWidgetBundle: WidgetBundle {
    var body: some Widget { VigilanzaGPGWidget() }
}
