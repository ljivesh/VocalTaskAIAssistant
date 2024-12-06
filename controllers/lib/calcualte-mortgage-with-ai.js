import client from "../../clients/openai-client.js";
import {calculateMortgageFunctionDefinition, calculateMortgage} from '../../controllers/tools/calculate-mortgage.js';

export const calculateMortgageWithAI = async (query) => {
    try {
      // Make the API call to OpenAI
      const completion = await client.chat.completions.create({
        model: "llama-3.1-70b-versatile",
        messages: [
          { role: "system", content: "You are a helpful assistant skilled in understanding mortgage queries." },
          { role: "user", content: query },
        ],
        tools: [calculateMortgageFunctionDefinition],
        tool_choice: "auto"  // Let the model decide whether to call the function
      });
  
      // Get the last message from the completion
      const lastMessage = completion.choices[0].message;
  
      // Check if there's a tool call in the response
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        const toolCall = lastMessage.tool_calls[0];
        
        // Parse the function arguments
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(functionArgs);
        
        // Execute the mortgage calculation
        const mortgageResult = calculateMortgage(
          functionArgs.principal,
          functionArgs.annualInterestRate,
          functionArgs.loanTermYears
        );
  
        // Format the response
        const response = {
          success: true,
          calculation: mortgageResult,
          aiResponse: lastMessage.content,
          rawFunctionCall: toolCall
        };
  
        return response;
      } else {
        // Handle case where the AI didn't make a function call
        return {
          success: false,
          error: "No function call was made by the AI",
          aiResponse: lastMessage.content
        };
      }
  
    } catch (error) {
      // Handle different types of errors
      if (error.response) {
        // OpenAI API error
        return {
          success: false,
          error: `OpenAI API error: ${error.response.status} - ${error.response.data.error.message}`,
          details: error.response.data
        };
      } else if (error.message) {
        // General error with message
        return {
          success: false,
          error: `Error: ${error.message}`
        };
      } else {
        // Unknown error
        return {
          success: false,
          error: 'An unknown error occurred'
        };
      }
    }
  };
  
  // Example usage
//   const exampleQuery = "Can you calculate the mortgage payments for a $350,000 house with 5.5% interest rate over 30 years?";