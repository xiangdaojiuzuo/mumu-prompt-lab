package tw.mumu.yuantaassistant;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;

final class DecisionEngine {
    private static final long CACHE_WINDOW_MS = 8_000L;

    private final Deque<MarketSnapshot> history = new ArrayDeque<>();
    private String currentSymbol;
    private MarketSnapshot lastQuote;
    private MarketSnapshot lastDay;
    private MarketSnapshot lastOneMinute;
    private MarketSnapshot lastFiveMinute;
    private long lastGoodAt;
    private TradeDecision lastDecision;
    private int consecutiveMisses;

    TradeDecision update(MarketSnapshot now, double cost) {
        if (!isUsable(now)) return cachedOrUnknown(now, "本次 OCR 沒有完整讀到代號或現價");

        if (!now.symbol.equals(currentSymbol)) {
            resetForSymbol(now.symbol);
        }

        MarketSnapshot previous = history.peekLast();
        if (previous != null) {
            double jump = Math.abs(now.price / previous.price - 1d) * 100d;
            if (jump > 15d) {
                return cachedOrUnknown(now, "價格跳動 " + fmt(jump) + "% 已自動略過");
            }
        }
        if (now.high != null && now.low != null
                && (now.price > now.high * 1.02d || now.price < now.low * 0.98d)) {
            return cachedOrUnknown(now, "現價與今日高低矛盾，本次讀值已略過");
        }

        consecutiveMisses = 0;
        lastGoodAt = now.capturedAt;
        TradeDecision decision = evaluate(now, cost);
        lastDecision = decision;
        return decision;
    }

    private TradeDecision evaluate(MarketSnapshot now, double cost) {
        history.addLast(now);
        while (history.size() > 60) history.removeFirst();
        while (!history.isEmpty() && now.capturedAt - history.peekFirst().capturedAt > 60_000L) {
            history.removeFirst();
        }

        if (now.screenMode == MarketSnapshot.ScreenMode.QUOTE) lastQuote = now;
        if (now.screenMode == MarketSnapshot.ScreenMode.KLINE_DAY) lastDay = now;
        if (now.screenMode == MarketSnapshot.ScreenMode.KLINE_1M) lastOneMinute = now;
        if (now.screenMode == MarketSnapshot.ScreenMode.KLINE_5M) lastFiveMinute = now;

        if (cost > 0) {
            double pnl = (now.price / cost - 1d) * 100d;
            if (pnl <= -1.5d) {
                return decision(TradeDecision.Signal.SELL, "🔴 停損警示", now, null,
                        "已低於成本 " + fmt(Math.abs(pnl)) + "%｜請確認是否依紀律出場");
            }
        }

        if (history.size() < 4) {
            return decision(TradeDecision.Signal.WAIT, "🟡 蒐集盤中資料", now, null,
                    "再等待約 " + (4 - history.size()) + " 秒，避免用單一畫面誤判");
        }

        MarketSnapshot first = history.peekFirst();
        double momentum = (now.price / first.price - 1d) * 100d;
        IntradayScore score = calculateScore(now, momentum);

        if (cost > 0) {
            double pnl = (now.price / cost - 1d) * 100d;
            if (pnl >= 2d && (score.value < 50 || momentum < -0.12d)) {
                return decision(TradeDecision.Signal.REDUCE, "🟠 移動停利／減碼", now, score,
                        "獲利 " + fmt(pnl) + "% 且盤中分數轉弱");
            }
            if (pnl > 0.3d && score.value >= 55) {
                return decision(TradeDecision.Signal.HOLD, "🟢 續抱觀察", now, score,
                        "仍在成本之上，盤中結構尚未明顯轉弱");
            }
        }

        if (score.dataPoints < 2) {
            return decision(TradeDecision.Signal.WAIT, "🟡 已讀現價｜等待欄位", now, score,
                    "目前只有現價，請切到分時五檔或 K 線頁");
        }
        TriggerLevels levels = triggerLevels(now);
        if (levels != null) {
            if (now.price >= levels.bullish) {
                return decision(score.value >= 50 ? TradeDecision.Signal.BUY : TradeDecision.Signal.WAIT,
                        "🟢 站上 " + fmt(levels.bullish) + "｜開始偏多", now, score,
                        "已突破短線壓力；仍需留意日K方向與追價風險");
            }
            if (now.price <= levels.bearish) {
                return decision(TradeDecision.Signal.SELL,
                        "🔴 跌破 " + fmt(levels.bearish) + "｜開始偏空", now, score,
                        "已跌破短線支撐；有持倉請依原定風險處理");
            }
            return decision(TradeDecision.Signal.WAIT,
                    "🟡 " + fmt(levels.bearish) + "～" + fmt(levels.bullish) + "｜整理", now, score,
                    "站上上界開始偏多；跌破下界開始偏空");
        }
        if (score.value >= 68) {
            return decision(TradeDecision.Signal.BUY, "🟢 當沖偏多｜回測可試單", now, score,
                    "多項盤中條件同步偏多，避免直接追最高價");
        }
        if (score.value >= 58) {
            return decision(TradeDecision.Signal.WAIT, "🟡 當沖略偏多｜等確認", now, score,
                    "已有偏多條件，但尚未達到試單門檻");
        }
        if (score.value <= 32) {
            return decision(TradeDecision.Signal.SELL, "🔴 當沖偏空｜避免／出場", now, score,
                    "盤中弱勢條件集中，已有持倉請注意停損");
        }
        if (score.value <= 42) {
            return decision(TradeDecision.Signal.REDUCE, "🟠 當沖偏弱｜減碼防守", now, score,
                    "弱勢條件較多，不宜搶進");
        }
        return decision(TradeDecision.Signal.WAIT, "🟡 多空拉鋸｜暫不下手", now, score,
                "多空條件尚未形成一致方向");
    }

