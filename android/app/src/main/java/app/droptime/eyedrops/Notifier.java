package app.droptime.eyedrops;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.net.Uri;

/**
 * The ringing alarm: a full-screen notification on the alarm sound stream
 * (so it rings even when the phone is on silent), repeating until someone
 * stops it, opens the app, or 10 minutes pass.
 */
final class Notifier {
    // A notification channel keeps its sound for good, so each loudness step (Settings)
    // has its own channel with its own sound file (res/raw/alarm_1 .. alarm_5). Only the
    // channel for the current step exists. v3: the earlier channels had the silent sound.
    static final String CHANNEL_PREFIX = "drop_alarms_";
    static final int DEFAULT_LEVEL = 5;
    static final int MAX_LEVEL = 5;
    private static final int NOTIFICATION_ID = 42;
    private static final long RING_FOR_MS = 10 * 60_000L;

    private Notifier() {}

    /** Loudness step 1 (quiet) to 5 (loudest) chosen in the app. */
    static int level(Context c) {
        int level = AlarmScheduler.prefs(c).getInt(AlarmScheduler.KEY_LEVEL, DEFAULT_LEVEL);
        return Math.max(1, Math.min(MAX_LEVEL, level));
    }

    static String channelId(int level) {
        return CHANNEL_PREFIX + "v3_" + level;
    }

    static void setLevel(Context c, int level) {
        AlarmScheduler.prefs(c).edit().putInt(AlarmScheduler.KEY_LEVEL, Math.max(1, Math.min(MAX_LEVEL, level))).apply();
        ensureChannel(c);
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        int level = level(c);
        String id = channelId(level);
        for (NotificationChannel old : nm.getNotificationChannels()) {
            String oldId = old.getId();
            if (oldId.startsWith(CHANNEL_PREFIX) && !oldId.equals(id)) nm.deleteNotificationChannel(oldId);
        }
        if (nm.getNotificationChannel(id) != null) return;
        NotificationChannel ch = new NotificationChannel(id, "Eye drop alarms", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Rings when it is time for an eye drop or tablet");
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        ch.setSound(Uri.parse("android.resource://" + c.getPackageName() + "/raw/alarm_" + level), attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] {0, 700, 300, 700, 300, 700});
        ch.enableLights(true);
        ch.setLightColor(0xFF0B7A70);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);
        nm.createNotificationChannel(ch);
    }

    static void ring(Context c, String title, String text) {
        ensureChannel(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);

        PendingIntent open = activity(c, 2001, "OPEN");
        PendingIntent fullScreen = activity(c, 2002, "FULL_SCREEN");
        PendingIntent stop = broadcast(c, 2003, ActionReceiver.STOP, null, null);
        PendingIntent snooze = broadcast(c, 2004, ActionReceiver.SNOOZE, title, text);
        Icon icon = Icon.createWithResource(c, R.drawable.ic_stat_drop);

        Notification n = new Notification.Builder(c, channelId(level(c)))
                .setSmallIcon(R.drawable.ic_stat_drop)
                .setColor(0xFF0B7A70)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(open)
                .setFullScreenIntent(fullScreen, true)
                .setDeleteIntent(stop)
                .setAutoCancel(true)
                .setShowWhen(true)
                .setTimeoutAfter(RING_FOR_MS)
                .addAction(new Notification.Action.Builder(icon, "Snooze 5 min", snooze).build())
                .addAction(new Notification.Action.Builder(icon, "Stop", stop).build())
                .build();
        n.flags |= Notification.FLAG_INSISTENT;
        nm.notify(NOTIFICATION_ID, n);
        AlarmScheduler.prefs(c).edit().putLong(AlarmScheduler.KEY_RINGING_SINCE, System.currentTimeMillis()).apply();
    }

    /** Stops the sound. `byUser` = stopped from the notification, so the app counts it as silenced. */
    static void stop(Context c, boolean byUser) {
        c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        android.content.SharedPreferences.Editor e = AlarmScheduler.prefs(c).edit().remove(AlarmScheduler.KEY_RINGING_SINCE);
        if (byUser) e.putLong(AlarmScheduler.KEY_STOPPED_AT, System.currentTimeMillis());
        e.apply();
    }

    private static PendingIntent activity(Context c, int req, String action) {
        Intent i = new Intent(c, MainActivity.class)
                .setAction(c.getPackageName() + "." + action)
                .putExtra(MainActivity.EXTRA_FROM_ALARM, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent broadcast(Context c, int req, String action, String title, String text) {
        Intent i = new Intent(c, ActionReceiver.class).setAction(action);
        if (title != null) i.putExtra("title", title);
        if (text != null) i.putExtra("text", text);
        return PendingIntent.getBroadcast(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
