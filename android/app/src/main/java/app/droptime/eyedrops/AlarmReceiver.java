package app.droptime.eyedrops;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fired by AlarmManager at a dose time: rings, then books the next alarm. */
public class AlarmReceiver extends BroadcastReceiver {
    private static final long STALE_MS = 30 * 60_000L;

    @Override
    public void onReceive(Context c, Intent i) {
        boolean test = i.getBooleanExtra("test", false);
        boolean snooze = i.getBooleanExtra("snooze", false);
        if (!test && !snooze) AlarmScheduler.scheduleNext(c);

        // Delivered very late (phone was off): don't ring for something long past.
        long at = i.getLongExtra("at", 0);
        if (!test && at > 0 && System.currentTimeMillis() - at > STALE_MS) return;

        String title = i.getStringExtra("title");
        String text = i.getStringExtra("text");
        Notifier.ring(c,
                title != null && !title.isEmpty() ? title : "Eye drops time",
                text != null && !text.isEmpty() ? text : "Open Drop Time to see which drop.");
    }
}