    private IntradayScore calculateScore(MarketSnapshot now, double momentum) {
        int score = 50;
        int dataPoints = 0;
        List<String> reasons = new ArrayList<>();

        if (now.open != null) {
            dataPoints++;
            if (now.price >= now.open) {
                score += 8;
                reasons.add("站上開盤");
            } else {
                score -= 8;
                reasons.add("低於開盤");
            }
        }

        if (now.hasRange()) {
            dataPoints++;
            double position = (now.price - now.low) / (now.high - now.low);
            if (position >= .45d && position <= .88d) {
                score += 5;
                reasons.add("位於日內中上區");
            } else if (position > .96d) {
                score -= 7;
                reasons.add("貼近日高防追價");
            } else if (position < .20d) {
                score -= 5;
                reasons.add("貼近日低");
            }
        }

        if (Math.abs(momentum) >= .03d) {
            dataPoints++;
            int change = (int) Math.round(Math.max(-12d, Math.min(12d, momentum * 40d)));
            score += change;
            reasons.add(momentum > 0 ? "短線動能上升" : "短線動能下降");
        }

        if (now.ma5 != null) {
            dataPoints++;
            if (now.price >= now.ma5) {
                score += 7;
                reasons.add("站上均5");
            } else {
                score -= 7;
                reasons.add("跌破均5");
            }
        }
        if (now.ma5 != null && now.ma10 != null) {
            dataPoints++;
            if (now.ma5 >= now.ma10) {
                score += 9;
                reasons.add("均5在均10上");
            } else {
                score -= 9;
                reasons.add("均5在均10下");
            }
        }
        if (now.kdK != null && now.kdD != null) {
            dataPoints++;
            if (now.kdK > now.kdD && now.kdK < 85d) {
                score += 10;
                reasons.add("KD偏多");
            } else if (now.kdK < now.kdD) {
                score -= 10;
                reasons.add("KD偏空");
            }
            if (now.kdK > 85d) {
                score -= 4;
                reasons.add("KD過熱");
            }
        }
        if (now.macd != null) {
            dataPoints++;
            if (now.macd > 0) {
                score += 6;
                reasons.add("MACD正值");
            } else if (now.macd < 0) {
                score -= 6;
                reasons.add("MACD負值");
            }
        }

        if (now.bidTotal != null && now.askTotal != null
                && now.bidTotal + now.askTotal > 0) {
            dataPoints++;
            double bidRatio = now.bidTotal / (now.bidTotal + now.askTotal);
            if (bidRatio >= .60d) {
                score += 9;
                reasons.add("五檔委買較強");
            } else if (bidRatio <= .40d) {
                score -= 9;
                reasons.add("五檔委賣較強");
            }
        }

        boolean oneFresh = lastOneMinute != null && now.capturedAt - lastOneMinute.capturedAt < 180_000L;
        boolean fiveFresh = lastFiveMinute != null && now.capturedAt - lastFiveMinute.capturedAt < 180_000L;
        if (oneFresh && fiveFresh) {
            dataPoints += 2;
            if (isKlineBullish(lastOneMinute) && isKlineBullish(lastFiveMinute)) {
                score += 13;
                reasons.add("1分5分同步多");
            } else if (isKlineBearish(lastOneMinute) && isKlineBearish(lastFiveMinute)) {
                score -= 13;
                reasons.add("1分5分同步空");
            } else {
                reasons.add("1分5分不同步");
            }
        }

        if (now.changePercent != null && Math.abs(now.changePercent) >= 4d) {
            dataPoints++;
            if (now.changePercent < 0) {
                score -= 5;
                reasons.add("當日跌幅偏大");
            } else {
                score -= 3;
                reasons.add("當日漲幅大防追高");
            }
        }

        score = Math.max(0, Math.min(100, score));
        return new IntradayScore(score, dataPoints, reasons);
    }

