import { faker } from '@faker-js/faker';

class TranscriptGenerator {
  constructor() {
    this.participants = ['Alice', 'Bob', 'Charlie', 'David'];
    this.topics = ['Project Timeline', 'Budget Discussion', 'Technical Issues', 'Client Feedback'];
  }

  generateTimestamp(startTime, index) {
    const time = new Date(startTime.getTime() + index * 30000); // 30 second intervals
    return time.toISOString();
  }

  generateUtterance(speaker) {
    const utteranceTypes = [
      () => faker.company.catchPhrase(),
      () => `I think we should ${faker.company.buzzVerb()} the ${faker.company.buzzNoun()}`,
      () => `What about the ${faker.company.buzzNoun()}?`,
      () => `Let's focus on ${faker.company.buzzPhrase()}`
    ];
    return utteranceTypes[Math.floor(Math.random() * utteranceTypes.length)]();
  }

  generateTranscript(durationMinutes = 45) {
    const startTime = new Date();
    const utterances = [];
    const utteranceCount = (durationMinutes * 60) / 30; // One utterance every 30 seconds

    for (let i = 0; i < utteranceCount; i++) {
      const speaker = this.participants[Math.floor(Math.random() * this.participants.length)];
      utterances.push({
        timestamp: this.generateTimestamp(startTime, i),
        speaker,
        text: this.generateUtterance(speaker)
      });
    }

    return utterances;
  }
}

export default TranscriptGenerator;