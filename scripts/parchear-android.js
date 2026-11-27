// Aplica el parche nativo de WebAuthn al proyecto Android generado por Capacitor.
// Se ejecuta en el workflow de GitHub Actions después de `cap add android`.
// El proyecto android/ es descartable: siempre se regenera desde cero.

const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const raizJava = path.join(raiz, 'android', 'app', 'src', 'main', 'java');
const raizMain = path.join(raiz, 'android', 'app', 'src', 'main');
const archivoGradle = path.join(raiz, 'android', 'app', 'build.gradle');
const archivoManifest = path.join(raizMain, 'AndroidManifest.xml');
const archivoStrings = path.join(raizMain, 'res', 'values', 'strings.xml');

const configuracion = JSON.parse(
  fs.readFileSync(path.join(raiz, 'capacitor.config.json'), 'utf8')
);
const origenServidor = String((configuracion.server && configuracion.server.url) || '')
  .replace(/\/$/, '');

function buscarMainActivity(directorio) {
  if (!fs.existsSync(directorio)) return null;
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      const encontrado = buscarMainActivity(ruta);
      if (encontrado) return encontrado;
    } else if (entrada.name === 'MainActivity.java') {
      return ruta;
    }
  }
  return null;
}

const archivoActivity = buscarMainActivity(raizJava);
if (!archivoActivity) {
  console.error('No se encontró MainActivity.java. Ejecutá primero: cap add android');
  process.exit(1);
}

const actividadActual = fs.readFileSync(archivoActivity, 'utf8');
const paquete = (actividadActual.match(/package\s+([\w.]+)\s*;/) || [])[1] || 'com.cuentas.app';

const actividadNueva = `package ${paquete};

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "CuentasWebAuthn";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setJavaScriptEnabled(true);

        // WebView deshabilita WebAuthn por defecto. El modo APP permite usar los
        // passkeys asociados al dominio mediante /.well-known/assetlinks.json.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                    webView.getSettings(),
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
            int soporte = WebSettingsCompat.getWebAuthenticationSupport(webView.getSettings());
            Log.i(TAG, "WebAuthn habilitado: " + soporte);
            if (soporte == WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP) {
                // Capacitor ya empezó a cargar la URL dentro de super.onCreate():
                // recargamos para que la página se inicialice con PublicKeyCredential.
                webView.post(() -> webView.reload());
            }
        } else {
            Log.w(TAG, "WebView sin soporte de WebAuthn (requiere WebView 131+)");
        }
    }
}
`;

if (actividadActual !== actividadNueva) {
  fs.writeFileSync(archivoActivity, actividadNueva, 'utf8');
  console.log('MainActivity.java: WebAuthn habilitado');
}

let gradle = fs.readFileSync(archivoGradle, 'utf8');
const dependencias = `implementation project(':capacitor-cordova-android-plugins')
    implementation "androidx.webkit:webkit:\$androidxWebkitVersion"
    implementation "androidx.credentials:credentials:1.6.0-beta02"
    implementation "androidx.credentials:credentials-play-services-auth:1.6.0-beta02"`;

if (!gradle.includes('androidx.credentials:credentials:')) {
  if (!gradle.includes("implementation project(':capacitor-cordova-android-plugins')")) {
    console.error('No se encontró el bloque de dependencias en build.gradle');
    process.exit(1);
  }
  gradle = gradle.replace(
    "implementation project(':capacitor-cordova-android-plugins')",
    dependencias
  );
  fs.writeFileSync(archivoGradle, gradle, 'utf8');
  console.log('build.gradle: dependencias de Credential Manager y WebKit agregadas');
}

// La asociación debe declararse también desde la app hacia el sitio. Sin este
// bloque, Credential Manager no valida el RP ID aunque el servidor ya publique
// /.well-known/assetlinks.json correctamente.
if (!origenServidor) {
  console.error('capacitor.config.json no define server.url; no se puede declarar asset_statements');
  process.exit(1);
}

const assetStatements = `[{\\"include\\": \\"${origenServidor}/.well-known/assetlinks.json\\"}]`;

let strings = fs.readFileSync(archivoStrings, 'utf8');
if (!strings.includes('name="asset_statements"')) {
  const linea = `    <string name="asset_statements" translatable="false">${assetStatements}</string>\n`;
  strings = strings.replace('</resources>', `${linea}</resources>`);
  fs.writeFileSync(archivoStrings, strings, 'utf8');
  console.log('strings.xml: asset_statements agregado');
}

let manifest = fs.readFileSync(archivoManifest, 'utf8');
if (!manifest.includes('android:name="asset_statements"')) {
  const meta = `        <meta-data\n            android:name="asset_statements"\n            android:resource="@string/asset_statements" />\n`;
  const inicio = manifest.indexOf('<application');
  const finEtiqueta = inicio === -1 ? -1 : manifest.indexOf('>', inicio);
  if (finEtiqueta === -1) {
    console.error('No se encontró la etiqueta <application> en AndroidManifest.xml');
    process.exit(1);
  }
  manifest = manifest.slice(0, finEtiqueta + 1) + '\n' + meta + manifest.slice(finEtiqueta + 1);
  fs.writeFileSync(archivoManifest, manifest, 'utf8');
  console.log('AndroidManifest.xml: asset_statements agregado');
}
