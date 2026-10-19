package app.mijornada.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "LocalFiles")
public class LocalFilesPlugin extends Plugin {
    private final AtomicBoolean pending = new AtomicBoolean(false);
    private volatile String pendingContents;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name");
        String contents = call.getString("contents");
        String mime = call.getString("mime");
        if (name == null || name.trim().isEmpty() || name.contains("/") || name.contains("\\") || contents == null ||
            !("application/json".equals(mime) || "text/csv".equals(mime))) {
            call.reject("No se pudo preparar el archivo.");
            return;
        }
        if (!pending.compareAndSet(false, true)) {
            call.reject("Termina de guardar el archivo anterior.");
            return;
        }
        pendingContents = contents;
        // No incluir el respaldo completo en el estado de la actividad del selector.
        call.getData().remove("contents");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        getActivity().runOnUiThread(() -> {
            try {
                startActivityForResult(call, intent, "fileCreated");
            } catch (Exception error) {
                pendingContents = null;
                pending.set(false);
                call.reject("No se pudo abrir el selector de archivos.", error);
            }
        });
    }

    @ActivityCallback
    private void fileCreated(PluginCall call, ActivityResult result) {
        if (call == null) {
            pendingContents = null;
            pending.set(false);
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            pendingContents = null;
            pending.set(false);
            JSObject response = new JSObject();
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        String contents = pendingContents;
        if (uri == null || contents == null) {
            pendingContents = null;
            pending.set(false);
            call.reject("No se recibió una ubicación válida para el archivo.");
            return;
        }
        // Escribir fuera del hilo de interfaz y confirmar solo tras cerrar el archivo.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IOException("No hay flujo de escritura.");
                stream.write(contents.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            } catch (Exception error) {
                pendingContents = null;
                pending.set(false);
                call.reject("No se pudo guardar el archivo. Revisa la carpeta y el espacio disponible.", error);
                return;
            }
            pendingContents = null;
            pending.set(false);
            JSObject response = new JSObject();
            response.put("saved", true);
            call.resolve(response);
        });
    }
}
