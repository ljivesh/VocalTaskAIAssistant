import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

class AzureSpeechClient {
    constructor() {
        const speechConfig = sdk.SpeechConfig.fromSubscription(
            process.env.AZURE_SPEECH_KEY,
            process.env.AZURE_SPEECH_REGION
        );
        speechConfig.speechRecognitionLanguage = "en-US";
        this.speechConfig = speechConfig;
    }

    async streamToText(audioStream, onRecognized) {
        return new Promise((resolve, reject) => {
            const format = {
                samplesPerSec: 48000,
                bitsPerSample: 16,
                channels: 1,
                audioFormat: 1,
                blockAlign: 2,
                avgBytesPerSec: 96000
            };

            try {
                const pushStream = sdk.AudioInputStream.createPushStream(format);
                const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
                const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

                let isRecognizing = false;

                recognizer.recognized = (s, e) => {
                    if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
                        onRecognized(e.result.text);
                    }
                };

                recognizer.canceled = (s, e) => {
                    console.error(`Speech recognition canceled: ${e.errorDetails}`);
                    isRecognizing = false;
                    recognizer.stopContinuousRecognitionAsync(
                        () => {
                            pushStream.close();
                            resolve();
                        },
                        (err) => reject(err)
                    );
                };

                recognizer.sessionStopped = () => {
                    isRecognizing = false;
                    recognizer.stopContinuousRecognitionAsync(
                        () => {
                            pushStream.close();
                            resolve();
                        },
                        (err) => reject(err)
                    );
                };

                recognizer.startContinuousRecognitionAsync(
                    () => {
                        console.log('Recognition started successfully');
                        isRecognizing = true;

                        audioStream.on('data', (chunk) => {
                            try {
                                if (!isRecognizing) return;
                                if (!chunk || chunk.length === 0) return;

                                const buffer = Buffer.allocUnsafe(chunk.length);
                                chunk.copy(buffer);

                                pushStream.write(buffer.buffer.slice(
                                    buffer.byteOffset,
                                    buffer.byteOffset + buffer.byteLength
                                ));
                            } catch (err) {
                                console.warn('Error processing audio chunk:', err);
                            }
                        });

                        audioStream.on('end', () => {
                            console.log('Audio stream ended');
                            isRecognizing = false;
                            pushStream.close();
                        });

                        audioStream.on('error', (err) => {
                            console.error('Audio stream error:', err);
                            isRecognizing = false;
                            pushStream.close();
                            reject(err);
                        });
                    },
                    (err) => {
                        console.error('Failed to start recognition:', err);
                        reject(err);
                    }
                );

            } catch (error) {
                console.error('Setup error:', error);
                reject(error);
            }
        });
    }
}

export default AzureSpeechClient;