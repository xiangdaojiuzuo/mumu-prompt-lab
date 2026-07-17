package tw.mumu.yuantaassistant;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ScreenTextParser {
    private static final Pattern SYMBOL = Pattern.compile("(?<!\\d)(\\d{4,6})(?!\\d)");
    private static final Pattern PERCENT = Pattern.compile("([+-]?\\d{1,3}(?:\\.\\d{1,2})?)\\s*%");
    private static final Pattern DECIMAL = Pattern.compile("(?<!\\d)([0-9]{1,5}(?:\\.[0-9]{1,4}))(?!\\d)");

    private ScreenTextParser() { }

    static MarketSnapshot parse(String source) {
        return parse(source, Collections.emptyList(), MarketSnapshot.ScreenMode.UNKNOWN);
    }

    static MarketSnapshot parse(String source, List<OcrToken> tokens,
                                MarketSnapshot.ScreenMode screenMode) {
        String text = normalize(source);

        String symbol = findHeaderSymbol(tokens);
        if (symbol == null) symbol = findSymbol(text);

        Double price = findHeaderPrice(tokens);
        if (price == null) price = findLabeled(text, "成交價", "最新價", "現價", "成交");
        if (price == null) price = findStandalonePriceAfterTime(text);

        Double open = findLabeled(text, "開盤", "今開", "開");
        Double high = findLabeled(text, "最高", "今高", "高");
        Double low = findLabeled(text, "最低", "今低", "低");

        Double percent = findHeaderPercent(tokens);
        if (percent == null) percent = findPercent(text);
        percent = applyHeaderDirection(percent, tokens);

        Double ma5 = findLabeled(text, "均價5", "MA5");
        Double ma10 = findLabeled(text, "均價10", "MA10");
        Double ma20 = findLabeled(text, "均價20", "MA20");
        Double macd = findSignedIndicator(text, "MACD");
        Double kdK = findKd(text, "K");
        Double kdD = findKd(text, "D");

        Double bestBid = findTopPriceInRegion(tokens, 0.26f, 0.69f, 0.49f, 0.88f);
        Double bestAsk = findTopPriceInRegion(tokens, 0.50f, 0.69f, 0.75f, 0.88f);
        Double bidTotal = findBottomIntegerInRegion(tokens, 0.01f, 0.79f, 0.25f, 0.91f);
        Double askTotal = findBottomIntegerInRegion(tokens, 0.78f, 0.79f, 0.99f, 0.91f);

        int confidence = 0;
        if (symbol != null) confidence += 2;
        if (price != null) confidence += 3;
        if (open != null) confidence++;
        if (high != null) confidence++;
        if (low != null) confidence++;
        if (percent != null) confidence++;
        if (screenMode != MarketSnapshot.ScreenMode.UNKNOWN) confidence++;

        if (price != null && price <= 0) price = null;
        if (high != null && low != null && high < low) {
            high = null;
            low = null;
            confidence = Math.max(0, confidence - 2);
        }
        if (bestBid != null && bestAsk != null && bestBid > bestAsk) {
            bestBid = null;
            bestAsk = null;
        }

        return new MarketSnapshot(symbol, price, open, high, low, percent,
                ma5, ma10, ma20, macd, kdK, kdD, bestBid, bestAsk,
                bidTotal, askTotal, screenMode, confidence);
    }

    private static String normalize(String source) {
        return source == null ? "" : source
                .replace(',', ' ')
                .replace('：', ':')
                .replace('﹕', ':');
    }

    private static String findHeaderSymbol(List<OcrToken> tokens) {
        for (OcrToken token : tokens) {
            if (!token.inside(0.08f, 0.095f, 0.42f, 0.185f)) continue;
            Matcher matcher = SYMBOL.matcher(token.text);
            if (matcher.find()) {
                String candidate = matcher.group(1);
                if (candidate.length() == 4 || candidate.startsWith("00")) return candidate;
            }
        }
        return null;
    }

    private static Double findHeaderPrice(List<OcrToken> tokens) {
        OcrToken best = null;
        Double value = null;
        for (OcrToken token : tokens) {
            if (!token.inside(0.30f, 0.085f, 0.69f, 0.185f)) continue;
            Double candidate = firstDecimal(token.text);
            if (candidate == null || candidate <= 0) continue;
            if (best == null || token.height > best.height) {
                best = token;
                value = candidate;
            }
        }
        return value;
    }

    private static Double findHeaderPercent(List<OcrToken> tokens) {
        for (OcrToken token : tokens) {
            if (!token.inside(0.65f, 0.09f, 0.98f, 0.19f)) continue;
            Matcher matcher = PERCENT.matcher(token.text);
            if (matcher.find()) return parseNumber(matcher.group(1));
        }
        return null;
    }

    private static Double applyHeaderDirection(Double percent, List<OcrToken> tokens) {
        if (percent == null) return null;
        for (OcrToken token : tokens) {
            if (!token.inside(0.65f, 0.075f, 0.98f, 0.19f)) continue;
            if (token.text.contains("▼") || token.text.contains("▽") || token.text.contains("↓")) {
                return -Math.abs(percent);
            }
            if (token.text.contains("▲") || token.text.contains("△") || token.text.contains("↑")) {
                return Math.abs(percent);
            }
        }
        return percent;
    }

    private static Double findTopPriceInRegion(List<OcrToken> tokens,
                                                float left, float top,
                                                float right, float bottom) {
        return tokens.stream()
                .filter(token -> token.inside(left, top, right, bottom))
                .sorted(Comparator.comparingDouble(token -> token.centerY))
                .map(token -> firstDecimal(token.text))
                .filter(value -> value != null && value > 0)
                .findFirst()
                .orElse(null);
    }

    private static Double findBottomIntegerInRegion(List<OcrToken> tokens,
                                                     float left, float top,
                                                     float right, float bottom) {
        return tokens.stream()
                .filter(token -> token.inside(left, top, right, bottom))
                .sorted((a, b) -> Float.compare(b.centerY, a.centerY))
                .map(token -> parseInteger(token.text))
                .filter(value -> value != null && value >= 0)
                .findFirst()
                .orElse(null);
    }

    private static String findSymbol(String text) {
        String[] lines = text.split("\\R");
        for (int i = 0; i < Math.min(lines.length, 14); i++) {
            String line = lines[i].trim();
            if (line.contains(":") || line.contains("%")) continue;
            Matcher matcher = SYMBOL.matcher(line);
            if (matcher.find()) {
                String candidate = matcher.group(1);
                if (candidate.length() == 4 || candidate.startsWith("00")) return candidate;
            }
        }
        return null;
    }

    private static Double findLabeled(String text, String... labels) {
        for (String label : labels) {
            Pattern pattern = Pattern.compile(
                    Pattern.quote(label) + "\\s*:?\\s*([0-9]{1,5}(?:\\.[0-9]{1,4})?)",
                    Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) return parseNumber(matcher.group(1));
        }
        return null;
    }

    private static Double findSignedIndicator(String text, String label) {
        Pattern pattern = Pattern.compile(Pattern.quote(label)
                + "\\s*:?\\s*([+-]?\\d+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? parseNumber(matcher.group(1)) : null;
    }

    private static Double findKd(String text, String label) {
        Pattern pattern = Pattern.compile("(?:^|\\s)" + label
                + "(?:\\([^)]*\\))?\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)",
                Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? parseNumber(matcher.group(1)) : null;
    }

    private static Double findStandalonePriceAfterTime(String text) {
        Pattern pattern = Pattern.compile("\\b\\d{2}:\\d{2}(?::\\d{2})?\\s+(?:價\\s*:?\\s*)?([0-9]+(?:\\.[0-9]+)?)");
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? parseNumber(matcher.group(1)) : null;
    }

    private static Double findPercent(String text) {
        Matcher matcher = PERCENT.matcher(text);
        return matcher.find() ? parseNumber(matcher.group(1)) : null;
    }

    private static Double firstDecimal(String value) {
        Matcher matcher = DECIMAL.matcher(value);
        return matcher.find() ? parseNumber(matcher.group(1)) : null;
    }

    private static Double parseInteger(String value) {
        Matcher matcher = Pattern.compile("(?<!\\d)([0-9][0-9,]{0,8})(?!\\d)").matcher(value);
        if (!matcher.find()) return null;
        return parseNumber(matcher.group(1).replace(",", ""));
    }

    private static Double parseNumber(String value) {
        try {
            return Double.parseDouble(value.trim().toLowerCase(Locale.ROOT));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
