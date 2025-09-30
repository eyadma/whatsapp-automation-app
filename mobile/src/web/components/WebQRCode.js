import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import QRCodeLib from 'qrcode';

const WebQRCode = ({ value, size = 200, color = 'black', backgroundColor = 'white', ...props }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      // Generate QR code
      QRCodeLib.toCanvas(canvas, value, {
        width: size,
        margin: 2,
        color: {
          dark: color,
          light: backgroundColor
        }
      }).catch(err => {
        console.error('QR Code generation error:', err);
        // Fallback: draw error message
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code Error', size / 2, size / 2 - 10);
        ctx.fillText('Invalid Data', size / 2, size / 2 + 10);
      });
    }
  }, [value, size, color, backgroundColor]);

  if (!value) {
    return (
      <View style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        width: size,
        height: size,
      }}>
        <Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>No QR Data</Text>
      </View>
    );
  }

  return (
    <View style={{
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 8,
      width: size,
      height: size,
      overflow: 'hidden',
    }}>
      {/** Avoid passing RN StyleSheet styles to DOM canvas; only width/height attributes */}
      <canvas ref={canvasRef} width={size} height={size} {...props} />
    </View>
  );
};

export default WebQRCode;
