package com.festflow.backend.service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;

/** 사진을 작은 JPEG 로 바꾼다. 목록용 작은 사진과, AI 가 만든 큰 PNG 를 줄이는 데 쓴다. */
public final class ImageResizer {

    private ImageResizer() {
    }

    /**
     * @param maxWidth 이보다 넓으면 비율을 지켜 줄인다. 0 이하면 크기는 그대로 둔다.
     * @return JPEG 바이트. 읽을 수 없는 형식(webp 등)이거나 실패하면 null — 부르는 쪽이 원본을 그대로 쓴다.
     */
    public static byte[] toJpeg(byte[] source, int maxWidth, float quality) {
        if (source == null || source.length == 0) {
            return null;
        }
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(source));
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                return null;
            }
            int width = image.getWidth();
            int height = image.getHeight();
            if (maxWidth > 0 && width > maxWidth) {
                height = Math.max(1, Math.round(height * (maxWidth / (float) width)));
                width = maxWidth;
            }

            // JPEG 에는 투명이 없으므로 흰 바탕에 그린다.
            BufferedImage canvas = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = canvas.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, width, height);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                if (width < image.getWidth() / 2) {
                    // 절반보다 더 줄일 때는 한 번에 줄이면 거칠어진다. 부드럽게 줄인 뒤 그린다.
                    graphics.drawImage(image.getScaledInstance(width, height, java.awt.Image.SCALE_SMOOTH), 0, 0, null);
                } else {
                    graphics.drawImage(image, 0, 0, width, height, null);
                }
            } finally {
                graphics.dispose();
            }

            Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
            if (!writers.hasNext()) {
                return null;
            }
            ImageWriter writer = writers.next();
            ByteArrayOutputStream output = new ByteArrayOutputStream(64 * 1024);
            try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
                writer.setOutput(imageOutput);
                ImageWriteParam param = writer.getDefaultWriteParam();
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(Math.max(0.1f, Math.min(1f, quality)));
                writer.write(null, new IIOImage(canvas, null, null), param);
            } finally {
                writer.dispose();
            }
            return output.toByteArray();
        } catch (Throwable e) {
            // 그림 라이브러리가 없는 서버(가벼운 컨테이너)에서는 Error 가 난다. 어떤 경우든 원본을 그대로 쓰게 한다.
            return null;
        }
    }
}
