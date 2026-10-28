package com.henry.nightcitynav;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.util.Locale;

/**
 * "Casca" nativa do NightCity Nav.
 *  - Mostra a interface (HTML/JS em app/src/main/assets) dentro de um WebView
 *  - Lê o GPS de verdade do celular e entrega pro JavaScript (onNativeLocation)
 *  - Dá voz em português (TextToSpeech) e vibração para os alertas
 *  - Mantém a tela acesa enquanto o app está aberto
 */
public class MainActivity extends Activity implements LocationListener {

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private LocationManager lm;
    private long lastGpsFix = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);

        // Serve os arquivos locais num endereço https "falso" → o WebView trata como site seguro
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // localStorage: guarda seus reportes e o cache de radares
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setOnLongClickListener(v -> true);       // evita o menu de "selecionar texto" no toque longo
        web.setHapticFeedbackEnabled(false);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(new Locale("pt", "BR"));
                ttsReady = true;
            }
        });

        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, 1);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            startGps();
        } else {
            web.evaluateJavascript("window.onGpsDenied && window.onGpsDenied()", null);
        }
    }

    private void startGps() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        try {
            // GPS a cada 1 s (precisão de navegação) + rede para o primeiro "fix" rápido
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this);
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000, 0, this);
            }
            Location last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last != null) push(last);
        } catch (SecurityException | IllegalArgumentException ignored) { }
    }

    @Override
    public void onLocationChanged(Location l) {
        boolean isGps = LocationManager.GPS_PROVIDER.equals(l.getProvider());
        if (isGps) lastGpsFix = System.currentTimeMillis();
        // Se o GPS respondeu há pouco, ignora a posição (menos precisa) da rede
        else if (System.currentTimeMillis() - lastGpsFix < 5000) return;
        push(l);
    }

    private void push(Location l) {
        final String js = String.format(Locale.US,
                "window.onNativeLocation && window.onNativeLocation(%.7f,%.7f,%s,%s,%.1f)",
                l.getLatitude(), l.getLongitude(),
                l.hasSpeed() ? String.format(Locale.US, "%.2f", l.getSpeed()) : "null",
                l.hasBearing() ? String.format(Locale.US, "%.1f", l.getBearing()) : "null",
                l.getAccuracy());
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    // Métodos antigos da interface — precisam existir para não travar em Androids antigos
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }

    @Override
    protected void onResume() {
        super.onResume();
        startGps();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Economiza bateria quando o app sai da tela. (Navegação em 2º plano = versão futura.)
        try { lm.removeUpdates(this); } catch (Exception ignored) { }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    /** Funções que o JavaScript pode chamar: Android.speak("..."), Android.vibrate(300) */
    private class Bridge {
        @JavascriptInterface
        public void speak(String text) {
            if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "nc");
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(ms);
        }
    }
}
