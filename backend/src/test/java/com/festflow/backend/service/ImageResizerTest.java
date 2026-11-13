package com.festflow.backend.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class ImageResizerTest {

    private static byte[] noisyPng(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        Random random = new Random(7);
        for (int i = 0; i < 400; i++) {
            graphics.setColor(new Color(random.nextInt(256), random.nextInt(256), random.nextInt(256)));
            graphics.fillRect(random.nextInt(width), random.nextInt(height), 40, 40);
        }
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    @Test
    void shrinksToTheRequestedWidthKeepingTheRatio() throws Exception {
        byte[] jpeg = ImageResizer.toJpeg(noisyPng(1024, 1536), 480, 0.82f);

        assertThat(jpeg).isNotNull();
        BufferedImage result = ImageIO.read(new ByteArrayInputStream(jpeg));
        assertThat(result.getWidth()).isEqualTo(480);
        assertThat(result.getHeight()).isEqualTo(720);
    }

    @Test
    void keepsSizeWhenNoWidthIsGiven() throws Exception {
        byte[] jpeg = ImageResizer.toJpeg(noisyPng(300, 200), 0, 0.88f);

        BufferedImage result = ImageIO.read(new ByteArrayInputStream(jpeg));
        assertThat(result.getWidth()).isEqualTo(300);
        assertThat(result.getHeight()).isEqualTo(200);
    }

    @Test
    void returnsNullForSomethingThatIsNotAnImage() {
        assertThat(ImageResizer.toJpeg("not an image".getBytes(), 480, 0.8f)).isNull();
        assertThat(ImageResizer.toJpeg(new byte[0], 480, 0.8f)).isNull();
    }
}
