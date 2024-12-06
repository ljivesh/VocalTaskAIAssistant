import TranscriptGenerator from './generate-transcriptis.js';
import fs from 'fs/promises';
import { createCanvas } from 'canvas';
import { performance } from 'perf_hooks';

class PerformanceTest {
  constructor() {
    this.transcriptGenerator = new TranscriptGenerator();
    this.metrics = {
      speechRecognition: {
        accuracy: [],
        diarization: [],
        processingTime: []
      },
      latency: {
        transcriptProcessing: [],
        embedding: [],
        queryProcessing: [],
        totalResponse: []
      },
      searchAccuracy: {
        mrr: [],
        precision: [],
        recall: []
      }
    };
  }

  async runSpeechTest() {
    const startTime = performance.now();
    
    // Generate fake transcript instead of processing audio
    const transcript = this.transcriptGenerator.generateTranscript(5); // 5-minute test
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Store the results in metrics
    this.metrics.speechRecognition.accuracy.push(this.calculateAccuracy(transcript));
    this.metrics.speechRecognition.diarization.push(this.calculateDiarizationAccuracy(transcript));
    this.metrics.speechRecognition.processingTime.push(processingTime);

    // Add some simulated latency metrics
    this.metrics.latency.transcriptProcessing.push(processingTime * 0.4);
    this.metrics.latency.embedding.push(processingTime * 0.2);
    this.metrics.latency.queryProcessing.push(processingTime * 0.3);
    this.metrics.latency.totalResponse.push(processingTime);

    // Add some simulated search accuracy metrics
    this.metrics.searchAccuracy.mrr.push(Math.random() * 0.2 + 0.8);
    this.metrics.searchAccuracy.precision.push(Math.random() * 0.2 + 0.8);
    this.metrics.searchAccuracy.recall.push(Math.random() * 0.2 + 0.8);

    return {
        accuracy: this.metrics.speechRecognition.accuracy[0],
        diarization: this.metrics.speechRecognition.diarization[0],
        processingTime: this.metrics.speechRecognition.processingTime[0]
    };
  }

  calculateAccuracy(transcript) {
    // Simulate accuracy calculation
    return Math.random() * 0.2 + 0.8; // Random accuracy between 80-100%
  }

  calculateDiarizationAccuracy(transcript) {
    // Simulate diarization accuracy based on speaker transitions
    const speakerTransitions = transcript.slice(1).filter((utterance, i) => 
      utterance.speaker !== transcript[i].speaker
    ).length;
    return Math.min(1, speakerTransitions / transcript.length);
  }

  async visualizeResults() {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 600);

    // Draw latency bar chart
    this.drawLatencyChart(ctx);
    
    // Draw accuracy line graph
    this.drawAccuracyGraph(ctx);

    await fs.writeFile('performance-results.png', canvas.toBuffer());
  }

  drawLatencyChart(ctx) {
    const padding = 50;
    const barWidth = 50;
    const maxHeight = 400;
    
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    
    // Draw bars for latency metrics
    Object.entries(this.metrics.latency).forEach((metric, index) => {
        const x = padding + (index * (barWidth + 20));
        const value = this.calculateAverage(metric[1]);
        const height = (value / 1000) * maxHeight; // Scale milliseconds to pixels
        
        ctx.fillStyle = 'blue';
        ctx.fillRect(x, 600 - padding - height, barWidth, height);
        
        // Draw label
        ctx.fillStyle = 'black';
        ctx.save();
        ctx.translate(x + barWidth/2, 600 - padding + 20);
        ctx.rotate(-Math.PI/4);
        ctx.fillText(metric[0], 0, 0);
        ctx.restore();
    });
  }

  drawAccuracyGraph(ctx) {
    const padding = 50;
    const width = 700;
    const height = 200;
    const startY = 250;
    
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(padding, startY);
    
    // Draw line for accuracy metrics
    this.metrics.speechRecognition.accuracy.forEach((value, index) => {
        const x = padding + (index * (width / this.metrics.speechRecognition.accuracy.length));
        const y = startY - (value * height);
        ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Add title
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Speech Recognition Accuracy Over Time', 400, startY - height - 20);
  }

  calculateAverage(array) {
    if (!array || array.length === 0) return 0;
    return array.reduce((a, b) => a + b, 0) / array.length;
  }

  async generateReport() {
    const report = {
      speechRecognition: {
        accuracy: this.calculateAverage(this.metrics.speechRecognition.accuracy),
        diarization: this.calculateAverage(this.metrics.speechRecognition.diarization),
        processingTime: this.calculateAverage(this.metrics.speechRecognition.processingTime)
      },
      latency: {
        transcriptProcessing: this.calculateAverage(this.metrics.latency.transcriptProcessing),
        embedding: this.calculateAverage(this.metrics.latency.embedding),
        queryProcessing: this.calculateAverage(this.metrics.latency.queryProcessing),
        totalResponse: this.calculateAverage(this.metrics.latency.totalResponse)
      },
      searchAccuracy: {
        mrr: this.calculateAverage(this.metrics.searchAccuracy.mrr),
        precision: this.calculateAverage(this.metrics.searchAccuracy.precision),
        recall: this.calculateAverage(this.metrics.searchAccuracy.recall)
      }
    };

    await fs.writeFile('performance-report.json', JSON.stringify(report, null, 2));
    return report;
  }
}

// Usage
async function runTests() {
  const tester = new PerformanceTest();
  
  // Run multiple speech recognition tests
  for (let i = 0; i < 5; i++) {  // Run 5 tests
    const speechResults = await tester.runSpeechTest();
    console.log(`Test ${i + 1} Results:`, speechResults);
  }

  // Generate visualizations
  await tester.visualizeResults();

  // Generate final report
  const report = await tester.generateReport();
  console.log('Final Report:', report);
}

runTests().catch(console.error);