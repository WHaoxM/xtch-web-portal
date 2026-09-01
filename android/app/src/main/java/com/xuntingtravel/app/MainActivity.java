package com.xuntingtravel.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;

import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final String START_URL = "https://www.xuntingtravel.com/china-trips";
    private static final String OFFICIAL_HOST = "www.xuntingtravel.com";
    private static final String CHINA_TRIPS_PATH = "/china-trips";
    private static final String UPDATE_MANIFEST_URL = "https://www.xuntingtravel.com/downloads/android-release.json";
    private static final int UPDATE_CONNECT_TIMEOUT_MS = 5000;
    private static final int UPDATE_READ_TIMEOUT_MS = 7000;
    private WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean updateCheckInProgress;
    private boolean updateDialogShowing;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(2, 6, 29));
        getWindow().setNavigationBarColor(Color.rgb(2, 6, 29));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(2, 6, 29));
        configureWebView(webView);
        webView.addJavascriptInterface(this, "SyncingTravelAndroid");
        setContentView(webView);

        // The Android app is deliberately a single-surface wrapper. Do not
        // restore an arbitrary prior WebView page after process recreation.
        webView.loadUrl(START_URL);
        checkForUpdates(false);
    }

    private static void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " SyncingTravelAndroid/1.0.2");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setWebChromeClient(new WebChromeClient());
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    return false;
                }
                return handleUrl(v, request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handleUrl(v, Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap favicon) {
                if (!isChinaTripsUrl(Uri.parse(url))) {
                    v.loadUrl(START_URL);
                    return;
                }
                super.onPageStarted(v, url, favicon);
            }

            @Override
            public void onReceivedSslError(WebView v, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(v, request, error);
            }
        });
    }

    private static boolean handleUrl(WebView view, Uri uri) {
        String scheme = uri.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (isChinaTripsUrl(uri)) {
                view.loadUrl(uri.toString());
            } else {
                view.loadUrl(START_URL);
            }
            return true;
        }
        try {
            view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Unsupported external schemes are intentionally ignored.
        }
        return true;
    }

    private static boolean isChinaTripsUrl(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !OFFICIAL_HOST.equalsIgnoreCase(uri.getHost())) {
            return false;
        }
        String path = uri.getPath();
        return CHINA_TRIPS_PATH.equals(path) || (CHINA_TRIPS_PATH + "/").equals(path);
    }

    /** Called by the China Trips "Me" screen when running inside this wrapper. */
    @JavascriptInterface
    public void checkForUpdates() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                checkForUpdates(true);
            }
        });
    }

    private void checkForUpdates(final boolean userInitiated) {
        if (updateCheckInProgress) {
            if (userInitiated) {
                Toast.makeText(this, "Already checking for updates…", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        updateCheckInProgress = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                UpdateRelease release = null;
                try {
                    UpdateRelease candidate = fetchUpdateRelease();
                    if (candidate.versionCode > installedVersionCode()) {
                        release = candidate;
                    }
                } catch (Exception ignored) {
                    // Automatic checks stay silent when offline or temporarily unavailable.
                }

                final UpdateRelease availableRelease = release;
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        updateCheckInProgress = false;
                        if (isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed())) {
                            return;
                        }
                        if (availableRelease != null) {
                            showUpdatePrompt(availableRelease);
                        } else if (userInitiated) {
                            Toast.makeText(MainActivity.this, "You're using the latest version.", Toast.LENGTH_SHORT).show();
                        }
                    }
                });
            }
        }, "syncing-travel-update-check").start();
    }

    private UpdateRelease fetchUpdateRelease() throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(UPDATE_MANIFEST_URL).openConnection();
        try {
            connection.setConnectTimeout(UPDATE_CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(UPDATE_READ_TIMEOUT_MS);
            connection.setRequestMethod("GET");
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            if (connection.getResponseCode() != HttpsURLConnection.HTTP_OK) {
                throw new IllegalStateException("Update manifest request failed.");
            }

            JSONObject manifest = new JSONObject(readUtf8(connection.getInputStream()));
            long versionCode = manifest.getLong("versionCode");
            String versionName = manifest.getString("versionName");
            Uri apkUri = Uri.parse(manifest.getString("apkUrl"));
            if (versionCode < 1 || versionName.trim().isEmpty() || !isOfficialApkUrl(apkUri)) {
                throw new IllegalStateException("Invalid update manifest.");
            }
            return new UpdateRelease(versionCode, versionName, apkUri, manifest.optString("releaseNotes", ""));
        } finally {
            connection.disconnect();
        }
    }

    private static String readUtf8(InputStream input) throws Exception {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toString("UTF-8");
        } finally {
            input.close();
        }
    }

    @SuppressWarnings("deprecation")
    private long installedVersionCode() throws Exception {
        PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? packageInfo.getLongVersionCode()
            : packageInfo.versionCode;
    }

    private static boolean isOfficialApkUrl(Uri uri) {
        String path = uri.getPath();
        return "https".equalsIgnoreCase(uri.getScheme())
            && OFFICIAL_HOST.equalsIgnoreCase(uri.getHost())
            && path != null
            && path.startsWith("/downloads/")
            && path.endsWith(".apk");
    }

    private void showUpdatePrompt(final UpdateRelease release) {
        if (updateDialogShowing) return;
        updateDialogShowing = true;
        String message = "Version " + release.versionName + " is ready to download.";
        if (!release.releaseNotes.isEmpty()) {
            message += "\n\n" + release.releaseNotes;
        }
        new AlertDialog.Builder(this)
            .setTitle("Update available")
            .setMessage(message)
            .setNegativeButton("Later", null)
            .setPositiveButton("Download", (dialog, which) -> openUpdateDownload(release.apkUri))
            .setOnDismissListener(dialog -> updateDialogShowing = false)
            .show();
    }

    private void openUpdateDownload(Uri apkUri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, apkUri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No browser is available to download the update.", Toast.LENGTH_LONG).show();
        }
    }

    private static final class UpdateRelease {
        final long versionCode;
        final String versionName;
        final Uri apkUri;
        final String releaseNotes;

        UpdateRelease(long versionCode, String versionName, Uri apkUri, String releaseNotes) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUri = apkUri;
            this.releaseNotes = releaseNotes;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
