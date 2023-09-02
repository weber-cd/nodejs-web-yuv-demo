const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// The width and height of the video file.
const WIDTH = 640;
const HEIGHT = 360;

const PORT = 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
  // 返回index.html文件
  const indexPath = path.join(__dirname, '../index.html');
  res.sendFile(indexPath);
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  const inputFilePath = '../static/video.mp4';
  const frameInterval = 1000 / 24; // Milliseconds
  let lastFrameSent = Date.now() - frameInterval; // Initialize with a past time
  const frameSizeYUV422p = WIDTH * HEIGHT * 2; // YUV422 frame size
  let frameBuffer = Buffer.alloc(0); // Initialize an empty buffer for accumulating frame data

  const command = ffmpeg(inputFilePath)
    .videoCodec('rawvideo')
    .noAudio()
    .inputFormat('mp4')
    .size(`${WIDTH}x${HEIGHT}`)
    .fps(24)
    .outputOptions([
      '-pix_fmt yuv422p',
      '-f rawvideo',
    ])
    .on('end', () => {
      console.log('FFmpeg process finished');
    })
    .on('error', (err) => {
      console.error('An error occurred:', err.message);
    });

  const ffstream = command.pipe();

  ffstream.on('data', (data) => {
    frameBuffer = Buffer.concat([frameBuffer, data]);
    if (frameBuffer.length >= frameSizeYUV422p) {
      const currentTime = Date.now();
      
      if (currentTime - lastFrameSent >= frameInterval) {
        const yuv422pFrame = frameBuffer.slice(0, frameSizeYUV422p);
  
        // const yuvyFrame = convertYUV422pToYUVY(yuv422pFrame)
        const yuvyFrame = yuv422pFrame;
        ws.send(yuvyFrame); // Send the YUVY formatted frame
        frameBuffer = frameBuffer.slice(frameSizeYUV422p); // Remove the sent frame data
        lastFrameSent = currentTime;
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    ffstream.destroy(); // Stop the ffmpeg command
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
