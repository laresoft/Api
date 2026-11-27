// Aplica el parche nativo de WebAuthn al proyecto Android generado por Capacitor.
// Se ejecuta en el workflow de GitHub Actions después de `cap add android`.
// El proyecto android/ es descartable: siempre se regenera desde cero.

const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const raizJava = path.join(raiz, 'android', 'app', 'src', 'main', 'java');
const archivoGradle = path.join(raiz, 'android', 'app', 'build.gradle');

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
import android.webkit.WebView;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // WebView deshabilita WebAuthn por defecto. El modo APP permite usar los
        // passkeys asociados al dominio mediante /.well-known/assetlinks.json.
        WebView webView = getBridge().getWebView();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                    webView.getSettings(),
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
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
