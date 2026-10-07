package app.droptime.eyedrops;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "Stop" and "Snooze 5 min" buttons on the alarm notification (and swiping it away). */
public class ActionReceiver extends BroadcastReceiver {
    static final String STOP = "app.droptime.eyedrops.STOP";
    static final String SNOOZE = "app.droptime.eyedrops.SNOOZE";

    @Override
    public void onReceive(Context c, Intent i) {
        String action = i.getAction();
        if (SNOOZE.equals(action)) {
            Notifier.stop(c, true);
            AlarmScheduler.snooze(c, i.getStringExtra("title"), i.getStringExtra("text"), 5);
        } else if (STOP.equals(action)) {
            Notifier.stop(c, true);
        }
    }
}
