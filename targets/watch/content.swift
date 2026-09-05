import SwiftUI
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
                    HStack(spacing: 6) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(statoColore.opacity(0.14))
                                .frame(width: 30, height: 30)

                            Image(systemName: "shield.lefthalf.filled")
                                .font(.system(size: 15, weight: .black))
                                .foregroundStyle(statoColore)
                        }

                        VStack(alignment: .leading, spacing: 0) {
                            Text("VIGILANZA GPG")
                                .font(.system(size: 11, weight: .black, design: .rounded))

                            Text("TACTICAL UNIT")
                                .font(.system(size: 7, weight: .bold))
                                .tracking(1.1)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Text(adesso, style: .time)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }

                    // STATUS STRIP
                    HStack(spacing: 6) {
                        Circle()
                            .fill(statoColore)
                            .frame(width: 7, height: 7)

                        Text(testoStato(adesso))
                            .font(.system(size: 9, weight: .black))
                            .tracking(0.9)
                            .foregroundStyle(statoColore)

                        Spacer()

                        Text(servizio ? "ACTIVE" : "READY")
                            .font(.system(size: 7, weight: .black))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(
                                Capsule()
                                    .fill(statoColore.opacity(0.13))
                            )
                            .foregroundStyle(statoColore)
                    }

                    // MAIN MISSION CARD
                    VStack(spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text("MISSION WINDOW")
                                    .font(.system(size: 7, weight: .black))
                                    .tracking(1.2)
                                    .foregroundStyle(.secondary)

                                HStack(alignment: .firstTextBaseline, spacing: 5) {
                                    Text(watch.inizio.isEmpty ? "--:--" : watch.inizio)
                                        .font(.system(size: 27, weight: .black, design: .rounded))
                                        .monospacedDigit()

                                    Text("→")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(.secondary)

                                    Text(watch.fine.isEmpty ? "--:--" : watch.fine)
                                        .font(.system(size: 18, weight: .bold, design: .rounded))
                                        .monospacedDigit()
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
                        VStack(spacing: 2) {
                            HStack {
                                Rectangle()
                                    .fill(statoColore.opacity(0.45))
                                    .frame(height: 1)

                                Text(countdown.0)
                                    .font(.system(size: 7, weight: .black))
                                    .tracking(1.4)
                                    .foregroundStyle(.secondary)

                                Rectangle()
                                    .fill(statoColore.opacity(0.45))
                                    .frame(height: 1)
                            }

                            Text(countdown.1)
                                .font(.system(size: 24, weight: .black, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(statoColore)

                            Text(servizio ? "TEMPO RESIDUO OPERATIVO" : "TEMPO AL PROSSIMO SERVIZIO")
                                .font(.system(size: 6, weight: .bold))
                                .tracking(0.8)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .padding(.horizontal, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .fill(statoColore.opacity(0.08))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                                        .stroke(statoColore.opacity(0.18), lineWidth: 1)
                                )
                        )
                    }

                    // FOOTER
                    HStack {
                        Image(systemName: "antenna.radiowaves.left.and.right")
                            .font(.system(size: 8))
                            .foregroundStyle(statoColore)

                        Text("SYNC LINK")
                            .font(.system(size: 6, weight: .black))
                            .tracking(1.0)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Text("SECURE")
                            .font(.system(size: 6, weight: .black))
                            .foregroundStyle(statoColore)
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
