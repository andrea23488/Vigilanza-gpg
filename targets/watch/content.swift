import SwiftUI
import WatchConnectivity

final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published var stato = "non_in_servizio"
    @Published var tipo = ""
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

    private func applica(_ dati: [String: Any]) {
        guard !dati.isEmpty else { return }

        stato = dati["stato"] as? String ?? "non_in_servizio"
        tipo = dati["tipo"] as? String ?? ""
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

    private var inServizio: Bool {
        watch.stato == "in_servizio"
    }

    private var riposo: Bool {
        watch.tipo == "riposo"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 9) {

                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("VIGILANZA GPG")
                            .font(.system(size: 13, weight: .bold))

                        Text(
                            Date.now,
                            format: .dateTime
                                .weekday(.abbreviated)
                                .day()
                                .month(.abbreviated)
                        )
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Image(systemName: "shield.checkered")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(inServizio ? .green : .blue)
                }

                VStack(spacing: 3) {
                    TimelineView(.periodic(from: .now, by: 60)) { context in
                        Text(context.date, style: .time)
                            .font(.system(size: 29, weight: .bold, design: .rounded))
                            .monospacedDigit()
                    }

                    Text(
                        inServizio
                        ? "IN SERVIZIO"
                        : (riposo ? "RIPOSO" : "NON IN SERVIZIO")
                    )
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(
                        inServizio ? .green : (riposo ? .orange : .secondary)
                    )
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.white.opacity(0.08))
                )

                if !watch.inizio.isEmpty || !watch.fine.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Image(systemName: "clock.fill")
                                .foregroundStyle(.blue)

                            Text("Turno")
                                .font(.system(size: 11, weight: .semibold))

                            Spacer()

                            Text("\(watch.inizio) – \(watch.fine)")
                                .font(.system(size: 12, weight: .bold))
                        }

                        if !watch.luogo.isEmpty {
                            HStack(alignment: .top) {
                                Image(systemName: "mappin.and.ellipse")
                                    .foregroundStyle(.red)

                                Text(watch.luogo)
                                    .font(.system(size: 11, weight: .semibold))
                                    .lineLimit(2)
                            }
                        }

                        if !watch.indirizzo.isEmpty {
                            Text(watch.indirizzo)
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    .padding(9)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(.white.opacity(0.06))
                    )
                } else {
                    VStack(spacing: 5) {
                        Image(systemName: riposo ? "bed.double.fill" : "calendar.badge.clock")
                            .foregroundStyle(riposo ? .orange : .secondary)

                        Text(
                            riposo
                            ? "Giornata di riposo"
                            : "Nessun turno sincronizzato"
                        )
                        .font(.system(size: 11, weight: .semibold))
                        .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }

                if !watch.countdown.isEmpty &&
                   watch.countdown != "--h --m" {

                    VStack(spacing: 2) {
                        Text(watch.countdownLabel)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.secondary)

                        Text(watch.countdown)
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .monospacedDigit()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(.blue.opacity(0.12))
                    )
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
