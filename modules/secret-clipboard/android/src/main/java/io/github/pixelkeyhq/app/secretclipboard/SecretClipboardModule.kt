package io.github.pixelkeyhq.app.secretclipboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.PersistableBundle
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SecretClipboardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SecretClipboard")

    AsyncFunction("copy") { text: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newPlainText("", text)
      clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
      clipboard.setPrimaryClip(clip)
    }.runOnQueue(Queues.MAIN)
  }
}
