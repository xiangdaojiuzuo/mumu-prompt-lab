package tw.mumu.yuantaassistant;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {
    private EditText costInput;
    private EditText costSymbolInput;
    private TextView statusText;
    private SharedPreferences preferences;

    private final ActivityResultLauncher<Intent> captureLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (result.getResultCode() != RESULT_OK || result.getData() == null) {
                    statusText.setText("你取消了螢幕擷取授權，尚未啟動");
                    return;
                }
                saveCost();
                Intent service = new Intent(this, ScreenAnalysisService.class)
                        .setAction(ScreenAnalysisService.ACTION_START)
                        .putExtra(ScreenAnalysisService.EXTRA_RESULT_CODE, result.getResultCode())
                        .putExtra(ScreenAnalysisService.EXTRA_RESULT_DATA, result.getData());
                ContextCompat.startForegroundService(this, service);
                statusText.setText("已啟動，可以切換到元大 App");
            });

    private final ActivityResultLauncher<String> notificationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> { });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        preferences = getSharedPreferences("assistant", MODE_PRIVATE);
        costInput = findViewById(R.id.costInput);
        costSymbolInput = findViewById(R.id.costSymbolInput);
        statusText = findViewById(R.id.statusText);
        Button startButton = findViewById(R.id.startButton);
        Button stopButton = findViewById(R.id.stopButton);

        float savedCost = preferences.getFloat("cost", 0f);
        costSymbolInput.setText(preferences.getString("cost_symbol", ""));
        if (savedCost > 0f) costInput.setText(String.valueOf(savedCost));

        if (Build.VERSION.SDK_INT >= 33) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
        }

        startButton.setOnClickListener(v -> beginSetup());
        stopButton.setOnClickListener(v -> {
            stopService(new Intent(this, ScreenAnalysisService.class));
            statusText.setText("已停止");
        });
    }

    private void beginSetup() {
        if (!Settings.canDrawOverlays(this)) {
            statusText.setText("請允許顯示在其他應用程式上層，返回後再按一次開始");
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivity(settingsIntent);
            return;
        }

        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        captureLauncher.launch(manager.createScreenCaptureIntent());
    }

    private void saveCost() {
        String symbol = costSymbolInput.getText().toString().trim();
        try {
            float cost = Float.parseFloat(costInput.getText().toString().trim());
            if (symbol.length() >= 4) {
                preferences.edit().putString("cost_symbol", symbol).putFloat("cost", cost).apply();
            } else {
                preferences.edit().remove("cost_symbol").remove("cost").apply();
            }
        } catch (NumberFormatException ignored) {
            preferences.edit().remove("cost_symbol").remove("cost").apply();
        }
    }
}
