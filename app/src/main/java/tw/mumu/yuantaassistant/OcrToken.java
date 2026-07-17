package tw.mumu.yuantaassistant;

final class OcrToken {
    final String text;
    final float centerX;
    final float centerY;
    final float height;

    OcrToken(String text, float centerX, float centerY, float height) {
        this.text = text;
        this.centerX = centerX;
        this.centerY = centerY;
        this.height = height;
    }

    boolean inside(float left, float top, float right, float bottom) {
        return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
    }
}