    private boolean isKlineBullish(MarketSnapshot snapshot) {
        return snapshot.price != null && snapshot.ma5 != null && snapshot.ma10 != null
                && snapshot.kdK != null && snapshot.kdD != null
                && snapshot.price >= snapshot.ma5
                && snapshot.ma5 >= snapshot.ma10 * .998d
                && snapshot.kdK > snapshot.kdD && snapshot.kdK < 85d;
    }

    private boolean isKlineBearish(MarketSnapshot snapshot) {
        return snapshot.price != null && snapshot.ma5 != null && snapshot.ma10 != null
                && snapshot.kdK != null && snapshot.kdD != null
                && snapshot.price < snapshot.ma5
                && snapshot.ma5 <= snapshot.ma10 * 1.002d
                && snapshot.kdK < snapshot.kdD;
    }

    private boolean isUsable(MarketSnapshot snapshot) {
        return snapshot.symbol != null && snapshot.price != null && snapshot.confidence >= 5;
    }

    private TradeDecision cachedOrUnknown(MarketSnapshot now, String reason) {
        consecutiveMisses++;
        long age = Math.max(0L, now.capturedAt - lastGoodAt);
        if (lastDecision != null && age <= CACHE_WINDOW_MS) {
            return new TradeDecision(lastDecision.signal, lastDecision.headline,
                    lastDecision.detail + "\n⚠️ OCR 暫漏，沿用上一筆 "
                            + String.format(Locale.TAIWAN, "%.1f", age / 1000d) + "秒");
        }
        return unknown(reason + "｜連續漏讀 " + consecutiveMisses + " 次");
    }

    private void resetForSymbol(String symbol) {
        history.clear();
        currentSymbol = symbol;
        lastQuote = null;
        lastDay = null;
        lastOneMinute = null;
        lastFiveMinute = null;
        lastDecision = null;
        lastGoodAt = 0L;
        consecutiveMisses = 0;
    }

    private TradeDecision unknown(String detail) {
        return new TradeDecision(TradeDecision.Signal.UNKNOWN, "⚪ 資訊不足", detail);
    }

