package tw.mumu.yuantaassistant;

import android.graphics.Bitmap;
import android.graphics.Color;

final class YuantaLayoutDetector {
    private static final float[] TIMEFRAME_X = {0.412f, 0.505f, 0.590f, 0.680f, 0.770f};

    private YuantaLayoutDetector() { }

    static MarketSnapshot.ScreenMode detect(String text, Bitmap bitmap) {
        if (text.contains("分時明細") || text.contains("分價明細")) {
            return MarketSnapshot.ScreenMode.TRADES;
        }
        if (text.contains("買進") && text.contains("賣出") && text.contains("庫存")) {
            return MarketSnapshot.ScreenMode.ORDER;
        }
        if (text.contains("委買量") || text.contains("買價") && text.contains("賣價")) {
            return MarketSnapshot.ScreenMode.QUOTE;
        }
        if (text.contains("均價5") || text.contains("布林") || text.contains("MACD")) {
            int selected = selectedTimeframe(bitmap);
            if (selected == 0) return MarketSnapshot.ScreenMode.KLINE_1M;
            if (selected == 1) return MarketSnapshot.ScreenMode.KLINE_5M;
            return MarketSnapshot.ScreenMode.KLINE;
        }
        return MarketSnapshot.ScreenMode.UNKNOWN;
    }

    private static int selectedTimeframe(Bitmap bitmap) {
        int bestIndex = -1;
        int bestScore = 0;
        for (int i = 0; i < TIMEFRAME_X.length; i++) {
            int score = cyanScore(bitmap, TIMEFRAME_X[i] - 0.038f, 0.232f,
                    TIMEFRAME_X[i] + 0.038f, 0.260f);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }
        return bestScore >= 35 ? bestIndex : -1;
    }

    private static int cyanScore(Bitmap bitmap, float left, float top, float right, float bottom) {
        int x0 = Math.max(0, (int) (left * bitmap.getWidth()));
        int y0 = Math.max(0, (int) (top * bitmap.getHeight()));
        int x1 = Math.min(bitmap.getWidth(), (int) (right * bitmap.getWidth()));
        int y1 = Math.min(bitmap.getHeight(), (int) (bottom * bitmap.getHeight()));
        int score = 0;
        for (int y = y0; y < y1; y += 2) {
            for (int x = x0; x < x1; x += 2) {
                int color = bitmap.getPixel(x, y);
                int r = Color.red(color);
                int g = Color.green(color);
                int b = Color.blue(color);
                if (b > 80 && b > r * 1.25f && g > r * 1.15f) score++;
            }
        }
        return score;
    }
}
