// Function implementation
export function calculateMortgage(principal, annualInterestRate, loanTermYears) {
    // Convert annual interest rate to monthly
    const monthlyInterestRate = (annualInterestRate / 100) / 12;
    // Convert years to months
    const totalPayments = loanTermYears * 12;
    
    // Calculate monthly payment using the mortgage formula
    const monthlyPayment = principal * 
      (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, totalPayments)) /
      (Math.pow(1 + monthlyInterestRate, totalPayments) - 1);
      
    // Calculate total amount to be paid
    const totalAmount = monthlyPayment * totalPayments;
    // Calculate total interest
    const totalInterest = totalAmount - principal;
    
    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      totalInterest: totalInterest.toFixed(2)
    };
  }
  
  // OpenAI function definition
 export const calculateMortgageFunctionDefinition = {
    type: "function",  // Added this required field
    function: {        // Wrapped in function property
      name: "calculateMortgage",
      description: "Calculate mortgage payments and total costs based on loan details",
      parameters: {
        type: "object",
        properties: {
          principal: {
            type: "number",
            description: "The initial loan amount in dollars"
          },
          annualInterestRate: {
            type: "number",
            description: "Annual interest rate as a percentage (e.g., 5.5 for 5.5%)"
          },
          loanTermYears: {
            type: "number",
            description: "Length of the loan in years"
          }
        },
        required: ["principal", "annualInterestRate", "loanTermYears"]
      }
    }
  };
