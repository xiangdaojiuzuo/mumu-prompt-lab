package tw.mumu.yuantaassistant;

final class TradeDecision {
    enum Signal { BUY, HOLD, WAIT, REDUCE, SELL, UNKNOWN }

    final Signal signal;
    final String headline;
    final String detail;

    TradeDecision(Signal signal, String headline, String detail) {
        this.signal = signal;
        this.headline = headline;
        this.detail = detail;
    }
}
