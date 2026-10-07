package app.droptime.eyedrops;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Shows the Drop Time web app (bundled inside the APK, works offline). */
public class MainActivity extends Activity {
    static final String EXTRA_FROM_ALARM = "fromAlarm";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final String NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";
    private static final int REQ_FILE = 11;
    private static final int REQ_SAVE = 12;
    private static final int REQ_NOTIFICATIONS = 13;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSave;
    private MediaPlayer testPlayer;
    private long permissionAskedAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannel(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFFEEF3F2);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new AlarmBridge(this), "DropTimeAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetResponse(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                // Phone calls, WhatsApp, web links: open in the right app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No app for this link.
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose the backup file"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        handleAlarmIntent(getIntent());
        web.loadUrl(START_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        js("window.DropTime && DropTime.onNativeResume()");
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (testPlayer != null) {
            testPlayer.release();
            testPlayer = null;
        }
        web.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.DropTime && DropTime.onBack()) ? 'yes' : 'no'", value -> {
            if (value == null || !value.contains("yes")) moveTaskToBack(true);
        });
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript(code, null);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_FROM_ALARM, false)) return;
        showOverLockScreen(true);
        js("window.DropTime && DropTime.onNativeAlarm()");
    }

    /** While an alarm is showing, the app may appear over the lock screen. */
    @SuppressWarnings("deprecation")
    void showOverLockScreen(boolean on) {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(on);
            setTurnScreenOn(on);
        } else {
            int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (on) getWindow().addFlags(flags);
            else getWindow().clearFlags(flags);
        }
    }

    // ------------------------------------------------------------ bundled web app

    private WebResourceResponse assetResponse(Uri uri) {
        if (!HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/")) return notFound();
        String asset = path.substring("/assets/".length());
        if (asset.endsWith("/")) asset += "index.html";
        try {
            InputStream in = getAssets().open(asset);
            String mime = mimeType(asset);
            boolean text = mime.startsWith("text/") || mime.contains("json") || mime.contains("manifest");
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(),
                new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".webmanifest")) return "application/manifest+json";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ics")) return "text/calendar";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------ things the web app asks for

    void playTestSound() {
        try {
            if (testPlayer != null) testPlayer.release();
            testPlayer = new MediaPlayer();
            testPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.chime);
            testPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            testPlayer.prepare();
            testPlayer.start();
        } catch (Exception ignored) {
            // No sound available; the Settings screen still shows the volume check.
        }
    }

    void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissionAskedAt = SystemClock.elapsedRealtime();
            requestPermissions(new String[] {NOTIFICATIONS}, REQ_NOTIFICATIONS);
        } else if (!getSystemService(NotificationManager.class).areNotificationsEnabled()) {
            openSettings("notifications");
        } else {
            js("window.DropTime && DropTime.onNativeResume()");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQ_NOTIFICATIONS) return;
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        // Android stops showing the dialog after two refusals; the answer then comes back instantly.
        if (!granted && SystemClock.elapsedRealtime() - permissionAskedAt < 400) openSettings("notifications");
        js("window.DropTime && DropTime.onNativeResume()");
    }

    void openSettings(String which) {
        String pkg = getPackageName();
        Uri pkgUri = Uri.parse("package:" + pkg);
        Intent intent;
        switch (which == null ? "" : which) {
            case "notifications":
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
                break;
            case "exact":
                intent = Build.VERSION.SDK_INT >= 31
                        ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkgUri)
                        : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri);
                break;
            case "fullscreen":
                intent = Build.VERSION.SDK_INT >= 34
                        ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkgUri)
                        : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri);
                break;
            case "battery":
                intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri);
                break;
            case "volume":
                intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
                break;
            default:
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri);
        }
        try {
            startActivity(intent);
        } catch (Exception e) {
            try {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri));
            } catch (Exception ignored) {
                // Nothing more we can open.
            }
        }
    }

    void saveFile(String name, String mime, String content) {
        pendingSave = content;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime)
                .putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(intent, REQ_SAVE);
        } catch (Exception e) {
            pendingSave = null;
            shareText(content);
        }
    }

    void shareText(String text) {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        try {
            startActivity(Intent.createChooser(send, "Share"));
        } catch (Exception ignored) {
            // No app can share text.
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                        ok = true;
                    }
                } catch (Exception ignored) {
                    // Reported to the web app below.
                }
            }
            pendingSave = null;
            if (resultCode == RESULT_OK) js("window.DropTime && DropTime.onNativeSaved(" + ok + ")");
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
