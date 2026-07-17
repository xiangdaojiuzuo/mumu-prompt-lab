package tw.mumu.yuantaassistant;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;

final class DecisionEngine {
    private final Deque<MarketSnapshot> history = new ArrayDeque<>();
    private String currentSymbol;
    private MarketSnapshot lastOneMinute;
    private MarketSnapshot lastFiveMinute;

    TradeDecision update(MarketSnapshot now, double cost) {
        if (now.symbol == null || now.price == null || now.confidence < 5) {
            return unknown("請停在個股報價或 K 線頁面，等待辨識價格");
        }

        if (!now.symbol.equals(currentSymbol)) {
            history.clear();
            currentSymbol = now.symbol;
            lastOneMinute = null;
            lastFiveMinute = null;
        }

        MarketSnapshot previous = history.peekLast();
        if (previous != null) {
            double jump = Math.abs(now.price / previous.price - 1d) * 100d;
            if (jump > 15d) {
                return unknown("價格辨識跳動 " + fmt(jump) + "%｜本次資料已略過");
            }
        }
        if (now.high != null && now.low != null
                && (now.price > now.high * 1.02d || now.price < now.low * 0.98d)) {
            return unknown("現價與今日高低不一致｜本次資料已略過");
        }

        history.addLast(now);
        while (history.size() > 60) history.removeFirst();
        while (!history.isEmpty() && now.capturedAt - history.peekFirst().capturedAt > 60_000) {
            history.removeFirst();
        }

        if (now.screenMode == MarketSnapshot.ScreenMode.KLINE_1M) lastOneMinute = now;
        if (now.screenMode == MarketSnapshot.ScreenMode.KLINE_5M) lastFiveMinute = now;

        if (cost > 0) {
            double pnl = (now.price / cost - 1d) * 100d;
            if (pnl <= -1.5d) {
                return decision(TradeDecision.Signal.SELL, "🔴 停損警示",
                        now, "已低於成本 " + fmt(Math.abs(pnl)) + "%｜請確認是否依紀律出場");
            }
        }

        if (history.size() < 8) {
            return decision(TradeDecision.Signal.WAIT, "🟡 蒐集盤中資料",
                    now, "至少再等待約 8 秒，避免只看單一畫面誤判");
        }

        MarketSnapshot first = history.peekFirst();
        double momentum = (now.price / first.price - 1d) * 100d;
        Double rangePosition = null;
        if (now.hasRange()) rangePosition = (now.price - now.low) / (now.high - now.low);

        TradeDecision combinedKline = combinedKlineDecision(now, momentum);
        if (combinedKline != null) return combinedKline;

        if (cost > 0) {
            double pnl = (now.price / cost - 1d) * 100d;
            if (pnl >= 2d && momentum < -0.12d) {
                return decision(TradeDecision.Signal.REDUCE, "🟠 移動停利／減碼",
                        now, "獲利 " + fmt(pnl) + "% 且短線轉弱");
            }
            if (pnl > 0.3d && momentum >= -0.05d) {
                return decision(TradeDecision.Signal.HOLD, "🟢 續抱觀察",
                        now, "目前仍在成本之上，尚未出現明顯轉弱");
            }
        }

        boolean aboveOpen = now.open != null && now.price > now.open;
        boolean belowOpen = now.open != null && now.price < now.open;

        if (momentum >= 0.20d && aboveOpen && rangePosition != null
                && rangePosition >= 0.55d && rangePosition <= 0.92d) {
            return decision(TradeDecision.Signal.BUY, "🟢 偏多進場候選",
                        now, "擷取區間動能 +" + fmt(momentum) + "%｜等回測不破再由本人確認");
        }

        if (momentum <= -0.20d && belowOpen) {
            return decision(TradeDecision.Signal.SELL, "🔴 偏空／避免進場",
                    now, "擷取區間動能 " + fmt(momentum) + "%｜已有持倉請留意停損");
        }

        if (rangePosition != null && rangePosition > 0.96d && momentum < 0.12d) {
            return decision(TradeDecision.Signal.WAIT, "🟡 接近當日高點",
                    now, "動能不足，避免直接追價");
        }

        return decision(TradeDecision.Signal.WAIT, "🟡 暫時觀望",
                now, "目前沒有同時滿足價格、動能與位置條件");
    }

