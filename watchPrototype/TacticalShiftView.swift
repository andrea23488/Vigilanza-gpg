import SwiftUI

struct TacticalShiftView: View {
    private let deepBlack = Color(red: 0.015, green: 0.018, blue: 0.014)
    private let panelBlack = Color(red: 0.045, green: 0.050, blue: 0.038)
    private let olive = Color(red: 0.51, green: 0.55, blue: 0.34)
    private let dimOlive = Color(red: 0.25, green: 0.28, blue: 0.17)
    private let signalOrange = Color(red: 0.88, green: 0.43, blue: 0.16)

    var body: some View {
        ScrollView {
            VStack(spacing: 7) {
                statusHeader
                technicalRule(code: "OPS / 07")
                countdownPanel
                metrics
                navigationPanel
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 5)
        }
        .background(deepBlack.ignoresSafeArea())
    }

    private var statusHeader: some View {
        HStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(olive.opacity(0.35), lineWidth: 2)
                    .frame(width: 12, height: 12)
                Circle()
                    .fill(olive)
                    .frame(width: 5, height: 5)
            }

            VStack(alignment: .leading, spacing: 0) {
                Text("STATO OPERATIVO")
                    .font(.system(size: 7, weight: .medium, design: .monospaced))
                    .foregroundStyle(olive.opacity(0.65))
                    .tracking(0.8)
                Text("IN SERVIZIO")
                    .font(.system(size: 12, weight: .black, design: .rounded))
                    .foregroundStyle(olive)
                    .tracking(1.1)
            }

            Spacer(minLength: 2)

