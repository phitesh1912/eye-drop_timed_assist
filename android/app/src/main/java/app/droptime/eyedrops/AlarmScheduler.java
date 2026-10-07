package app.droptime.eyedrops;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps the list of upcoming alarms (sent by the web app) and always has the
 * next one booked with AlarmManager.setAlarmClock, which rings on time even in
 * battery-saving Doze mode. When an alarm fires, the next one is booked.
 */
final class AlarmScheduler {
    static final String PREFS = "droptime_alarms";
    static final String KEY_STOPPED_AT = "stopped_at";
    static final String KEY_RINGING_SINCE = "ringing_since";
    private static final String KEY_LIST = "list";
    private static final String KEY_NEXT = "next_at";

    private static final int REQ_NEXT = 1001;
    private static final int REQ_SNOOZE = 1002;
    private static final int REQ_TEST = 1003;
    private static final int REQ_SHOW = 1004;

    private AlarmScheduler() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Replaces the whole alarm list: [{"at": millis, "title": "...", "text": "..."}]. */
    static void saveList(Context c, String json) {
        try {
            new JSONArray(json);
        } catch (Exception e) {
            return;
        }
        prefs(c).edit().putString(KEY_LIST, json).commit();
        scheduleNext(c);
    }

    static void scheduleNext(Context c) {
        long now = System.currentTimeMillis();
        JSONObject next = null;
        try {
            JSONArray arr = new JSONArray(prefs(c).getString(KEY_LIST, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject e = arr.getJSONObject(i);
                long at = e.optLong("at", 0);
                if (at > now + 1000 && (next == null || at < next.optLong("at"))) next = e;
            }
        } catch (Exception ignored) {
            // Corrupt list: nothing to book until the app sends a new one.
        }

        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi;
        if (next == null) {
            pi = alarmIntent(c, REQ_NEXT, null, null, 0, false);
            am.cancel(pi);
            prefs(c).edit().remove(KEY_NEXT).apply();
            return;
        }
        long at = next.optLong("at");
        pi = alarmIntent(c, REQ_NEXT, next.optString("title"), next.optString("text"), at, false);
        book(c, am, at, pi);
        prefs(c).edit().putLong(KEY_NEXT, at).apply();
    }

    static void snooze(Context c, String title, String text, int minutes) {
        long at = System.currentTimeMillis() + minutes * 60_000L;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        Intent i = baseIntent(c, REQ_SNOOZE, title, text, at, false).putExtra("snooze", true);
        book(c, am, at, PendingIntent.getBroadcast(c, REQ_SNOOZE, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    static void test(Context c, int seconds) {
        long at = System.currentTimeMillis() + Math.max(5, seconds) * 1000L;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        book(c, am, at, alarmIntent(c, REQ_TEST, "Test alarm · Drop Time",
                "This is how the eye drop alarm rings. Tap Stop.", at, true));
    }

    static long nextAt(Context c) {
        return prefs(c).getLong(KEY_NEXT, 0);
    }

    static boolean canExact(AlarmManager am) {
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    private static void book(Context c, AlarmManager am, long at, PendingIntent pi) {
        try {
            if (canExact(am)) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showIntent(c)), pi);
                return;
            }
        } catch (SecurityException ignored) {
            // Exact alarms were turned off by the user; fall through to the best we can do.
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private static Intent baseIntent(Context c, int req, String title, String text, long at, boolean test) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction(c.getPackageName() + ".ALARM_" + req);
        if (title != null) i.putExtra("title", title);
        if (text != null) i.putExtra("text", text);
        i.putExtra("at", at);
        i.putExtra("test", test);
        return i;
    }

    private static PendingIntent alarmIntent(Context c, int req, String title, String text, long at, boolean test) {
        return PendingIntent.getBroadcast(c, req, baseIntent(c, req, title, text, at, test),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showIntent(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, REQ_SHOW, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
