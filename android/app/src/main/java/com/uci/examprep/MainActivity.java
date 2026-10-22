package com.uci.examprep;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
	static final String HOME = "https://uci.divyanshshukla.com/app";
	private static final int FILE_CHOOSER = 1001;

	private WebView webView;
	private View splash;
	private ProgressBar bar;
	private ValueCallback<Uri[]> fileCallback;

	@SuppressLint("SetJavaScriptEnabled")
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_main);

		webView = findViewById(R.id.web);
		bar = findViewById(R.id.progress);
		splash = findViewById(R.id.splash);
		webView.setBackgroundColor(0xfff4f6f8);

		WebSettings settings = webView.getSettings();
		settings.setJavaScriptEnabled(true);
		settings.setDomStorageEnabled(true);
		settings.setDatabaseEnabled(true);
		settings.setLoadWithOverviewMode(true);
		settings.setUseWideViewPort(true);
		settings.setSupportZoom(false);
		settings.setBuiltInZoomControls(false);
		settings.setDisplayZoomControls(false);
		settings.setMediaPlaybackRequiresUserGesture(false);
		settings.setJavaScriptCanOpenWindowsAutomatically(false);
		settings.setSupportMultipleWindows(false);
		settings.setCacheMode(WebSettings.LOAD_DEFAULT);
		settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
		settings.setUserAgentString(settings.getUserAgentString().replace("; wv", ""));

		CookieManager cookies = CookieManager.getInstance();
		cookies.setAcceptCookie(true);
		cookies.setAcceptThirdPartyCookies(webView, true);

		webView.setWebViewClient(new WebViewClient() {
			@Override
			public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
				return handleUri(request.getUrl());
			}

			@Override
			@SuppressWarnings("deprecation")
			public boolean shouldOverrideUrlLoading(WebView view, String url) {
				return handleUri(Uri.parse(url));
			}

			@Override
			public void onPageFinished(WebView view, String url) {
				hideSplash();
			}

			@Override
			public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
				if (request.isForMainFrame()) {
					hideSplash();
					view.loadDataWithBaseURL(HOME, errorHtml(), "text/html", "utf-8", null);
				}
			}
		});

		webView.setWebChromeClient(new WebChromeClient() {
			@Override
			public void onProgressChanged(WebView view, int newProgress) {
				bar.setProgress(newProgress);
				bar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
				if (newProgress >= 80) hideSplash();
			}

			@Override
			public boolean onShowFileChooser(
				WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
				if (fileCallback != null) fileCallback.onReceiveValue(null);
				fileCallback = callback;
				try {
					startActivityForResult(params.createIntent(), FILE_CHOOSER);
					return true;
				} catch (ActivityNotFoundException e) {
					fileCallback = null;
					return false;
				}
			}
		});

		webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
			try {
				startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
			} catch (ActivityNotFoundException ignored) {
			}
		});

		if (savedInstanceState != null) {
			webView.restoreState(savedInstanceState);
			hideSplash();
		} else {
			Uri launch = getIntent() != null ? getIntent().getData() : null;
			webView.loadUrl(launch != null ? launch.toString() : HOME);
		}
	}

	private void hideSplash() {
		if (splash != null && splash.getVisibility() == View.VISIBLE) {
			splash.animate().alpha(0f).setDuration(180).withEndAction(() -> splash.setVisibility(View.GONE));
		}
	}

	private boolean handleUri(Uri uri) {
		if (uri == null) return true;
		String scheme = uri.getScheme() == null ? "" : uri.getScheme();
		String host = uri.getHost() == null ? "" : uri.getHost();
		if ("https".equals(scheme) || "http".equals(scheme)) {
			if (host.endsWith("uci.divyanshshukla.com")
				|| host.endsWith("accounts.google.com")
				|| host.endsWith("accounts.youtube.com")
				|| host.endsWith("google.com")
				|| host.endsWith("gstatic.com")
				|| host.endsWith("googleapis.com")
				|| host.endsWith("razorpay.com")
				|| host.endsWith("youtube.com")
				|| host.endsWith("youtube-nocookie.com")
				|| host.endsWith("ytimg.com")) {
				return false;
			}
		}
		try {
			startActivity(new Intent(Intent.ACTION_VIEW, uri));
		} catch (ActivityNotFoundException ignored) {
		}
		return true;
	}

	private String errorHtml() {
		return "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
			+ "<style>body{font-family:sans-serif;background:#f4f6f8;color:#0f1218;display:flex;"
			+ "min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}"
			+ "a{color:#0f1218;font-weight:700}</style></head><body>"
			+ "<div><p>UCI could not reach the server.</p>"
			+ "<p><a href='" + HOME + "'>Try again</a></p></div></body></html>";
	}

	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		super.onActivityResult(requestCode, resultCode, data);
		if (requestCode != FILE_CHOOSER || fileCallback == null) return;
		Uri[] result = resultCode == RESULT_OK && data != null
			? WebChromeClient.FileChooserParams.parseResult(resultCode, data)
			: null;
		fileCallback.onReceiveValue(result);
		fileCallback = null;
	}

	@Override
	protected void onSaveInstanceState(Bundle outState) {
		super.onSaveInstanceState(outState);
		if (webView != null) webView.saveState(outState);
	}

	@Override
	public void onBackPressed() {
		if (webView != null && webView.canGoBack()) {
			webView.goBack();
			return;
		}
		super.onBackPressed();
	}

	@Override
	protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
		if (webView != null && intent.getData() != null) {
			webView.loadUrl(intent.getData().toString());
		}
	}

	@Override
	protected void onPause() {
		if (webView != null) webView.onPause();
		CookieManager.getInstance().flush();
		super.onPause();
	}

	@Override
	protected void onResume() {
		super.onResume();
		if (webView != null) webView.onResume();
	}

	@Override
	protected void onDestroy() {
		if (webView != null) {
			((ViewGroup) webView.getParent()).removeView(webView);
			webView.destroy();
			webView = null;
		}
		super.onDestroy();
	}
}
