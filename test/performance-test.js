import { TranscriptGenerator } from './generate-transcripts.js';
import fs from 'fs/promises';

class PerformanceTest {
  constructor() {
    this.transcriptGenerator = new TranscriptGenerator();
    this.metrics = {
      processingTimes: [],
      summaryGenerationTimes: [],
      searchAccuracy: []
    };
  }

  async runSingleMeetingTest() {
    const transcript = this.transcriptGenerator.generateTranscript(45);
    
    console.log('Starting transcript processing...');
    const startTime = process.hrtime.bigint();
    
    // Process transcript directly without audio
    const summary = transcript.map(utterance => 
      `${utterance.speaker}: ${utterance.text}`
    ).join('\n');
    
    const endTime = process.hrtime.bigint();
    const processingTime = Number(endTime - startTime) / 1e6; // Convert to milliseconds
    
    return {
      processingTime,
      summary,
      transcript
    };
  }

  async runBatchTests(numTests = 10) {
    const results = [];
    
    for (let i = 0; i < numTests; i++) {
      console.log(`Running test ${i + 1}/${numTests}`);
      const result = await this.runSingleMeetingTest();
      results.push(result);
      
      // Add cooldown between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.analyzeResults(results);
  }

  analyzeResults(results) {
    const metrics = {
      averageProcessingTime: 0,
      summaryQuality: 0,
      processingTimes: [],
      summaryLengths: []
    };

    results.forEach(result => {
      metrics.processingTimes.push(result.processingTime);
      metrics.summaryLengths.push(result.summary.length);
    });

    metrics.averageProcessingTime = 
      metrics.processingTimes.reduce((a, b) => a + b, 0) / results.length;

    return metrics;
  }
}

// Usage
async function runTests() {
  const tester = new PerformanceTest();
  const results = await tester.runBatchTests(10);
  
  // Save results
  await fs.writeFile(
    'test-results.json', 
    JSON.stringify(results, null, 2)
  );
  
  console.log('Test Results:', results);
}

runTests().catch(console.error); 