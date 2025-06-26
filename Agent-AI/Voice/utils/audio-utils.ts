import { AudioLevel } from '../types/index.js';

export class AudioUtils {
  static calculateAudioLevel(buffer: Buffer): number {
    const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    let sum = 0;
    
    for (let i = 0; i < int16Array.length; i++) {
      sum += Math.abs(int16Array[i]);
    }
    
    return sum / (int16Array.length * 32768);
  }

  static getAudioLevelInfo(buffer: Buffer): AudioLevel {
    const level = this.calculateAudioLevel(buffer);
    const percentage = level * 100;
    const bar = '█'.repeat(Math.floor(level * 20));
    
    return {
      level,
      percentage,
      bar: bar.padEnd(20, '░')
    };
  }

  static convertBufferToFloat32(buffer: Buffer): Float32Array {
    const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    const float32Array = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    
    return float32Array;
  }

  static isAudioDetected(buffer: Buffer, threshold: number = 0.01): boolean {
    return this.calculateAudioLevel(buffer) > threshold;
  }

  static downsampleBuffer(int16: Int16Array, inputRate: number, outputRate: number): Int16Array {
    if (inputRate === outputRate) return int16;
    const ratio = inputRate / outputRate;
    const newLength = Math.floor(int16.length / ratio);
    const result = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = Math.floor(i * ratio);
      if (sourceIndex < int16.length) {
        result[i] = int16[sourceIndex];
      }
    }
    return result;
  }
} 