import { queryMeetingsWithRAG } from '../discord-voice.js';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';

// Dummy meeting data to simulate database content
const DUMMY_MEETINGS = [
    {
        id: 1731855944101,
        date: "2024-03-17",
        summary: "Product roadmap and marketing strategy meeting. Discussed Q2 launch of mobile app v2.0, budget allocation of $150K, and marketing campaign timeline. Team agreed on influencer marketing strategy and SEO improvements.",
        transcript: [
            "Alex (PM): Let's review our Q2 product roadmap. The mobile app v2.0 is our main priority.",
            "Sarah (Marketing): We've allocated $150,000 for the Q2 marketing push. 40% for influencer partnerships, 35% for paid ads, and 25% for content marketing.",
            "John (Dev): The app development is on track. New features include dark mode, offline support, and improved search functionality.",
            "Sarah: We've identified 25 potential influencers in our target market. Expected reach is 2M+ users.",
            "Alex: Great. Timeline looks good. Launch date is set for June 15th. Marketing campaign starts May 1st.",
            "Tom (SEO): Our keyword research shows we should focus on 'mobile productivity', 'workflow automation', and 'team collaboration' terms.",
            "Sarah: Perfect. We'll create content clusters around these keywords. Also planning video tutorials for each new feature."
        ]
    },
    {
        id: 1731855944102,
        date: "2024-03-18",
        summary: "Engineering team sprint planning. Addressed critical security vulnerabilities, discussed AWS infrastructure optimization, and planned new feature implementations. Team velocity at 85 story points per sprint.",
        transcript: [
            "Maria (Tech Lead): Security audit revealed three high-priority vulnerabilities in the authentication system.",
            "David (DevOps): AWS costs increased 15% last month. Suggesting move to spot instances for non-critical services.",
            "James (Backend): The payment processing microservice needs refactoring. Current response time is 2.3 seconds, target is under 1 second.",
            "Maria: Let's prioritize the auth fixes. James, can your team handle this in the current sprint?",
            "James: Yes, we'll need about 13 story points for the auth fixes. Already created tickets TECH-456 and TECH-457.",
            "David: I've prepared a capacity planning doc for the AWS optimization. Estimated savings of $3000/month.",
            "Maria: Good. Also, we need to hire two senior backend developers. HR posted the job listings yesterday."
        ]
    },
    {
        id: 1731855944103,
        date: "2024-03-19",
        summary: "Customer success quarterly review. NPS increased to 58, churn rate decreased to 2.1%. Discussed support team expansion and new onboarding flow. Major enterprise client wins highlighted.",
        transcript: [
            "Lisa (CS Lead): Q1 metrics are strong. NPS up from 45 to 58, customer satisfaction at 92%.",
            "Mike (Support): Average response time down to 2.4 hours from 4.1 hours last quarter.",
            "Emma (Onboarding): New interactive onboarding flow showing 34% better completion rate.",
            "Lisa: We signed three major enterprise clients: Tesla, Adobe, and Shopify.",
            "Mike: Support team needs expansion. Proposing 4 new hires: 2 L1 support, 1 L2, and 1 technical writer.",
            "Emma: Customer feedback shows main pain points: API documentation clarity and mobile app stability.",
            "Lisa: Churn rate decreased to 2.1%. Retention initiatives working well. Especially the new premium support tier."
        ]
    },
    {
        id: 1731855944104,
        date: "2024-03-20",
        summary: "Financial review and budget planning. Revenue grew 45% YoY, operating costs up 28%. Approved $2M budget for Q2 expansion. Discussed international market entry strategy.",
        transcript: [
            "Robert (CFO): Q1 revenue at $12.5M, up 45% YoY. Operating margin improved to 28%.",
            "Jennifer (Finance): R&D spending increased to 32% of revenue, up from 28% last quarter.",
            "Mark (Strategy): European expansion on track. German office opens next month.",
            "Robert: Board approved $2M budget for Q2. Primary allocations: $800K for hiring, $600K for marketing, $600K for infrastructure.",
            "Jennifer: Cash runway extended to 24 months. Burn rate stable at $400K/month.",
            "Mark: APAC market research complete. Suggesting Singapore as regional HQ.",
            "Robert: Good. Let's prepare detailed APAC expansion budget by next week."
        ]
    }
];

