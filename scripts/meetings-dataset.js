const MEETINGS_DATASET = [
    {
        topic: "Product Launch Planning",
        conversation: [
            "Team, let's finalize our Q1 product launch strategy for the new AI-powered analytics dashboard.",
            "Marketing has allocated $750,000 for the launch campaign, focusing on digital channels.",
            "Development confirms the core features will be ready by February 28th.",
            "We're planning a soft launch for premium customers on March 10th.",
            "Full public release is scheduled for March 25th, with press releases going out March 20th.",
            "Customer support training starts next week, covering all new features.",
            "Beta testing group includes 500 enterprise users.",
            "Pricing is set at $49/month for basic and $199/month for enterprise.",
            "SEO team predicts 40% increase in organic traffic post-launch.",
            "We've secured partnerships with 3 major tech review websites."
        ],
        relevantQueries: [
            "What's the marketing budget for the product launch?",
            "When is the public release date for the new dashboard?",
            "How much will the enterprise plan cost?",
            "What are the launch preparation steps?",
            "How many beta testers are involved?"
        ]
    },
    {
        topic: "Q4 Financial Review",
        conversation: [
            "Q4 2023 revenue reached $4.2M, exceeding targets by 28%.",
            "Operating costs were $2.8M, slightly under budget due to delayed hiring.",
            "Customer churn rate decreased to 2.1%, down from 3.5% in Q3.",
            "New enterprise contracts brought in $1.5M in annual recurring revenue.",
            "R&D spending increased by 15% to $800,000.",
            "Marketing ROI improved to 380% from last quarter's 310%.",
            "Cash reserves stand at $12M, sufficient for 18 months of operation.",
            "Employee headcount grew to 120, with 15 new hires in engineering.",
            "Cloud infrastructure costs reduced by 22% after optimization.",
            "Investor funding round of $20M expected to close in Q1 2024."
        ],
        relevantQueries: [
            "What was the Q4 2023 revenue?",
            "How much did R&D spending increase?",
            "What's the current customer churn rate?",
            "How many new employees were hired?",
            "What are the current cash reserves?"
        ]
    },
    {
        topic: "Engineering Sprint Planning",
        conversation: [
            "Sprint 34 will focus on performance optimization and bug fixes.",
            "High-priority tasks include reducing API latency by 40%.",
            "Database indexing improvements needed for search functionality.",
            "Mobile app crash rate must be addressed, currently at 2.5%.",
            "New feature development for custom dashboards starts in Sprint 35.",
            "Security team requests implementation of 2FA for all admin accounts.",
            "Load testing shows system handles 10,000 concurrent users successfully.",
            "Technical debt reduction allocated 20% of sprint capacity.",
            "Integration with third-party analytics tools scheduled for completion.",
            "Code review process updated to require two senior developer approvals."
        ],
        relevantQueries: [
            "What are the main goals for Sprint 34?",
            "What's the current mobile app crash rate?",
            "How many concurrent users can the system handle?",
            "When will custom dashboard development begin?",
            "What's the new code review requirement?"
        ]
    },
    {
        topic: "Customer Success Strategy",
        conversation: [
            "Average response time to customer tickets is now 4.2 hours.",
            "Implemented new onboarding workflow reducing setup time by 60%.",
            "Customer satisfaction score increased to 4.6/5 from 4.2/5.",
            "Automated email sequences showing 45% engagement rate.",
            "New knowledge base articles reduced common support tickets by 30%.",
            "Premium support package launched for enterprise clients at $5,000/month.",
            "Customer success team expanding to cover APAC region.",
            "Implementing AI chatbot for 24/7 basic support coverage.",
            "Quarterly business reviews now mandatory for accounts over $50k.",
            "New customer health scoring system identifies at-risk accounts early."
        ],
        relevantQueries: [
            "What's the current customer satisfaction score?",
            "How much does premium support cost?",
            "What's the average ticket response time?",
            "How effective is the new onboarding workflow?",
            "What's new in customer success coverage?"
        ]
    },
    {
        topic: "HR Strategic Planning",
        conversation: [
            "2024 hiring plan includes 50 new positions across departments.",
            "Remote work policy updated to allow 3 days WFH per week.",
            "New benefits package includes enhanced mental health coverage.",
            "Annual learning budget increased to $3,000 per employee.",
            "Implementing new performance review system quarterly instead of annually.",
            "Employee satisfaction survey showed 87% overall satisfaction.",
            "Diversity hiring goals set at 40% for technical roles.",
            "Parental leave extended to 20 weeks paid leave.",
            "Internal promotion rate reached 35% for senior positions.",
            "New employee referral bonus increased to $5,000."
        ],
        relevantQueries: [
            "What are the 2024 hiring plans?",
            "What's the new work from home policy?",
            "How much is the learning budget per employee?",
            "What's the employee satisfaction rate?",
            "How long is the parental leave?"
        ]
    },
    {
        topic: "Marketing Strategy Review",
        conversation: [
            "Content marketing driving 45% of all qualified leads.",
            "Social media engagement up 80% since implementing video strategy.",
            "Email newsletter subscription grew to 100,000 subscribers.",
            "PPC campaigns achieving 3.2% conversion rate, up from 2.4%.",
            "Influencer partnerships generated $300,000 in Q4 revenue.",
            "Blog traffic reached 500,000 monthly visitors.",
            "New brand guidelines rollout completed across all channels.",
            "Podcast launch reached Top 10 in Tech category.",
            "ABM campaigns showing 4x higher conversion rate.",
            "Marketing qualified leads increased by 60% year-over-year."
        ],
        relevantQueries: [
            "How effective is our content marketing?",
            "What's the email newsletter size?",
            "How much revenue came from influencer partnerships?",
            "What's our current PPC conversion rate?",
            "How successful is the podcast?"
        ]
    },
    {
        topic: "Infrastructure Security Update",
        conversation: [
            "Completed SOC 2 Type II certification audit successfully.",
            "Implemented zero-trust architecture across all systems.",
            "Security incidents reduced by 75% after implementing new firewall.",
            "Mandatory 2FA reduced unauthorized access attempts by 95%.",
            "Cloud security costs optimized, saving $10,000 monthly.",
            "New vulnerability scanning system identifies issues in real-time.",
            "Employee security training completion rate at 98%.",
            "Disaster recovery testing showed 99.9% data retention.",
            "Average incident response time reduced to 10 minutes.",
            "Implemented new encryption standards for all customer data."
        ],
        relevantQueries: [
            "What security certifications do we have?",
            "How effective is the new firewall?",
            "What's the incident response time?",
            "How much are we saving on security costs?",
            "What's the security training completion rate?"
        ]
    },
    {
        topic: "Product Roadmap Planning",
        conversation: [
            "Q1 focus on AI-powered features and mobile app redesign.",
            "Custom reporting engine scheduled for Q2 release.",
            "API v3 development starting in March with GraphQL support.",
            "User research shows high demand for collaboration features.",
            "Performance optimization phase planned for summer 2024.",
            "Integration marketplace launching with 50 initial partners.",
            "Mobile app getting offline mode support in Q3.",
            "Enterprise features include new admin dashboard and SSO.",
            "Data visualization library upgrade planned for Q4.",
            "Beta program expanding to include 1,000 users."
        ],
        relevantQueries: [
            "What are the main Q1 priorities?",
            "When is the custom reporting engine coming?",
            "What new mobile features are planned?",
            "How many integration partners are launching?",
            "What enterprise features are being added?"
        ]
    },
    {
        topic: "Sales Team Performance",
        conversation: [
            "Q4 sales reached $5.2M, 15% above target.",
            "Average deal size increased to $45,000.",
            "Sales cycle reduced to 45 days from 60 days.",
            "Team achieved 140% of annual quota.",
            "New sales automation tools improved efficiency by 30%.",
            "Enterprise segment grew by 50% year-over-year.",
            "Customer retention rate in accounts reached 94%.",
            "Sales team expanding to 25 reps by Q2.",
            "Commission structure updated to reward multi-year contracts.",
            "Partner channel contributed 25% of total revenue."
        ],
        relevantQueries: [
            "What was the Q4 sales performance?",
            "What's the average deal size?",
            "How long is the sales cycle?",
            "How much did enterprise segment grow?",
            "What's the partner channel contribution?"
        ]
    },
    {
        topic: "International Expansion Planning",
        conversation: [
            "EMEA office opening in London by Q2 2024.",
            "Initial APAC team of 10 people being hired in Singapore.",
            "Localization completed for 5 major European languages.",
            "International marketing budget set at $2M for 2024.",
            "Legal compliance verified for EU and APAC regions.",
            "Local payment providers integrated for 15 countries.",
            "Customer support coverage expanding to 24/7 globally.",
            "Regional pricing strategy approved by leadership.",
            "Data centers established in EU and Asia for compliance.",
            "International revenue target set at 40% of total revenue."
        ],
        relevantQueries: [
            "Where are the new international offices?",
            "What's the international marketing budget?",
            "How many languages are supported?",
            "What's the global support coverage plan?",
            "What's the international revenue target?"
        ]
    }
];

export default MEETINGS_DATASET; 