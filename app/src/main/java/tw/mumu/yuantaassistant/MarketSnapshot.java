package tw.mumu.yuantaassistant;

final class MarketSnapshot {
    enum ScreenMode {
        QUOTE("分時／五檔"),
        KLINE_1M("1分K"),
        KLINE_5M("5分K"),
        KLINE("K線"),
        TRADES("逐筆成交"),
        ORDER("下單頁"),
        UNKNOWN("未辨識頁面");

        final String label;

        ScreenMode(String label) {
            this.label = label;
        }
    }

    final String symbol;
    final Double price;
    final Double open;
    final Double high;
    final Double low;
    final Double changePercent;
    final Double ma5;
    final Double ma10;
    final Double ma20;
    final Double macd;
    final Double kdK;
    final Double kdD;
    final Double bestBid;
    final Double bestAsk;
    final ScreenMode screenMode;
    final int confidence;
    final long capturedAt;

    MarketSnapshot(String symbol, Double price, Double open, Double high,
                   Double low, Double changePercent, int confidence) {
        this(symbol, price, open, high, low, changePercent, null, null, null,
                null, null, null, null, null, ScreenMode.UNKNOWN, confidence);
    }

    MarketSnapshot(String symbol, Double price, Double open, Double high,
                   Double low, Double changePercent, Double ma5, Double ma10,
                   Double ma20, Double macd, Double kdK, Double kdD,
                   Double bestBid, Double bestAsk, ScreenMode screenMode,
                   int confidence) {
        this.symbol = symbol;
        this.price = price;
        this.open = open;
        this.high = high;
        this.low = low;
        this.changePercent = changePercent;
        this.ma5 = ma5;
        this.ma10 = ma10;
        this.ma20 = ma20;
        this.macd = macd;
        this.kdK = kdK;
        this.kdD = kdD;
        this.bestBid = bestBid;
        this.bestAsk = bestAsk;
        this.screenMode = screenMode;
        this.confidence = confidence;
        this.capturedAt = System.currentTimeMillis();
    }

    boolean hasRange() {
        return price != null && high != null && low != null && high > low;
    }
}