const TEST_QUERIES = [
    {
        type: "meeting",
        query: "What are the details of the Q2 mobile app launch and marketing budget?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944101,
        expectedInfo: "mobile app v2.0 June 15th $150,000 marketing budget influencer"
    },
    {
        type: "meeting",
        query: "What security issues were discussed in the engineering meeting and how are they being addressed?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944102,
        expectedInfo: "authentication system vulnerabilities high-priority auth fixes 13 story points"
    },
    {
        type: "meeting",
        query: "What are the latest customer satisfaction metrics and major client wins?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944103,
        expectedInfo: "NPS 58 satisfaction 92% Tesla Adobe Shopify"
    },
    {
        type: "meeting",
        query: "What was the Q1 financial performance and Q2 budget allocation?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944104,
        expectedInfo: "revenue $12.5M 45% YoY $2M Q2 budget"
    },
    {
        type: "meeting",
        query: "What are the main technical improvements needed according to customer feedback?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944103,
        expectedInfo: "API documentation clarity mobile app stability"
    },
    {
        type: "meeting",
        query: "What are the SEO focus areas and content strategy?",
        expectedBehavior: "tool_call",
        relevantMeeting: 1731855944101,
        expectedInfo: "mobile productivity workflow automation team collaboration content clusters"
    },
    {
        type: "non_meeting",
        query: "Can you explain what machine learning is?",
        expectedBehavior: "direct_response",
        expectedInfo: "general explanation no meeting reference"
    },
    {
        type: "meeting",
        query: "What are the hiring plans across different departments?",
        expectedBehavior: "tool_call",
        relevantMeeting: [1731855944102, 1731855944103],
        expectedInfo: "two senior backend developers 4 support team technical writer"
    }
];

const MODELS = [
    {
        name: "llama3-groq-70b-8192-tool-use-preview",
        provider: "Groq",
        contextWindow: 8192
    },
    {
        name: "llama3-groq-8b-8192-tool-use-preview",
        provider: "Groq",
        contextWindow: 8192
    },
    {
        name: "llama-3.1-70b-versatile",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-3.1-8b-instant",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-3.2-1b-preview",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-3.2-3b-preview",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-3.2-11b-vision-preview",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-3.2-90b-vision-preview",
        provider: "Meta",
        contextWindow: 128000
    },
    {
        name: "llama-guard-3-8b",
        provider: "Meta",
        contextWindow: 8192
    },
    {
        name: "llama3-70b-8192",
        provider: "Meta",
        contextWindow: 8192
    },
    {
        name: "llama3-8b-8192",
        provider: "Meta",
        contextWindow: 8192
    }
];

class RAGEvaluator {
    constructor() {
        this.results = new Map();
        this.detailedResults = new Map();
    }

    async evaluateModel(model) {
        console.log(`\n=== Evaluating ${model.name} ===`);
        const modelMetrics = {
            totalQueries: 0,
            correctBehavior: 0,
            avgResponseTime: 0,
            toolCallAccuracy: 0,
            directResponseAccuracy: 0,
            informationAccuracy: 0,
            errors: 0,
            responseTimes: []
        };

        const detailedResults = [];

        for (const testCase of TEST_QUERIES) {
            try {
                console.log(`\nTesting: "${testCase.query}"`);
                const startTime = performance.now();
                
                const response = await queryMeetingsWithRAG(testCase.query, model.name);
                
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                // Basic metrics
                modelMetrics.responseTimes.push(responseTime);
                modelMetrics.totalQueries++;

                // Evaluate behavior
                const actualBehavior = response.isDirectResponse ? "direct_response" : "tool_call";
                const behaviorCorrect = actualBehavior === testCase.expectedBehavior;
                
                if (behaviorCorrect) {
                    modelMetrics.correctBehavior++;
                }

                // Evaluate information accuracy
                let infoAccuracy = 0;
                if (testCase.type === "meeting" && !response.isDirectResponse) {
                    infoAccuracy = this.evaluateInformationAccuracy(
                        response.aiResponse,
                        testCase.expectedInfo
                    );
                    modelMetrics.informationAccuracy += infoAccuracy;
                }

                // Store detailed result
                detailedResults.push({
                    query: testCase.query,
                    responseTime,
                    behaviorCorrect,
                    infoAccuracy,
                    response: response.aiResponse.substring(0, 100)
                });

                console.log(`Response Time: ${responseTime.toFixed(2)}ms`);
                console.log(`Behavior Correct: ${behaviorCorrect}`);
                console.log(`Information Accuracy: ${infoAccuracy.toFixed(2)}`);
                console.log(`Response: ${response.aiResponse.substring(0, 100)}...`);

            } catch (error) {
                console.error(`Error testing query: ${error.message}`);
                modelMetrics.errors++;
                detailedResults.push({
                    query: testCase.query,
                    error: error.message
                });
            }
        }

        // Calculate final metrics
        this.calculateFinalMetrics(modelMetrics);
        this.results.set(model.name, modelMetrics);
        this.detailedResults.set(model.name, detailedResults);
    }

