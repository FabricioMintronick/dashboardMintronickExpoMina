package com.mintronick.operaciones;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String DASHBOARD_URL = "https://dashboard-demo.mintronick.com/";
    private WebView dashboard;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        dashboard = new WebView(this);
        setContentView(dashboard);
        dashboard.getSettings().setJavaScriptEnabled(true);
        dashboard.getSettings().setDomStorageEnabled(true);
        dashboard.getSettings().setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(dashboard, false);
        dashboard.setWebChromeClient(new WebChromeClient());
        dashboard.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if ("dashboard-demo.mintronick.com".equalsIgnoreCase(host)) return false;
                return true;
            }
        });
        if (state == null) dashboard.loadUrl(DASHBOARD_URL);
        else dashboard.restoreState(state);
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        dashboard.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onBackPressed() {
        if (dashboard.canGoBack()) dashboard.goBack();
        else super.onBackPressed();
    }
}
