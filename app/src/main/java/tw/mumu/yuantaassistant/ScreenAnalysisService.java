package tw.mumu.yuantaassistant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class ScreenAnalysisService extends Service {
    static final String ACTION_START = "tw.mumu.yuantaassistant.START";
    static final String EXTRA_RESULT_CODE = "result_code";
    static final String EXTRA_RESULT_DATA = "result_data";

    private static final String CHANNEL_ID = "screen_analysis";
    private static final String ALERT_CHANNEL_ID = "trade_signal_v1";
    private static final int NOTIFICATION_ID = 7101;
    private static final int SIGNAL_NOTIFICATION_ID = 7102;
    private static final long ANALYSIS_INTERVAL_MS = 900L;

    private final Handler mainHandler = new Handler(android.os.Looper.getMainLooper());
    private final AtomicBoolean processing = new AtomicBoolean(false);
    private final DecisionEngine decisionEngine = new DecisionEngine();

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread imageThread;
    private TextRecognizer recognizer;
    private long lastAnalyzedAt;

    private WindowManager windowManager;
    private WindowManager.LayoutParams overlayParams;
    private View overlayView;
    private TextView symbolText;
    private TextView signalText;
    private TextView detailText;
    private TextView expandOverlay;
    private TextView disclaimerText;
    private boolean overlayExpanded;
    private TradeDecision.Signal lastAlertSignal = TradeDecision.Signal.UNKNOWN;
    private String lastAlertSymbol = "";

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;

        startInForeground();
        stopCaptureOnly();
        showOverlay();

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData;
        if (Build.VERSION.SDK_INT >= 33) {
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        } else {
            //noinspection deprecation
            resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        }
        if (resultCode == 0 || resultData == null) {
            updateOverlay(null, new TradeDecision(TradeDecision.Signal.UNKNOWN,
                    "⚪ 無法啟動", "缺少螢幕擷取授權"));
            return START_NOT_STICKY;
        }

        startCapture(resultCode, resultData);
        return START_NOT_STICKY;
    }

    private void startInForeground() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentTitle("盤中判斷助手運作中")
                .setContentText("正在讀取可見畫面；不會操作下單")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void startCapture(int resultCode, Intent resultData) {
        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(resultCode, resultData);
        if (projection == null) {
            updateOverlay(null, new TradeDecision(TradeDecision.Signal.UNKNOWN,
                    "⚪ 無法啟動", "系統未提供螢幕畫面"));
            return;
        }

        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                mainHandler.post(() -> {
                    updateOverlay(null, new TradeDecision(TradeDecision.Signal.UNKNOWN,
                            "⚪ 已停止擷取", "重新開啟助手即可繼續"));
                    stopCaptureOnly();
                });
            }
        }, mainHandler);

        DisplayMetrics metrics = new DisplayMetrics();
        //noinspection deprecation
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(metrics);

        imageThread = new HandlerThread("screen-frames");
        imageThread.start();
        Handler imageHandler = new Handler(imageThread.getLooper());

        imageReader = ImageReader.newInstance(
                metrics.widthPixels,
                metrics.heightPixels,
                PixelFormat.RGBA_8888,
                2);
        imageReader.setOnImageAvailableListener(this::onImageAvailable, imageHandler);

        virtualDisplay = projection.createVirtualDisplay(
                "YuantaAssistantCapture",
                metrics.widthPixels,
                metrics.heightPixels,
                metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                imageHandler);
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null) return;

            long now = System.currentTimeMillis();
            if (now - lastAnalyzedAt < ANALYSIS_INTERVAL_MS || !processing.compareAndSet(false, true)) {
                return;
            }
            lastAnalyzedAt = now;

            Bitmap bitmap = imageToBitmap(image);
            if (bitmap == null) {
                processing.set(false);
                return;
            }

            InputImage input = InputImage.fromBitmap(bitmap, 0);
            recognizer.process(input)
                    .addOnSuccessListener(result -> handleRecognizedText(result, bitmap))
                    .addOnFailureListener(error -> updateOverlay(null,
                            new TradeDecision(TradeDecision.Signal.UNKNOWN,
                                    "⚪ 辨識失敗", "請保持畫面清楚後重試")))
                    .addOnCompleteListener(task -> {
                        bitmap.recycle();
                        processing.set(false);
                    });
        } catch (Exception ignored) {
            processing.set(false);
        } finally {
            if (image != null) image.close();
        }
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        if (planes.length == 0) return null;
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        int paddedWidth = image.getWidth() + rowPadding / pixelStride;

        Bitmap padded = Bitmap.createBitmap(paddedWidth, image.getHeight(), Bitmap.Config.ARGB_8888);
        padded.copyPixelsFromBuffer(buffer);
        if (paddedWidth == image.getWidth()) return padded;
        Bitmap cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
        padded.recycle();
        return cropped;
    }

    private void handleRecognizedText(Text result, Bitmap bitmap) {
        List<OcrToken> tokens = new ArrayList<>();
        StringBuilder filteredText = new StringBuilder();
        for (Text.TextBlock block : result.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                boolean wroteElement = false;
                for (Text.Element element : line.getElements()) {
                    Rect box = element.getBoundingBox();
                    if (box == null || isInsideOverlay(box)) continue;
                    tokens.add(new OcrToken(
                            element.getText(),
                            box.exactCenterX() / bitmap.getWidth(),
                            box.exactCenterY() / bitmap.getHeight(),
                            box.height() / (float) bitmap.getHeight()));
                    if (wroteElement) filteredText.append(' ');
                    filteredText.append(element.getText());
                    wroteElement = true;
                }
                if (wroteElement) filteredText.append('\n');
            }
        }
        String cleanText = filteredText.toString();
        MarketSnapshot.ScreenMode mode = YuantaLayoutDetector.detect(cleanText, bitmap);
        MarketSnapshot snapshot = ScreenTextParser.parse(cleanText, tokens, mode);
        String costSymbol = getSharedPreferences("assistant", MODE_PRIVATE)
                .getString("cost_symbol", "");
        double cost = snapshot.symbol != null && snapshot.symbol.equals(costSymbol)
                ? getSharedPreferences("assistant", MODE_PRIVATE).getFloat("cost", 0f)
                : 0d;
        TradeDecision decision = decisionEngine.update(snapshot, cost);
        updateOverlay(snapshot, decision);
    }

    private void showOverlay() {
        if (!android.provider.Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }
        if (overlayView != null) return;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_panel, null);
        symbolText = overlayView.findViewById(R.id.symbolText);
        signalText = overlayView.findViewById(R.id.signalText);
        detailText = overlayView.findViewById(R.id.detailText);
        expandOverlay = overlayView.findViewById(R.id.expandOverlay);
        disclaimerText = overlayView.findViewById(R.id.disclaimerText);

        overlayParams = new WindowManager.LayoutParams(
                dp(224),
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= 26
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        overlayParams.gravity = Gravity.TOP | Gravity.START;
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        overlayParams.x = Math.max(0, metrics.widthPixels - dp(236));
        overlayParams.y = dp(390);
        windowManager.addView(overlayView, overlayParams);

        overlayView.findViewById(R.id.closeOverlay).setOnClickListener(v -> stopSelf());
        expandOverlay.setOnClickListener(v -> toggleOverlayExpansion());
        signalText.setOnClickListener(v -> toggleOverlayExpansion());
        detailText.setOnClickListener(v -> toggleOverlayExpansion());
        setupDrag(overlayView.findViewById(R.id.dragHandle));
        applyOverlayExpansion();
    }

    private void toggleOverlayExpansion() {
        overlayExpanded = !overlayExpanded;
        applyOverlayExpansion();
    }

    private void applyOverlayExpansion() {
        if (detailText == null || expandOverlay == null || disclaimerText == null) return;
        detailText.setMaxLines(overlayExpanded ? Integer.MAX_VALUE : 2);
        expandOverlay.setText(overlayExpanded ? "⌃" : "⌄");
        disclaimerText.setVisibility(overlayExpanded ? View.VISIBLE : View.GONE);
        if (windowManager != null && overlayView != null && overlayParams != null) {
            windowManager.updateViewLayout(overlayView, overlayParams);
        }
    }

    private boolean isInsideOverlay(Rect box) {
        if (overlayView == null || overlayParams == null) return false;
        int width = overlayView.getWidth();
        int height = overlayView.getHeight();
        if (width <= 0 || height <= 0) return false;
        float centerX = box.exactCenterX();
        float centerY = box.exactCenterY();
        return centerX >= overlayParams.x
                && centerX <= overlayParams.x + width
                && centerY >= overlayParams.y
                && centerY <= overlayParams.y + height;
    }

    private void setupDrag(View handle) {
        handle.setOnTouchListener(new View.OnTouchListener() {
            private int startX;
            private int startY;
            private float downX;
            private float downY;

            @Override
            public boolean onTouch(View view, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    startX = overlayParams.x;
                    startY = overlayParams.y;
                    downX = event.getRawX();
                    downY = event.getRawY();
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    overlayParams.x = Math.max(0, startX + (int) (event.getRawX() - downX));
                    overlayParams.y = Math.max(0, startY + (int) (event.getRawY() - downY));
                    windowManager.updateViewLayout(overlayView, overlayParams);
                    return true;
                }
                return event.getAction() == MotionEvent.ACTION_UP;
            }
        });
    }

    private void updateOverlay(MarketSnapshot snapshot, TradeDecision decision) {
        mainHandler.post(() -> {
            if (overlayView == null) return;
            symbolText.setText(snapshot != null && snapshot.symbol != null
                    ? snapshot.symbol + "｜盤中"
                    : "等待畫面");
            signalText.setText(decision.headline);
            detailText.setText(decision.detail);
            signalText.setTextColor(signalColor(decision.signal));
            maybeShowSignalNotification(snapshot, decision);
        });
    }

    private void maybeShowSignalNotification(MarketSnapshot snapshot, TradeDecision decision) {
        if (snapshot == null || snapshot.symbol == null) return;
        boolean pagesComplete = decision.detail.contains("資訊✓ 日K✓ 1分✓ 5分✓");
        boolean hasTriggerLine = decision.detail.contains("｜多") && decision.detail.contains(" 空");
        boolean actionable = pagesComplete && hasTriggerLine
                && (decision.signal == TradeDecision.Signal.BUY
                || decision.signal == TradeDecision.Signal.SELL);

        if (!actionable) {
            if (pagesComplete && decision.signal == TradeDecision.Signal.WAIT) {
                lastAlertSignal = TradeDecision.Signal.WAIT;
            }
            return;
        }
        if (snapshot.symbol.equals(lastAlertSymbol) && decision.signal == lastAlertSignal) return;

        lastAlertSymbol = snapshot.symbol;
        lastAlertSignal = decision.signal;
        Notification alert = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(snapshot.symbol + "｜" + decision.headline)
                .setContentText(decision.detail.replace('\n', '｜'))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(decision.detail))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)
                .build();
        getSystemService(NotificationManager.class).notify(SIGNAL_NOTIFICATION_ID, alert);
    }

    private int signalColor(TradeDecision.Signal signal) {
        switch (signal) {
            case BUY:
            case HOLD:
                return Color.rgb(0, 230, 118);
            case REDUCE:
                return Color.rgb(255, 145, 0);
            case SELL:
                return Color.rgb(255, 82, 82);
            case WAIT:
                return Color.rgb(255, 214, 0);
            default:
                return Color.rgb(207, 216, 220);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void stopCaptureOnly() {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (projection != null) {
            projection.stop();
            projection = null;
        }
        if (imageThread != null) {
            imageThread.quitSafely();
            imageThread = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "盤中畫面判斷",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("螢幕擷取運作狀態");
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "偏多偏空到價提醒",
                    NotificationManager.IMPORTANCE_HIGH);
            alertChannel.setDescription("四頁資料完整後的偏多／偏空突破通知");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
            manager.createNotificationChannel(alertChannel);
        }
    }

    @Override
    public void onDestroy() {
        stopCaptureOnly();
        if (overlayView != null && windowManager != null) {
            windowManager.removeView(overlayView);
            overlayView = null;
        }
        if (recognizer != null) recognizer.close();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
}
