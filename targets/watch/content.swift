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

    private let blu = Color(
        red: 0.20,
        green: 0.62,
        blue: 1.00
    )

    private let azzurro = Color(
        red: 0.30,
        green: 0.84,
        blue: 1.00
    )

    private let verde = Color(
        red: 0.25,
        green: 0.90,
        blue: 0.58
    )

    private let rosso = Color(
        red: 1.00,
        green: 0.33,
        blue: 0.42
    )


    // MARK: - DATE TURNO

    private func minuti(_ orario: String) -> (Int, Int)? {
        let parti = orario.split(separator: ":")

        guard parti.count >= 2,
              let ora = Int(parti[0]),
              let minuto = Int(parti[1])
        else {
            return nil
        }

        return (ora, minuto)
    }

    private func dateTurno() -> (inizio: Date, fine: Date)? {
        guard
            watch.anno > 0,
            watch.mese > 0,
            watch.giorno > 0,
            let oraInizio = minuti(watch.inizio),
            let oraFine = minuti(watch.fine)
        else {
            return nil
        }

        var componentiInizio = DateComponents()
        componentiInizio.year = watch.anno
        componentiInizio.month = watch.mese
        componentiInizio.day = watch.giorno
        componentiInizio.hour = oraInizio.0
        componentiInizio.minute = oraInizio.1

        var componentiFine = DateComponents()
        componentiFine.year = watch.anno
        componentiFine.month = watch.mese
        componentiFine.day = watch.giorno
        componentiFine.hour = oraFine.0
        componentiFine.minute = oraFine.1

        guard
            let dataInizio = Calendar.current.date(from: componentiInizio),
            var dataFine = Calendar.current.date(from: componentiFine)
        else {
            return nil
        }

        if dataFine <= dataInizio {
            dataFine = Calendar.current.date(
                byAdding: .day,
                value: 1,
                to: dataFine
            ) ?? dataFine
        }

        return (dataInizio, dataFine)
    }


    // MARK: - STATO REALE

    private func inServizio(_ adesso: Date) -> Bool {
        if watch.tipo == "riposo" {
            return false
        }

        if let turno = dateTurno() {
            return adesso >= turno.inizio &&
                   adesso < turno.fine
        }

        return watch.stato == "in_servizio"
    }

    private func turnoTerminato(_ adesso: Date) -> Bool {
        guard let turno = dateTurno() else {
            return false
        }

        return adesso >= turno.fine
    }


    // MARK: - COUNTDOWN REALE

    private func countdownReale(_ adesso: Date) -> (String, String)? {
        guard let turno = dateTurno() else {
            if !watch.countdown.isEmpty &&
               watch.countdown != "--h --m" {
                return (
                    watch.countdownLabel,
                    watch.countdown
                )
            }

            return nil
        }

        let destinazione: Date
        let label: String

        if adesso < turno.inizio {
            destinazione = turno.inizio
            label = "INIZIA TRA"
        } else if adesso < turno.fine {
            destinazione = turno.fine
            label = "FINE TRA"
        } else {
            return nil
        }

        let secondi = max(
            0,
            Int(destinazione.timeIntervalSince(adesso))
        )

        let ore = secondi / 3600
        let minuti = (secondi % 3600) / 60

        return (
            label,
            String(
                format: "%02dh %02dm",
                ore,
                minuti
            )
        )
    }


    // MARK: - TESTI

    private func testoStato(_ adesso: Date) -> String {
        if watch.tipo == "riposo" {
            return "RIPOSO"
        }

        if inServizio(adesso) {
            return "IN SERVIZIO"
        }

        if turnoTerminato(adesso) {
            return "SERVIZIO TERMINATO"
        }

        return "NON IN SERVIZIO"
    }

    private func coloreStato(_ adesso: Date) -> Color {
        if watch.tipo == "riposo" {
            return .orange
        }

        if inServizio(adesso) {
            return verde
        }

        return azzurro
    }


    // MARK: - VIEW

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in

            let adesso = timeline.date
            let servizio = inServizio(adesso)
            let countdown = countdownReale(adesso)

            ScrollView {
                VStack(spacing: 8) {

                    // HEADER
                    HStack(spacing: 7) {
                        ZStack {
                            Circle()
                                .fill(
                                    blu.opacity(0.18)
                                )
                                .frame(
                                    width: 28,
                                    height: 28
                                )

                            Image(
                                systemName:
                                    "shield.checkered"
                            )
                            .font(
                                .system(
                                    size: 15,
                                    weight: .bold
                                )
                            )
                            .foregroundStyle(
                                servizio ? verde : azzurro
                            )
                        }

                        VStack(
                            alignment: .leading,
                            spacing: 0
                        ) {
                            Text("VIGILANZA")
                                .font(
                                    .system(
                                        size: 11,
                                        weight: .black,
                                        design: .rounded
                                    )
                                )

                            Text("GPG")
                                .font(
                                    .system(
                                        size: 9,
                                        weight: .bold
                                    )
                                )
                                .foregroundStyle(
                                    azzurro
                                )
                        }

                        Spacer()

                        Text(
                            adesso,
                            style: .time
                        )
                        .font(
                            .system(
                                size: 12,
                                weight: .bold,
                                design: .rounded
                            )
                        )
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    }


                    // CARD STATO
                    VStack(spacing: 5) {

                        HStack {
                            Circle()
                                .fill(
                                    coloreStato(adesso)
                                )
                                .frame(
                                    width: 7,
                                    height: 7
                                )

                            Text(
                                testoStato(adesso)
                            )
                            .font(
                                .system(
                                    size: 10,
                                    weight: .black
                                )
                            )
                            .foregroundStyle(
                                coloreStato(adesso)
                            )

                            Spacer()
                        }

                        HStack(
                            alignment: .firstTextBaseline
                        ) {

                            if !watch.inizio.isEmpty {
                                Text(watch.inizio)
                                    .font(
                                        .system(
                                            size: 26,
                                            weight: .black,
                                            design: .rounded
                                        )
                                    )
                                    .monospacedDigit()
                            }

                            if !watch.fine.isEmpty {
                                Text("—")
                                    .font(
                                        .system(
                                            size: 13,
                                            weight: .bold
                                        )
                                    )
                                    .foregroundStyle(
                                        .secondary
                                    )

                                Text(watch.fine)
                                    .font(
                                        .system(
                                            size: 18,
                                            weight: .bold,
                                            design: .rounded
                                        )
                                    )
                                    .monospacedDigit()
                            }

                            Spacer()
                        }
                    }
                    .padding(10)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 16,
                            style: .continuous
                        )
                        .fill(
                            Color.white.opacity(0.075)
                        )
                        .overlay(
                            RoundedRectangle(
                                cornerRadius: 16,
                                style: .continuous
                            )
                            .stroke(
                                coloreStato(adesso)
                                    .opacity(0.23),
                                lineWidth: 1
                            )
                        )
                    )


                    // LUOGO
                    if !watch.luogo.isEmpty ||
                       !watch.indirizzo.isEmpty {

                        VStack(
                            alignment: .leading,
                            spacing: 4
                        ) {
                            HStack(spacing: 6) {
                                Image(
                                    systemName:
                                        "mappin.circle.fill"
                                )
                                .font(.system(size: 14))
                                .foregroundStyle(rosso)

                                Text(
                                    watch.luogo.isEmpty
                                        ? "Servizio"
                                        : watch.luogo
                                )
                                .font(
                                    .system(
                                        size: 11,
                                        weight: .bold
                                    )
                                )
                                .lineLimit(2)

                                Spacer()
                            }

                            if !watch.indirizzo.isEmpty {
                                Text(watch.indirizzo)
                                    .font(
                                        .system(
                                            size: 9,
                                            weight: .medium
                                        )
                                    )
                                    .foregroundStyle(
                                        .secondary
                                    )
                                    .lineLimit(2)
                                    .padding(
                                        .leading,
                                        20
                                    )
                            }
                        }
                        .padding(
                            .horizontal,
                            8
                        )
                        .padding(
                            .vertical,
                            5
                        )
                    }


                    // COUNTDOWN
                    if let countdown {

                        VStack(spacing: 1) {
                            Text(countdown.0)
                                .font(
                                    .system(
                                        size: 8,
                                        weight: .black
                                    )
                                )
                                .tracking(1.0)
                                .foregroundStyle(
                                    .secondary
                                )

                            Text(countdown.1)
                                .font(
                                    .system(
                                        size: 22,
                                        weight: .black,
                                        design: .rounded
                                    )
                                )
                                .monospacedDigit()
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(
                                cornerRadius: 15,
                                style: .continuous
                            )
                            .fill(
                                blu.opacity(0.12)
                            )
                            .overlay(
                                RoundedRectangle(
                                    cornerRadius: 15,
                                    style: .continuous
                                )
                                .stroke(
                                    azzurro.opacity(0.20),
                                    lineWidth: 1
                                )
                            )
                        )
                    }


                    // NESSUN TURNO
                    if watch.inizio.isEmpty &&
                       watch.fine.isEmpty {

                        VStack(spacing: 5) {
                            Image(
                                systemName:
                                    watch.tipo == "riposo"
                                    ? "bed.double.fill"
                                    : "calendar.badge.clock"
                            )
                            .foregroundStyle(
                                watch.tipo == "riposo"
                                ? .orange
                                : .secondary
                            )

                            Text(
                                watch.tipo == "riposo"
                                ? "Giornata di riposo"
                                : "Nessun turno sincronizzato"
                            )
                            .font(
                                .system(
                                    size: 10,
                                    weight: .semibold
                                )
                            )
                            .multilineTextAlignment(
                                .center
                            )
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
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