    private TradeDecision decision(TradeDecision.Signal signal, String headline,
                                   MarketSnapshot now, IntradayScore score, String reason) {
        StringBuilder detail = new StringBuilder(now.screenMode.label)
                .append("｜現價：").append(fmt(now.price));
        if (score != null) detail.append("｜當沖：").append(score.value).append("分");
        if (now.changePercent != null) detail.append("｜漲跌：").append(fmt(now.changePercent)).append('%');
        if (now.high != null && now.low != null) {
            detail.append("\n今日高低：").append(fmt(now.high)).append("／").append(fmt(now.low));
        }
        if (now.bestBid != null && now.bestAsk != null) {
            detail.append("\n一檔買賣：").append(fmt(now.bestBid)).append("／").append(fmt(now.bestAsk));
        }
        if (now.bidTotal != null && now.askTotal != null) {
            detail.append("｜五檔量：").append(fmt0(now.bidTotal)).append("／").append(fmt0(now.askTotal));
        }
        TriggerLevels levels = triggerLevels(now);
        if (levels != null) {
            detail.append("\n偏多價：").append(fmt(levels.bullish)).append(" 以上")
                    .append("｜偏空價：").append(fmt(levels.bearish)).append(" 以下");
        } else {
            detail.append("\n界線資料：").append(collectionStatus(now));
        }
        detail.append("\n讀取：").append(readStatus(now));
        if (score != null && !score.reasons.isEmpty()) {
            detail.append("\n條件：").append(String.join("、", score.reasons.subList(0,
                    Math.min(4, score.reasons.size()))));
        }
        detail.append("\n建議：").append(reason);
        return new TradeDecision(signal, headline, detail.toString());
    }

    private String readStatus(MarketSnapshot now) {
        return "現價✓ 開高低" + (now.open != null && now.high != null && now.low != null ? "✓" : "—")
                + " 五檔" + (now.bidTotal != null && now.askTotal != null ? "✓" : "—")
                + " 均線" + (now.ma5 != null && now.ma10 != null ? "✓" : "—")
                + " KD" + (now.kdK != null && now.kdD != null ? "✓" : "—")
                + " MACD" + (now.macd != null ? "✓" : "—");
    }

    private TriggerLevels triggerLevels(MarketSnapshot now) {
        long freshness = 10 * 60_000L;
        if (!fresh(lastQuote, now, freshness) || !fresh(lastDay, now, freshness)
                || !fresh(lastOneMinute, now, freshness) || !fresh(lastFiveMinute, now, freshness)) {
            return null;
        }
        if (lastOneMinute.high == null || lastOneMinute.low == null
                || lastFiveMinute.high == null || lastFiveMinute.low == null) return null;

        double bullish = Math.max(lastOneMinute.high, lastFiveMinute.high);
        double bearish = Math.min(lastOneMinute.low, lastFiveMinute.low);
        if (lastQuote.open != null && Math.abs(lastQuote.open / now.price - 1d) <= .03d) {
            bullish = Math.max(bullish, lastQuote.open);
        }
        if (lastDay.ma5 != null && lastDay.price < lastDay.ma5
                && Math.abs(lastDay.ma5 / now.price - 1d) <= .03d) {
            bullish = Math.max(bullish, lastDay.ma5);
        }
        return bullish > bearish ? new TriggerLevels(bullish, bearish) : null;
    }

    private boolean fresh(MarketSnapshot snapshot, MarketSnapshot now, long maxAge) {
        return snapshot != null && snapshot.symbol.equals(now.symbol)
                && now.capturedAt - snapshot.capturedAt <= maxAge;
    }

    private String collectionStatus(MarketSnapshot now) {
        long freshness = 10 * 60_000L;
        return "資訊" + (fresh(lastQuote, now, freshness) ? "✓" : "—")
                + " 日K" + (fresh(lastDay, now, freshness) ? "✓" : "—")
                + " 1分" + (fresh(lastOneMinute, now, freshness) ? "✓" : "—")
                + " 5分" + (fresh(lastFiveMinute, now, freshness) ? "✓" : "—");
    }

    private String fmt(double value) {
        return String.format(Locale.TAIWAN, "%.2f", value);
    }

    private String fmt0(double value) {
        return String.format(Locale.TAIWAN, "%.0f", value);
    }

    private static final class IntradayScore {
        final int value;
        final int dataPoints;
        final List<String> reasons;

        IntradayScore(int value, int dataPoints, List<String> reasons) {
            this.value = value;
            this.dataPoints = dataPoints;
            this.reasons = reasons;
        }
    }

    private static final class TriggerLevels {
        final double bullish;
        final double bearish;

        TriggerLevels(double bullish, double bearish) {
            this.bullish = bullish;
            this.bearish = bearish;
        }
    }
}
