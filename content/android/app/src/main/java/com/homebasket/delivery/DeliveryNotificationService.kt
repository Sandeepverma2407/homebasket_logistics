package com.homebasket.delivery

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class DeliveryNotificationService : FirebaseMessagingService() {

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)

    val data = remoteMessage.data
    val notif = remoteMessage.notification
    Log.d("DeliveryNotifService", "Received message: data=$data, notif=${notif?.title}")

    val type = data["type"] ?: ""
    val target = data["target"] ?: ""
    val isAlertFlag = data["is_order_alert"] == "1"
    val hasJob = data.containsKey("job_id") || data.containsKey("order_id") || data.containsKey("sub_order_id")
    val titleMatch = notif?.title?.contains("order", ignoreCase = true) == true ||
      notif?.title?.contains("alert", ignoreCase = true) == true ||
      data["title"]?.contains("order", ignoreCase = true) == true

    val isOrderAlert = (
      type.equals("order", ignoreCase = true) ||
      type.equals("new_order", ignoreCase = true) ||
      type.equals("delivery", ignoreCase = true) ||
      type.equals("test", ignoreCase = true) ||
      target.equals("partner", ignoreCase = true) ||
      target.equals("delivery_partner", ignoreCase = true) ||
      isAlertFlag ||
      hasJob ||
      titleMatch
    )

    if (isOrderAlert) {
      handleIncomingOrderLockscreen(data, notif?.title, notif?.body)
    }
  }

  private fun handleIncomingOrderLockscreen(data: Map<String, String>, title: String?, body: String?) {
    try {
      // 1. Wake the screen up immediately
      val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
      @Suppress("DEPRECATION")
      val wakeLock = pm?.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
          PowerManager.ACQUIRE_CAUSES_WAKEUP or
          PowerManager.ON_AFTER_RELEASE,
        "mtbexpress:incoming_order_wake"
      )
      wakeLock?.acquire(15000L) // 15 seconds

      val displayTitle = title ?: data["title"] ?: "🚨 New Order Request!"
      val displayBody = body ?: data["body"] ?: "Tap to accept new delivery job"
      val channelId = "order_channel_v5_alarm_ring"

      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      // Ensure channel exists with ALARM audio attributes and MAX importance
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val soundUri = Uri.parse("android.resource://" + packageName + "/" + R.raw.alarm_ring)
        val audioAttr = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
          .build()

        val channel = NotificationChannel(
          channelId,
          "Incoming Order Alerts (Loud)",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Wakes up screen and sounds loud alarm for incoming delivery orders"
          enableLights(true)
          lightColor = Color.parseColor("#00C896")
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
          setSound(soundUri, audioAttr)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
          setBypassDnd(true)
        }
        notificationManager.createNotificationChannel(channel)
      }

      // Intent to launch MainActivity
      val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("isOrderAlert", true)
        for ((k, v) in data) {
          putExtra(k, v)
        }
        if (title != null) putExtra("title", title)
        if (body != null) putExtra("body", body)
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }

      val pendingIntent = PendingIntent.getActivity(
        this,
        (System.currentTimeMillis() % 10000).toInt(),
        fullScreenIntent,
        flags
      )

      val soundUri = Uri.parse("android.resource://" + packageName + "/" + R.raw.alarm_ring)

      val notificationBuilder = NotificationCompat.Builder(this, channelId)
        .setSmallIcon(R.drawable.notification_icon)
        .setContentTitle(displayTitle)
        .setContentText(displayBody)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setColor(Color.parseColor("#00C896"))
        .setSound(soundUri)
        .setVibrate(longArrayOf(0, 600, 300, 600, 300, 600))
        .setContentIntent(pendingIntent)
        .setFullScreenIntent(pendingIntent, true) // Launches Activity over Lock Screen & turns screen ON

      val notificationId = (System.currentTimeMillis() % 100000).toInt()
      notificationManager.notify(notificationId, notificationBuilder.build())

    } catch (e: Exception) {
      Log.e("DeliveryNotifService", "Error handling incoming order lockscreen: ${e.message}", e)
    }
  }

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    Log.d("DeliveryNotifService", "Refreshed FCM token: $token")
  }
}

