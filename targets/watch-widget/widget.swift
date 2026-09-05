import WidgetKit
import SwiftUI

private let appGroup = "group.com.vigilanzagpg.app.watch"

struct VigilanzaEntry: TimelineEntry {
    let date: Date
    let stato: String
    let inizio: String
    let fine: String
    let luogo: String
    let giorno: Int
    let mese: Int
    let anno: Int
}

struct VigilanzaProvider: TimelineProvider {

    func placeholder(in context: Context) -> VigilanzaEntry {
        VigilanzaEntry(
            date: Date(),
            stato: "non_in_servizio",
            inizio: "15:00",
            fine: "23:00",
            luogo: "Pianto.",
            giorno: 5,
            mese: 9,
            anno: 2026
        )
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (VigilanzaEntry) -> Void
    ) {
        completion(caricaEntry(data: Date()))
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<VigilanzaEntry>) -> Void
    ) {
        let now = Date()

        let entries = (0..<60).compactMap {
            Calendar.current.date(byAdding: .minute, value: $0, to: now)
        }.map {
            caricaEntry(data: $0)
        }

        completion(
            Timeline(
                entries: entries,
                policy: .atEnd
            )
        )
    }

    private func caricaEntry(data: Date) -> VigilanzaEntry {
        let shared = UserDefaults(suiteName: appGroup)

        return VigilanzaEntry(
            date: data,
            stato: shared?.string(forKey: "stato") ?? "",
            inizio: shared?.string(forKey: "inizio") ?? "",
            fine: shared?.string(forKey: "fine") ?? "",
            luogo: shared?.string(forKey: "luogo") ?? "",
            giorno: shared?.integer(forKey: "giorno") ?? 0,
            mese: shared?.integer(forKey: "mese") ?? 0,
            anno: shared?.integer(forKey: "anno") ?? 0
        )
    }
}

struct VigilanzaComplicationView: View {
    @Environment(\.widgetFamily) var family

    let entry: VigilanzaEntry

    private var intervalloTurno: (Date, Date)? {
        guard
            entry.giorno > 0,
            entry.mese > 0,
            entry.anno > 0,
            let startTime = parseOra(entry.inizio),
            let endTime = parseOra(entry.fine)
        else {
            return nil
        }

        var cal = Calendar.current

        guard let start = cal.date(
            from: DateComponents(
                year: entry.anno,
                month: entry.mese,
                day: entry.giorno,
                hour: startTime.0,
                minute: startTime.1
            )
        ) else {
            return nil
        }

        var endComponents = DateComponents(
            year: entry.anno,
            month: entry.mese,
            day: entry.giorno,
            hour: endTime.0,
            minute: endTime.1
        )

        guard var end = cal.date(from: endComponents) else {
            return nil
        }

        if end <= start {
            end = cal.date(byAdding: .day, value: 1, to: end) ?? end
        }

        return (start, end)
    }

    private var inServizio: Bool {
        guard let turno = intervalloTurno else {
            return false
        }

        return entry.date >= turno.0 && entry.date < turno.1
    }

    private var countdownFine: String {
        guard let turno = intervalloTurno else {
            return "--"
        }

        let target = inServizio ? turno.1 : turno.0
        let seconds = max(0, Int(target.timeIntervalSince(entry.date)))

        let ore = seconds / 3600
        let minuti = (seconds % 3600) / 60

        return String(format: "%02dh %02dm", ore, minuti)
    }

    private var avanzamento: Double {
        guard
            let turno = intervalloTurno,
            inServizio
        else {
            return 0
        }

        let totale = turno.1.timeIntervalSince(turno.0)
        let trascorso = entry.date.timeIntervalSince(turno.0)

        guard totale > 0 else {
            return 0
        }

        return min(1, max(0, trascorso / totale))
    }

    var body: some View {
        switch family {

        case .accessoryCircular:
            Gauge(value: avanzamento) {
                Image(systemName: "shield.fill")
            } currentValueLabel: {
                VStack(spacing: 0) {
                    Text(inServizio ? "ON" : "NEXT")
                        .font(.system(size: 8, weight: .black))

                    Text(countdownBreve)
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .monospacedDigit()
                }
            }
            .gaugeStyle(.accessoryCircular)

        case .accessoryInline:
            Text(
                inServizio
                ? "GPG · fine tra \(countdownFine)"
                : "GPG · prossimo \(entry.inizio.isEmpty ? "--:--" : entry.inizio)"
            )

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {

                HStack(spacing: 4) {
                    Image(systemName: "shield.fill")

                    Text(
                        inServizio
                        ? "ON DUTY"
                        : "NEXT DUTY"
                    )
                    .font(.system(size: 11, weight: .black))

                    Spacer()

                    Text(countdownFine)
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .monospacedDigit()
                }

                Text(
                    "\(entry.inizio.isEmpty ? "--:--" : entry.inizio) → \(entry.fine.isEmpty ? "--:--" : entry.fine)"
                )
                .font(.system(size: 10, weight: .bold))

                if !entry.luogo.isEmpty {
                    Text(entry.luogo)
                        .font(.system(size: 9, weight: .medium))
                        .lineLimit(1)
                }

                if inServizio {
                    ProgressView(value: avanzamento)
                        .progressViewStyle(.linear)
                }
            }

        default:
            Text("GPG")
        }
    }

    private var countdownBreve: String {
        guard let turno = intervalloTurno else {
            return "--"
        }

        let target = inServizio ? turno.1 : turno.0
        let seconds = max(0, Int(target.timeIntervalSince(entry.date)))

        let ore = seconds / 3600
        let minuti = (seconds % 3600) / 60

        if ore > 0 {
            return "\(ore)h"
        }

        return "\(minuti)m"
    }

    private func parseOra(_ valore: String) -> (Int, Int)? {
        let parts = valore.split(separator: ":")

        guard
            parts.count == 2,
            let h = Int(parts[0]),
            let m = Int(parts[1]),
            (0...23).contains(h),
            (0...59).contains(m)
        else {
            return nil
        }

        return (h, m)
    }
}

struct VigilanzaGPGWidget: Widget {
    let kind = "VigilanzaGPGComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: VigilanzaProvider()
        ) { entry in
            VigilanzaComplicationView(entry: entry)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Vigilanza GPG")
        .description("Stato operativo e countdown del turno.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

@main
struct VigilanzaGPGWidgetBundle: WidgetBundle {
    var body: some Widget {
        VigilanzaGPGWidget()
    }
}
