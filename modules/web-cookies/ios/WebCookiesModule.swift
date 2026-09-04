import ExpoModulesCore
import WebKit

public class WebCookiesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WebCookies")

    AsyncFunction("getCookie") { (url: String, name: String, promise: Promise) in
      guard let host = URL(string: url)?.host?.lowercased() else { promise.resolve(nil); return }
      let stores = Self.stores()
      var found: String?
      let group = DispatchGroup()
      for store in stores {
        group.enter()
        store.httpCookieStore.getAllCookies { cookies in
          if found == nil, let cookie = cookies.first(where: { $0.name == name && Self.matches(host: host, domain: $0.domain) && !$0.value.isEmpty }) {
            found = cookie.value
          }
          group.leave()
        }
      }
      group.notify(queue: .main) { promise.resolve(found) }
    }.runOnQueue(.main)

    AsyncFunction("clearAll") { (promise: Promise) in
      let stores = Self.stores()
      let group = DispatchGroup()
      for store in stores {
        group.enter()
        store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { group.leave() }
      }
      HTTPCookieStorage.shared.removeCookies(since: .distantPast)
      URLCache.shared.removeAllCachedResponses()
      group.notify(queue: .main) { promise.resolve(nil) }
    }.runOnQueue(.main)
  }

  private static func matches(host: String, domain: String) -> Bool {
    let d = domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
    return host == d || host.hasSuffix("." + d)
  }

  private static func stores() -> [WKWebsiteDataStore] {
    var result: [WKWebsiteDataStore] = [WKWebsiteDataStore.default()]
    for scene in UIApplication.shared.connectedScenes {
      guard let windows = (scene as? UIWindowScene)?.windows else { continue }
      for window in windows { collect(window, into: &result) }
    }
    return result
  }

  private static func collect(_ view: UIView, into result: inout [WKWebsiteDataStore]) {
    if let web = view as? WKWebView {
      let store = web.configuration.websiteDataStore
      if !result.contains(where: { $0 === store }) { result.append(store) }
    }
    for child in view.subviews { collect(child, into: &result) }
  }
}
