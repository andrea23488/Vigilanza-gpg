import SwiftUI
import WidgetKit
import WatchConnectivity

final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published var stato = "non_in_servizio"
    @Published var tipo = ""

    @Published var giorno = 0
    @Published var mese = 0
    @Published var anno = 0

    @Published var inizio = ""
    @Published var fine = ""
    @Published var luogo = ""
    @Published var indirizzo = ""

    @Published var countdownLabel = ""
    @Published var countdown = ""
    @Published var aggiornatoAlle = ""

    private override init() {
        super.init()

        guard WCSession.isSupported() else { return }

        let session = WCSession.default
        session.delegate = self
        session.activate()

        applica(session.receivedApplicationContext)
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.applica(session.receivedApplicationContext)
        }
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String : Any]
    ) {
        DispatchQueue.main.async {
            self.applica(applicationContext)
        }
    }

    private func numero(_ value: Any?) -> Int {
        if let value = value as? Int {
            return value
        }

        if let value = value as? NSNumber {
            return value.intValue
        }

        if let value = value as? String {
            return Int(value) ?? 0
        }

        return 0
    }

    private func applica(_ dati: [String: Any]) {
        if let shared = UserDefaults(suiteName: "group.com.vigilanzagpg.app.watch") {
            shared.set(dati["stato"] as? String ?? "", forKey: "stato")
            shared.set(dati["tipo"] as? String ?? "", forKey: "tipo")
            shared.set(dati["giorno"] as? Int ?? 0, forKey: "giorno")
            shared.set(dati["mese"] as? Int ?? 0, forKey: "mese")
            shared.set(dati["anno"] as? Int ?? 0, forKey: "anno")
            shared.set(dati["inizio"] as? String ?? "", forKey: "inizio")
            shared.set(dati["fine"] as? String ?? "", forKey: "fine")
            shared.set(dati["luogo"] as? String ?? "", forKey: "luogo")
            shared.set(dati["indirizzo"] as? String ?? "", forKey: "indirizzo")
            shared.set(dati["countdownLabel"] as? String ?? "", forKey: "countdownLabel")
            shared.set(dati["countdown"] as? String ?? "", forKey: "countdown")
            shared.set(dati["aggiornatoAlle"] as? String ?? "", forKey: "aggiornatoAlle")
            shared.set((dati["temperatura"] as? NSNumber)?.doubleValue ?? 0, forKey: "temperatura")
            shared.set((dati["codiceMeteo"] as? NSNumber)?.intValue ?? -1, forKey: "codiceMeteo")
            shared.set(dati["meteoLocalita"] as? String ?? "", forKey: "meteoLocalita")
            shared.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
        }

        guard !dati.isEmpty else { return }

        stato = dati["stato"] as? String ?? "non_in_servizio"
        tipo = dati["tipo"] as? String ?? ""

        giorno = numero(dati["giorno"])
        mese = numero(dati["mese"])
        anno = numero(dati["anno"])

        inizio = dati["inizio"] as? String ?? ""
        fine = dati["fine"] as? String ?? ""
        luogo = dati["luogo"] as? String ?? ""
        indirizzo = dati["indirizzo"] as? String ?? ""

        countdownLabel = dati["countdownLabel"] as? String ?? ""
        countdown = dati["countdown"] as? String ?? ""
        aggiornatoAlle = dati["aggiornatoAlle"] as? String ?? ""
    }
}


struct ContentView: View {
    @StateObject private var watch = WatchSessionManager.shared

    private let verdeOperativo = Color(red: 0.43, green: 0.95, blue: 0.38)
    private let azzurroTattico = Color(red: 0.35, green: 0.78, blue: 1.00)
    private let rossoAlert = Color(red: 1.00, green: 0.28, blue: 0.34)
    private let fondoCard = Color.white.opacity(0.055)

    private func minuti(_ orario: String) -> (Int, Int)? {
        let parti = orario.split(separator: ":")
        guard parti.count >= 2,
              let ora = Int(parti[0]),
              let minuto = Int(parti[1]) else { return nil }
        return (ora, minuto)
    }

    private func dateTurno() -> (inizio: Date, fine: Date)? {
        guard
            watch.anno > 0,
            watch.mese > 0,
            watch.giorno > 0,
            let oraInizio = minuti(watch.inizio),
            let oraFine = minuti(watch.fine)
        else { return nil }

        var ci = DateComponents()
        ci.year = watch.anno
        ci.month = watch.mese
        ci.day = watch.giorno
        ci.hour = oraInizio.0
        ci.minute = oraInizio.1

        var cf = DateComponents()
        cf.year = watch.anno
        cf.month = watch.mese
        cf.day = watch.giorno
        cf.hour = oraFine.0
        cf.minute = oraFine.1

        guard
            let di = Calendar.current.date(from: ci),
            var df = Calendar.current.date(from: cf)
        else { return nil }

        if df <= di {
            df = Calendar.current.date(byAdding: .day, value: 1, to: df) ?? df
        }

        return (di, df)
    }

