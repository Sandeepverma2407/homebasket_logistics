package com.homebasket.delivery

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OrderAlarmModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var mediaPlayer: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null

  override fun getName(): String = "OrderAlarmModule"

  private fun getSoundResourceId(soundName: String?): Int {
    val clean = (soundName ?: "").lowercase().trim()
    return when {
      clean.contains("classic") -> R.raw.classic_bell
      clean.contains("mysterious") -> R.raw.mysterious
      clean.contains("siren") -> R.raw.siren_alert
      clean.contains("techno") -> R.raw.techno_alert
      clean.contains("order_ring") -> R.raw.order_ring
      else -> R.raw.alarm_ring
    }
  }

  @ReactMethod
  fun playAlarm(soundName: String?, promise: Promise?) {
    try {
      stopInternal()

      wakeScreenInternal()

      val rawResId = getSoundResourceId(soundName)
      val player = MediaPlayer()

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        val audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
          .build()
        player.setAudioAttributes(audioAttributes)
      } else {
        @Suppress("DEPRECATION")
        player.setAudioStreamType(AudioManager.STREAM_ALARM)
      }

      val afd = reactContext.resources.openRawResourceFd(rawResId)
      player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
      afd.close()

      player.isLooping = true
      player.setVolume(1.0f, 1.0f)
      player.prepare()
      player.start()

      mediaPlayer = player
      Log.d("OrderAlarmModule", "Alarm started successfully with sound: $soundName")
      promise?.resolve(true)
    } catch (e: Exception) {
      Log.e("OrderAlarmModule", "Error playing alarm sound: ${e.message}", e)
      promise?.reject("ALARM_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopAlarm(promise: Promise?) {
    try {
      stopInternal()
      promise?.resolve(true)
    } catch (e: Exception) {
      promise?.reject("STOP_ERROR", e.message, e)
    }
  }

  private fun stopInternal() {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) {
          it.stop()
        }
        it.reset()
        it.release()
      }
      mediaPlayer = null
      Log.d("OrderAlarmModule", "Alarm stopped successfully")
    } catch (e: Exception) {
      Log.e("OrderAlarmModule", "Error stopping alarm: ${e.message}")
    } finally {
      mediaPlayer = null
      releaseWakeLock()
    }
  }

  @ReactMethod
  fun wakeScreen(promise: Promise?) {
    try {
      wakeScreenInternal()
      promise?.resolve(true)
    } catch (e: Exception) {
      promise?.reject("WAKE_ERROR", e.message, e)
    }
  }

  private fun wakeScreenInternal() {
    try {
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (pm != null) {
        releaseWakeLock()
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
          PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
          "mtbexpress:order_alarm_wakelock"
        )
        wakeLock?.acquire(15000L) // 15 seconds
      }

      // Ensure activity turns screen on and shows over keyguard
      reactApplicationContext.currentActivity?.runOnUiThread {
        (reactApplicationContext.currentActivity as? MainActivity)?.turnScreenOnAndShowWhenLocked()
      }
    } catch (e: Exception) {
      Log.e("OrderAlarmModule", "Wake screen failed: ${e.message}")
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (e: Exception) {
      // Ignore
    } finally {
      wakeLock = null
    }
  }

  @ReactMethod
  fun isDeviceLocked(promise: Promise) {
    try {
      val km = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      val isLocked = km?.isKeyguardLocked ?: false
      promise.resolve(isLocked)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun getInitialOrderAlert(promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      val intent: Intent? = activity?.intent
      if (intent != null && (intent.getBooleanExtra("isOrderAlert", false) || intent.hasExtra("job_id") || intent.hasExtra("order_id"))) {
        val map = Arguments.createMap()
        val extras: Bundle? = intent.extras
        if (extras != null) {
          for (key in extras.keySet()) {
            val value = extras.get(key)
            if (value != null) {
              map.putString(key, value.toString())
            }
          }
        }
        intent.removeExtra("isOrderAlert")
        promise.resolve(map)
        return
      }
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e("OrderAlarmModule", "Error getting initial order alert: ${e.message}")
      promise.resolve(null)
    }
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    stopInternal()
  }
}

