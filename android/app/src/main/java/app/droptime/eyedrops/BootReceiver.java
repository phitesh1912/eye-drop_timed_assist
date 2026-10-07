package app.droptime.eyedrops;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms are cleared when the phone restarts or the clock changes: book them again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Notifier.ensureChannel(c);
        AlarmScheduler.scheduleNext(c);
    }
}
