package io.github.pixelkeyhq.app.webcookies

import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewDatabase
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WebCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WebCookies")

    AsyncFunction("getCookie") { url: String, name: String, promise: Promise ->
      val header = CookieManager.getInstance().getCookie(url)
      val value = header?.split(';')?.map { it.trim() }?.firstOrNull { it.startsWith("$name=") }?.substring(name.length + 1)
      promise.resolve(if (value.isNullOrEmpty()) null else value)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearAll") { promise: Promise ->
      val context = appContext.reactContext
      WebStorage.getInstance().deleteAllData()
      if (context != null) {
        WebViewDatabase.getInstance(context).clearHttpAuthUsernamePassword()
        WebView(context).apply { clearCache(true); clearFormData(); clearHistory(); destroy() }
      }
      val cookies = CookieManager.getInstance()
      cookies.removeAllCookies {
        cookies.flush()
        promise.resolve(null)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
