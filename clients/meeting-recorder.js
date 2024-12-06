import MeetingProcessor  from './meeting-processor.js';

export class MeetingRecorder {
  constructor() {
    this.processor = null;
    this.isRecording = false;
  }

  async startRecording() {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    this.processor = new MeetingProcessor();
    await this.processor.initialize();
    this.isRecording = true;
  }

  async processAudioChunk(text, username) {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    // Since we're already getting text from Azure, we can process it directly
    if (text) {
      await this.processor.processTextChunk(`${username}: ${text}`);
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    this.isRecording = false;
    return await this.processor.generateMeetingSummary();
  }
}

export default MeetingRecorder;