    private func inServizio(_ adesso: Date) -> Bool {
        if watch.tipo == "riposo" { return false }
        if let turno = dateTurno() {
            return adesso >= turno.inizio && adesso < turno.fine
        }
        return watch.stato == "in_servizio"
    }

    private func turnoTerminato(_ adesso: Date) -> Bool {
        guard let turno = dateTurno() else { return false }
        return adesso >= turno.fine
    }

    private func countdownReale(_ adesso: Date) -> (String, String)? {
        guard let turno = dateTurno() else {
            if !watch.countdown.isEmpty && watch.countdown != "--h --m" {
                return (watch.countdownLabel, watch.countdown)
            }
            return nil
        }

        let destinazione: Date
        let label: String

        if adesso < turno.inizio {
            destinazione = turno.inizio
            label = "START MISSION"
        } else if adesso < turno.fine {
            destinazione = turno.fine
            label = "END MISSION"
        } else {
            return nil
        }

        let secondi = max(0, Int(destinazione.timeIntervalSince(adesso)))
        let ore = secondi / 3600
        let minuti = (secondi % 3600) / 60

        return (
            label,
            String(format: "%02dh %02dm", ore, minuti)
        )
    }

    private func testoStato(_ adesso: Date) -> String {
        if watch.tipo == "riposo" { return "OFF DUTY" }
        if inServizio(adesso) { return "ON DUTY" }
        if turnoTerminato(adesso) { return "MISSION COMPLETE" }
        return "STANDBY"
    }

    private func coloreStato(_ adesso: Date) -> Color {
        if watch.tipo == "riposo" { return .orange }
        if inServizio(adesso) { return verdeOperativo }
        return azzurroTattico
    }


    private func avanzamentoTurno(_ adesso: Date) -> Double {
        guard let turno = dateTurno() else { return 0 }

        let totale = turno.fine.timeIntervalSince(turno.inizio)
        guard totale > 0 else { return 0 }

        if adesso <= turno.inizio { return 0 }
        if adesso >= turno.fine { return 1 }

        let trascorso = adesso.timeIntervalSince(turno.inizio)
        return min(max(trascorso / totale, 0), 1)
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            let adesso = timeline.date
            let servizio = inServizio(adesso)
            let countdown = countdownReale(adesso)
            let statoColore = coloreStato(adesso)

            ScrollView {
                VStack(spacing: 8) {

                    // TOP BAR
                    HStack(spacing: 7) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(statoColore.opacity(0.16))
                                .frame(width: 32, height: 32)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .stroke(statoColore.opacity(0.28), lineWidth: 1)
                                )

                            Image(systemName: "shield.lefthalf.filled")
                                .font(.system(size: 16, weight: .black))
                                .foregroundStyle(statoColore)
                        }

                        VStack(alignment: .leading, spacing: 1) {
                            Text("VIGILANZA GPG")
                                .font(.system(size: 11, weight: .black, design: .rounded))

                            HStack(spacing: 3) {
                                Rectangle()
                                    .fill(statoColore)
                                    .frame(width: 10, height: 1)

                                Text("CONTROL ROOM")
                                    .font(.system(size: 6, weight: .black))
                                    .tracking(1.2)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 0) {
                            Text(adesso, style: .time)
                                .font(.system(size: 12, weight: .black, design: .monospaced))
                                .foregroundStyle(.primary)

                            Text(servizio ? "LIVE OPS" : "SYSTEM READY")
                                .font(.system(size: 6, weight: .black))
                                .tracking(0.8)
                                .foregroundStyle(statoColore)
                        }
                    }

                    // STATUS STRIP
                    HStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(statoColore.opacity(0.18))
                                .frame(width: 14, height: 14)

                            Circle()
                                .fill(statoColore)
                                .frame(width: 6, height: 6)
                        }

                        Text(testoStato(adesso))
                            .font(.system(size: 10, weight: .black))
                            .tracking(1.0)
                            .foregroundStyle(statoColore)

                        Spacer()