    evaluateInformationAccuracy(response, expectedInfo) {
        const expectedKeywords = expectedInfo.toLowerCase().split(' ');
        const foundKeywords = expectedKeywords.filter(keyword => 
            response.toLowerCase().includes(keyword)
        );
        return foundKeywords.length / expectedKeywords.length;
    }

    calculateFinalMetrics(metrics) {
        metrics.avgResponseTime = this.average(metrics.responseTimes);
        metrics.toolCallAccuracy = metrics.toolCallAccuracy / 
            TEST_QUERIES.filter(q => q.expectedBehavior === "tool_call").length;
        metrics.directResponseAccuracy = metrics.directResponseAccuracy / 
            TEST_QUERIES.filter(q => q.expectedBehavior === "direct_response").length;
        metrics.informationAccuracy = metrics.informationAccuracy / 
            TEST_QUERIES.filter(q => q.type === "meeting").length;
    }

    average(array) {
        return array.reduce((a, b) => a + b, 0) / array.length;
    }

    printResults() {
        console.log('\n=== RAG System Evaluation Results ===\n');
        
        // Summary table
        const summaryRows = [];
        for (const [modelName, metrics] of this.results) {
            summaryRows.push({
                Model: modelName,
                'Avg Response Time (ms)': metrics.avgResponseTime.toFixed(2),
                'Behavior Accuracy': `${(metrics.correctBehavior / metrics.totalQueries * 100).toFixed(2)}%`,
                'Information Accuracy': `${(metrics.informationAccuracy * 100).toFixed(2)}%`,
                'Error Rate': `${(metrics.errors / metrics.totalQueries * 100).toFixed(2)}%`
            });
        }
        console.table(summaryRows);

        // Detailed results
        console.log('\n=== Detailed Results ===\n');
        for (const [modelName, details] of this.detailedResults) {
            console.log(`\nModel: ${modelName}`);
            console.table(details.map(d => ({
                Query: d.query,
                'Response Time': d.responseTime?.toFixed(2) || 'N/A',
                'Behavior Correct': d.behaviorCorrect || 'N/A',
                'Info Accuracy': d.infoAccuracy?.toFixed(2) || 'N/A',
                Error: d.error || 'None'
            })));
        }
    }

