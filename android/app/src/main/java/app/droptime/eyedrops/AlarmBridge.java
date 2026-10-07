package app.droptime.eyedrops;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/** What the web app can ask the phone to do (window.DropTimeAndroid in JavaScript). */
final class AlarmBridge {
    private final MainActivity activity;
    private final Context context;

    AlarmBridge(MainActivity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    /** Alarm health for the Settings screen. */
    @JavascriptInterface
    public String getInfo() {
        JSONObject o = new JSONObject();
        try {
            o.put("platform", "android");
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("brand", Build.MANUFACTURER);
            o.put("model", Build.MODEL);
            o.put("appVersion", versionName());

            NotificationManager nm = context.getSystemService(NotificationManager.class);
            NotificationChannel ch = nm.getNotificationChannel(Notifier.CHANNEL);
            boolean channelOk = ch == null || ch.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
            o.put("notifications", nm.areNotificationsEnabled() && channelOk);
            o.put("fullScreen", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent());

            o.put("exact", AlarmScheduler.canExact(context.getSystemService(AlarmManager.class)));
            PowerManager pm = context.getSystemService(PowerManager.class);
            o.put("battery", pm.isIgnoringBatteryOptimizations(context.getPackageName()));
            AudioManager audio = context.getSystemService(AudioManager.class);
            o.put("alarmVolume", audio.getStreamVolume(AudioManager.STREAM_ALARM));
            o.put("alarmVolumeMax", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));

            o.put("nextAlarmAt", AlarmScheduler.nextAt(context));
            o.put("stoppedAt", AlarmScheduler.prefs(context).getLong(AlarmScheduler.KEY_STOPPED_AT, 0));
            o.put("ringing", AlarmScheduler.prefs(context).getLong(AlarmScheduler.KEY_RINGING_SINCE, 0) > 0);
        } catch (Exception ignored) {
            // Return whatever was filled in.
        }
        return o.toString();
    }

    /** Full list of upcoming alarms as JSON: [{"at": millis, "title": "...", "text": "..."}]. */
    @JavascriptInterface
    public void setAlarms(String json) {
        AlarmScheduler.saveList(context, json);
    }

    @JavascriptInterface
    public void stopRinging() {
        Notifier.stop(context, false);
        activity.runOnUiThread(() -> activity.showOverLockScreen(false));
    }

    @JavascriptInterface
    public void testAlarm(int seconds) {
        AlarmScheduler.test(context, seconds);
    }

    @JavascriptInterface
    public void playTestSound() {
        activity.runOnUiThread(activity::playTestSound);
    }

    @JavascriptInterface
    public void requestNotifications() {
        activity.runOnUiThread(activity::requestNotificationPermission);
    }

    @JavascriptInterface
    public void openSettings(String which) {
        activity.runOnUiThread(() -> activity.openSettings(which));
    }

    @JavascriptInterface
    public void saveFile(String name, String mime, String content) {
        activity.runOnUiThread(() -> activity.saveFile(name, mime, content));
    }

    @JavascriptInterface
    public void shareText(String text) {
        activity.runOnUiThread(() -> activity.shareText(text));
    }

    private String versionName() {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.versionName;
        } catch (Exception e) {
            return "";
        }
    }
}
