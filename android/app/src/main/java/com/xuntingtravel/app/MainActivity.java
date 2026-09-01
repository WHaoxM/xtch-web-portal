package com.xuntingtravel.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String START_URL = "https://www.xuntingtravel.com/china-trips";
    private static final String OFFICIAL_HOST = "www.xuntingtravel.com";
    private static final String CHINA_TRIPS_PATH = "/china-trips";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(2, 6, 29));
        getWindow().setNavigationBarColor(Color.rgb(2, 6, 29));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(2, 6, 29));
        configureWebView(webView);
        setContentView(webView);

        // The Android app is deliberately a single-surface wrapper. Do not
        // restore an arbitrary prior WebView page after process recreation.
        webView.loadUrl(START_URL);
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
        settings.setUserAgentString(settings.getUserAgentString() + " SyncingTravelAndroid/1.0.1");

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