    async saveResults(outputPath = './evaluation-results') {
        // Create output directory if it doesn't exist
        await fs.mkdir(outputPath, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Prepare detailed results object
        const evaluationResults = {
            timestamp,
            summary: [],
            detailedResults: {},
            queryBreakdown: {},
            modelComparison: {
                responseTimes: {},
                accuracyMetrics: {},
                errorRates: {}
            },
            testQueries: TEST_QUERIES,
            dummyMeetings: DUMMY_MEETINGS
        };

        // Process results for each model
        for (const [modelName, metrics] of this.results) {
            // Summary statistics
            const summaryRow = {
                model: modelName,
                provider: MODELS.find(m => m.name === modelName)?.provider,
                contextWindow: MODELS.find(m => m.name === modelName)?.contextWindow,
                avgResponseTime: metrics.avgResponseTime,
                behaviorAccuracy: (metrics.correctBehavior / metrics.totalQueries * 100),
                informationAccuracy: (metrics.informationAccuracy * 100),
                errorRate: (metrics.errors / metrics.totalQueries * 100),
                toolCallAccuracy: (metrics.toolCallAccuracy * 100),
                directResponseAccuracy: (metrics.directResponseAccuracy * 100)
            };
            evaluationResults.summary.push(summaryRow);

            // Detailed query results
            evaluationResults.detailedResults[modelName] = this.detailedResults.get(modelName);

            // Model-specific metrics
            evaluationResults.modelComparison.responseTimes[modelName] = metrics.responseTimes;
            evaluationResults.modelComparison.accuracyMetrics[modelName] = {
                behavior: summaryRow.behaviorAccuracy,
                information: summaryRow.informationAccuracy,
                toolCall: summaryRow.toolCallAccuracy,
                directResponse: summaryRow.directResponseAccuracy
            };
            evaluationResults.modelComparison.errorRates[modelName] = summaryRow.errorRate;
        }

        // Query type breakdown
        evaluationResults.queryBreakdown = {
            totalQueries: TEST_QUERIES.length,
            meetingQueries: TEST_QUERIES.filter(q => q.type === "meeting").length,
            nonMeetingQueries: TEST_QUERIES.filter(q => q.type === "non_meeting").length,
            queryTypes: TEST_QUERIES.reduce((acc, q) => {
                acc[q.type] = (acc[q.type] || 0) + 1;
                return acc;
            }, {})
        };

        // Save results to files
        const files = {
            'full-results.json': evaluationResults,
            'summary.json': evaluationResults.summary,
            'model-comparison.json': evaluationResults.modelComparison,
            'query-breakdown.json': evaluationResults.queryBreakdown
        };

        for (const [filename, data] of Object.entries(files)) {
            const filePath = `${outputPath}/${timestamp}-${filename}`;
            await fs.writeFile(
                filePath,
                JSON.stringify(data, null, 2)
            );
            console.log(`Saved results to ${filePath}`);
        }

        // Generate Python visualization script
        const pythonScript = `
import json
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from datetime import datetime

# Load the results
with open('${outputPath}/${timestamp}-full-results.json', 'r') as f:
    results = json.load(f)

# Set style
plt.style.use('seaborn')
sns.set_palette("husl")

def create_visualizations():
    # 1. Response Times Box Plot
    plt.figure(figsize=(15, 6))
    response_times_data = []
    for model, times in results['modelComparison']['responseTimes'].items():
        response_times_data.extend([{'Model': model, 'Response Time (ms)': t} for t in times])
    
    df_times = pd.DataFrame(response_times_data)
    sns.boxplot(x='Model', y='Response Time (ms)', data=df_times)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig('${outputPath}/${timestamp}-response-times.png')
    plt.close()

    # 2. Accuracy Metrics Comparison
    plt.figure(figsize=(15, 6))
    accuracy_data = []
    for model, metrics in results['modelComparison']['accuracyMetrics'].items():
        for metric, value in metrics.items():
            accuracy_data.append({
                'Model': model,
                'Metric': metric,
                'Accuracy (%)': value
            })
    
    df_accuracy = pd.DataFrame(accuracy_data)
    sns.barplot(x='Model', y='Accuracy (%)', hue='Metric', data=df_accuracy)
    plt.xticks(rotation=45, ha='right')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.savefig('${outputPath}/${timestamp}-accuracy-metrics.png')
    plt.close()

    # 3. Error Rates Comparison
    plt.figure(figsize=(15, 6))
    error_rates = pd.DataFrame(list(results['modelComparison']['errorRates'].items()),
                             columns=['Model', 'Error Rate (%)'])
    sns.barplot(x='Model', y='Error Rate (%)', data=error_rates)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig('${outputPath}/${timestamp}-error-rates.png')
    plt.close()

    # 4. Query Type Distribution
    plt.figure(figsize=(8, 8))
    query_types = results['queryBreakdown']['queryTypes']
    plt.pie(query_types.values(), labels=query_types.keys(), autopct='%1.1f%%')
    plt.title('Distribution of Query Types')
    plt.savefig('${outputPath}/${timestamp}-query-distribution.png')
    plt.close()

if __name__ == '__main__':
    create_visualizations()
    print("Visualizations created successfully!")
`;

        // Save Python script
        await fs.writeFile(
            `${outputPath}/${timestamp}-generate-plots.py`,
            pythonScript
        );
        console.log(`Saved visualization script to ${outputPath}/${timestamp}-generate-plots.py`);
    }
}


async function main() {
    const evaluator = new RAGEvaluator();
    
    for (const model of MODELS) {
        await evaluator.evaluateModel(model);
    }
    
    evaluator.printResults();
    await evaluator.saveResults();
}

main().catch(console.error); 