    private TradeDecision unknown(String detail) {
        return new TradeDecision(TradeDecision.Signal.UNKNOWN, "⚪ 資訊不足", detail);
    }

    private TradeDecision combinedKlineDecision(MarketSnapshot now, double momentum) {
        if (now.screenMode != MarketSnapshot.ScreenMode.KLINE_1M
                && now.screenMode != MarketSnapshot.ScreenMode.KLINE_5M
                && now.screenMode != MarketSnapshot.ScreenMode.KLINE) {
            return null;
        }

        boolean currentBull = isKlineBullish(now);
        boolean currentBear = isKlineBearish(now);
        if (lastOneMinute == null || lastFiveMinute == null) {
            if (currentBull) {
                return decision(TradeDecision.Signal.WAIT, "🟡 單一週期偏多",
                        now, "請再切換 1分K／5分K，完成雙週期確認");
            }
            if (currentBear) {
                return decision(TradeDecision.Signal.WAIT, "🟠 單一週期偏弱",
                        now, "請再切換 1分K／5分K，完成雙週期確認");
            }
            return decision(TradeDecision.Signal.WAIT, "🟡 K線方向不明",
                    now, "均線與 KD 尚未形成一致方向");
        }

        boolean oneBull = isKlineBullish(lastOneMinute);
        boolean fiveBull = isKlineBullish(lastFiveMinute);
        boolean oneBear = isKlineBearish(lastOneMinute);
        boolean fiveBear = isKlineBearish(lastFiveMinute);

        if (oneBull && fiveBull && momentum >= -0.05d) {
            return decision(TradeDecision.Signal.BUY, "🟢 1分＋5分同步偏多",
                    now, "兩個週期均站上短均線且 KD 偏多｜仍需本人確認進場");
        }
        if (oneBear && fiveBear) {
            return decision(TradeDecision.Signal.SELL, "🔴 1分＋5分同步偏弱",
                    now, "兩個週期均跌破短均線且 KD 偏空｜避免搶反彈");
        }
        return decision(TradeDecision.Signal.WAIT, "🟡 1分／5分不同步",
                now, "短週期與較大週期方向相反，先不下手");
    }

    private boolean isKlineBullish(MarketSnapshot snapshot) {
        return snapshot.price != null
                && snapshot.ma5 != null
                && snapshot.ma10 != null
                && snapshot.kdK != null
                && snapshot.kdD != null
                && snapshot.price >= snapshot.ma5
                && snapshot.ma5 >= snapshot.ma10 * 0.998d
                && snapshot.kdK > snapshot.kdD
                && snapshot.kdK < 85d;
    }

    private boolean isKlineBearish(MarketSnapshot snapshot) {
        return snapshot.price != null
                && snapshot.ma5 != null
                && snapshot.ma10 != null
                && snapshot.kdK != null
                && snapshot.kdD != null
                && snapshot.price < snapshot.ma5
                && snapshot.ma5 <= snapshot.ma10 * 1.002d
                && snapshot.kdK < snapshot.kdD;
    }

    private TradeDecision decision(TradeDecision.Signal signal, String headline,
                                   MarketSnapshot now, String reason) {
        StringBuilder detail = new StringBuilder(now.screenMode.label)
                .append("｜現價：").append(fmt(now.price));
        if (now.changePercent != null) detail.append("｜漲跌：").append(fmt(now.changePercent)).append('%');
        if (now.high != null && now.low != null) {
            detail.append("\n今日高低：").append(fmt(now.high)).append("／").append(fmt(now.low));
        }
        if (now.bestBid != null && now.bestAsk != null) {
            detail.append("\n一檔買賣：").append(fmt(now.bestBid)).append("／").append(fmt(now.bestAsk));
        }
        detail.append("\n理由：").append(reason);
        return new TradeDecision(signal, headline, detail.toString());
    }

    private String fmt(double value) {
        return String.format(Locale.TAIWAN, "%.2f", value);
    }
}
