import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "shield.checkered")
                .font(.title2)
                .foregroundStyle(.green)

            Text("VIGILANZA")
                .font(.headline)

            Text("Apple Watch")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