                        Text(servizio ? "ACTIVE" : "READY")
                            .font(.system(size: 7, weight: .black))
                            .tracking(0.7)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(
                                Capsule()
                                    .fill(statoColore.opacity(0.13))
                                    .overlay(
                                        Capsule()
                                            .stroke(statoColore.opacity(0.25), lineWidth: 1)
                                    )
                            )
                            .foregroundStyle(statoColore)
                    }

                    // MAIN MISSION CARD
                    VStack(spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 4) {
                                    Image(systemName: "scope")
                                        .font(.system(size: 8, weight: .black))
                                        .foregroundStyle(statoColore)

                                    Text("MISSION WINDOW")
                                        .font(.system(size: 7, weight: .black))
                                        .tracking(1.2)
                                        .foregroundStyle(.secondary)
                                }

                                HStack(alignment: .firstTextBaseline, spacing: 5) {
                                    Text(watch.inizio.isEmpty ? "--:--" : watch.inizio)
                                        .font(.system(size: 28, weight: .black, design: .rounded))
                                        .monospacedDigit()
                                        .foregroundStyle(.primary)

                                    Text("→")
                                        .font(.system(size: 12, weight: .black))
                                        .foregroundStyle(statoColore)

                                    Text(watch.fine.isEmpty ? "--:--" : watch.fine)
                                        .font(.system(size: 19, weight: .black, design: .rounded))
                                        .monospacedDigit()
                                        .foregroundStyle(.primary)
                                }
                            }

                            Spacer()
                        }

                        Divider()
                            .overlay(statoColore.opacity(0.22))

                        HStack(spacing: 6) {
                            Image(systemName: "scope")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(statoColore)

                            VStack(alignment: .leading, spacing: 1) {
                                Text(watch.luogo.isEmpty ? "POSTAZIONE NON DEFINITA" : watch.luogo.uppercased())
                                    .font(.system(size: 10, weight: .black))
                                    .lineLimit(1)

                                if !watch.indirizzo.isEmpty {
                                    Text(watch.indirizzo)
                                        .font(.system(size: 8, weight: .medium))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }

                            Spacer()
                        }
                    }
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(fondoCard)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(statoColore.opacity(0.28), lineWidth: 1)
                            )
                    )

                    // PROGRESS TURNO
                    if dateTurno() != nil {
                        let progresso = avanzamentoTurno(adesso)

                        VStack(spacing: 3) {
                            HStack {
                                Text("MISSION PROGRESS")
                                    .font(.system(size: 6, weight: .black))
                                    .tracking(1.1)
                                    .foregroundStyle(.secondary)

                                Spacer()

                                Text("\(Int(progresso * 100))%")
                                    .font(.system(size: 7, weight: .black, design: .monospaced))
                                    .foregroundStyle(statoColore)
                            }

                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(Color.white.opacity(0.07))

                                    Capsule()
                                        .fill(statoColore)
                                        .frame(width: geo.size.width * progresso)
                                }
                            }
                            .frame(height: 4)
                        }
                        .padding(.horizontal, 2)
                    }

                    // COUNTDOWN HUD
                    if let countdown {
                        VStack(spacing: 5) {
                            HStack(spacing: 5) {
                                Rectangle()
                                    .fill(statoColore.opacity(0.45))
                                    .frame(height: 1)

                                Text(countdown.0)
                                    .font(.system(size: 7, weight: .black))
                                    .tracking(1.5)
                                    .foregroundStyle(.secondary)

                                Rectangle()
                                    .fill(statoColore.opacity(0.45))
                                    .frame(height: 1)
                            }

                            ZStack {
                                RoundedRectangle(cornerRadius: 11, style: .continuous)
                                    .fill(statoColore.opacity(0.07))

                                HStack(spacing: 6) {
                                    Image(systemName: servizio ? "hourglass.bottomhalf.filled" : "clock.badge")
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundStyle(statoColore)

                                    Text(countdown.1)
                                        .font(.system(size: 25, weight: .black, design: .rounded))
                                        .monospacedDigit()
                                        .foregroundStyle(.primary)
                                }
                                .padding(.vertical, 6)
                            }

                            HStack {
                                Text(servizio ? "TEMPO RESIDUO OPERATIVO" : "TEMPO AL PROSSIMO SERVIZIO")
                                    .font(.system(size: 6, weight: .black))
                                    .tracking(0.9)
                                    .foregroundStyle(.secondary)

                                Spacer()

                                Text(servizio ? "OPS" : "READY")
                                    .font(.system(size: 6, weight: .black))
                                    .tracking(0.7)
                                    .foregroundStyle(statoColore)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.white.opacity(0.045))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(statoColore.opacity(0.24), lineWidth: 1)
                                )
                        )
                    }

                    // FOOTER
                    HStack(spacing: 5) {
                        Circle()
                            .fill(watch.aggiornatoAlle.isEmpty ? Color.orange : statoColore)
                            .frame(width: 5, height: 5)

                        Image(systemName: "antenna.radiowaves.left.and.right")
                            .font(.system(size: 8))
                            .foregroundStyle(statoColore)

                        Text(watch.aggiornatoAlle.isEmpty ? "SYNC WAIT" : "SYNC OK")
                            .font(.system(size: 6, weight: .black))
                            .tracking(1.0)
                            .foregroundStyle(.secondary)

                        Spacer()

                        if !watch.aggiornatoAlle.isEmpty {
                            Text("LIVE")
                                .font(.system(size: 6, weight: .black))
                                .foregroundStyle(statoColore)
                        }
                    }
                    .padding(.horizontal, 3)
                }
                .padding(.horizontal, 5)
                .padding(.bottom, 6)
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
