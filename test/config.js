export const testConfig = {
    numTestRuns: 100,
    audioTestFiles: [
      'short-meeting.wav',
      'medium-meeting.wav',
      'long-meeting.wav'
    ],
    testQueries: [
      'What was discussed about the project timeline?',
      'Who is responsible for the backend development?',
      'What were the key decisions made?'
    ],
    referenceTranscripts: {
      'short-meeting.wav': 'path/to/reference/transcript1.txt',
      'medium-meeting.wav': 'path/to/reference/transcript2.txt',
      'long-meeting.wav': 'path/to/reference/transcript3.txt'
    }
  };