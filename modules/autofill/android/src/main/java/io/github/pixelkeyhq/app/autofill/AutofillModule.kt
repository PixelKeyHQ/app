package io.github.pixelkeyhq.app.autofill

import android.os.Build
import android.view.autofill.AutofillManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AutofillModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Autofill")

    AsyncFunction("cancel") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.currentActivity?.getSystemService(AutofillManager::class.java)?.cancel()
      }
    }.runOnQueue(Queues.MAIN)
  }
}
