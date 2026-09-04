import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

public class SecretClipboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SecretClipboard")

    AsyncFunction("copy") { (text: String) in
      UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: text]], options: [.localOnly: true])
    }.runOnQueue(.main)
  }
}