            VStack(alignment: .trailing, spacing: 1) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 12, weight: .bold))
                Text("ATTIVO")
                    .font(.system(size: 6, weight: .bold, design: .monospaced))
            }
            .foregroundStyle(signalOrange)
        }
        .padding(.horizontal, 2)
    }

    private var countdownPanel: some View {
        VStack(spacing: 5) {
            HStack {
                Label("TURNO", systemImage: "clock")
                Spacer()
                Text("20:30—03:30")
                    .foregroundStyle(.white)
            }
            .font(.system(size: 8, weight: .bold, design: .monospaced))
            .foregroundStyle(olive)

            VStack(spacing: 0) {
                Text("TERMINE MISSIONE")
                    .font(.system(size: 7, weight: .semibold, design: .monospaced))
                    .foregroundStyle(olive.opacity(0.7))
                    .tracking(1.2)

                Text("02:14:37")
                    .font(.system(size: 29, weight: .black, design: .monospaced))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)

                HStack(spacing: 12) {
                    timeLegend("ORE")
                    timeLegend("MIN")
                    timeLegend("SEC")
                }
            }

            HStack(spacing: 5) {
                Rectangle()
                    .fill(signalOrange)
                    .frame(width: 2, height: 13)
                Image(systemName: "mappin")
                    .foregroundStyle(signalOrange)
                Text("POSTAZIONE ALFA 07")
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .font(.system(size: 8, weight: .bold, design: .monospaced))
        }
        .padding(8)
        .background(panelBlack)
        .overlay {
            RoundedRectangle(cornerRadius: 7)
                .stroke(dimOlive, lineWidth: 0.8)
        }
        .overlay {
            TacticalCorners(color: olive.opacity(0.75))
                .stroke(lineWidth: 1.2)
                .padding(2)
        }
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    private func timeLegend(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 6, weight: .bold, design: .monospaced))
            .foregroundStyle(olive.opacity(0.55))
            .tracking(0.8)
    }

    private var metrics: some View {
        HStack(spacing: 5) {
            metric(title: "ORE LAVORATE", value: "07:00", accent: olive)
            metric(title: "STRAORDINARIO", value: "+01:00", accent: signalOrange)
        }
    }

    private func metric(title: String, value: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 3) {
                Rectangle()
                    .fill(accent)
                    .frame(width: 8, height: 1)
                Text(title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .font(.system(size: 6, weight: .bold, design: .monospaced))
            .foregroundStyle(olive.opacity(0.65))

            Text(value)
                .font(.system(size: 14, weight: .black, design: .monospaced))
                .foregroundStyle(accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .background(panelBlack)
        .overlay {
            RoundedRectangle(cornerRadius: 5)
                .stroke(dimOlive.opacity(0.8), lineWidth: 0.7)
        }
    }

    private var navigationPanel: some View {
        HStack(spacing: 8) {
            compass

            VStack(alignment: .leading, spacing: 3) {
                Text("ASSETTO")
                    .font(.system(size: 7, weight: .bold, design: .monospaced))
                    .foregroundStyle(olive.opacity(0.6))
                    .tracking(1)
                Text("NNE 018°")
                    .font(.system(size: 14, weight: .black, design: .monospaced))
                    .foregroundStyle(.white)
                Rectangle()
                    .fill(dimOlive)
                    .frame(height: 1)
                HStack(spacing: 4) {
                    Circle()
                        .fill(signalOrange)
                        .frame(width: 4, height: 4)
                    Text("ORIENTAMENTO")
                }
                .font(.system(size: 6, weight: .bold, design: .monospaced))
                .foregroundStyle(olive)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .background(panelBlack.opacity(0.72))
        .overlay {
            RoundedRectangle(cornerRadius: 7)
                .stroke(dimOlive.opacity(0.8), lineWidth: 0.7)
        }
    }

    private var compass: some View {
        ZStack {
            Circle()
                .stroke(dimOlive, lineWidth: 1)
            Circle()
                .stroke(
                    olive.opacity(0.22),
                    style: StrokeStyle(lineWidth: 3, dash: [1, 4])
                )
                .padding(5)

            ForEach(0..<24, id: \.self) { index in
                Rectangle()
                    .fill(index.isMultiple(of: 6) ? olive : dimOlive)
                    .frame(
                        width: 1,
                        height: index.isMultiple(of: 6) ? 7 : 3
                    )
                    .offset(y: -28)
                    .rotationEffect(.degrees(Double(index) * 15))
            }

            compassPoint("N", x: 0, y: -18, highlighted: true)
            compassPoint("E", x: 19, y: 0)
            compassPoint("S", x: 0, y: 18)
            compassPoint("O", x: -19, y: 0)

            Image(systemName: "location.north.fill")
                .font(.system(size: 23, weight: .black))
                .foregroundStyle(olive)
                .shadow(color: deepBlack, radius: 1)
                .rotationEffect(.degrees(18))

            Circle()
                .fill(signalOrange)
                .frame(width: 4, height: 4)
        }
        .frame(width: 64, height: 64)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Bussola, direzione nord nord-est, diciotto gradi"
        )
    }

    private func compassPoint(
        _ label: String,
        x: CGFloat,
        y: CGFloat,
        highlighted: Bool = false
    ) -> some View {
        Text(label)
            .font(.system(size: 6, weight: .black, design: .monospaced))
            .foregroundStyle(
                highlighted ? signalOrange : olive.opacity(0.7)
            )
            .offset(x: x, y: y)
    }

    private func technicalRule(code: String) -> some View {
        HStack(spacing: 5) {
            Rectangle()
                .fill(dimOlive)
                .frame(height: 1)
            Text(code)
                .font(.system(size: 6, weight: .bold, design: .monospaced))
                .foregroundStyle(olive.opacity(0.55))
                .tracking(0.8)
            Rectangle()
                .fill(dimOlive)
                .frame(height: 1)
        }
    }
}

private struct TacticalCorners: Shape {
    func path(in rect: CGRect) -> Path {
        let length: CGFloat = 10
        var path = Path()

        path.move(to: CGPoint(x: rect.minX, y: rect.minY + length))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))

        path.move(to: CGPoint(x: rect.maxX - length, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + length))

        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - length))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX - length, y: rect.maxY))

        path.move(to: CGPoint(x: rect.minX + length, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - length))

        return path
    }
}

#Preview {
    TacticalShiftView()
}
