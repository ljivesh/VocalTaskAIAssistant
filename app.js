class VocalTaskApp {
    constructor() {
        this.conversationManager = new ConversationManager();
        this.meetingRecorder = new MeetingRecorder();
    }

    async handleCommand(command) {
        switch(command.toLowerCase()) {
            case 'start meeting':
                await this.meetingRecorder.startRecording();
                return 'Meeting recording started';
                
            case 'end meeting':
                await this.meetingRecorder.stopRecording();
                return 'Meeting recording ended';
                
            default:
                // Handle as a query
                return await this.conversationManager.handleVoiceQuery();
        }
    }
}

const app = new VocalTaskApp();

// Example usage
app.handleCommand('start meeting');
app.handleCommand('end meeting');