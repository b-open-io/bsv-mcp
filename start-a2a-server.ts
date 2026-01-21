import { A2AServer } from "./lib/a2a/server/server";
import { InMemoryTaskStore, type TaskAndHistory } from "./lib/a2a/server/store";
import type { TaskContext, TaskHandler } from "./lib/a2a/server/handler";
import type * as schema from "./lib/a2a/schema";
import { A2AError } from "./lib/a2a/server/error";

// Define price for our hello world service (in satoshis)
const HELLO_WORLD_PRICE = 100; // 100 satoshis

// Define the agent card with payment info according to A2B spec
const agentCard: schema.AgentCard = {
  name: "Hello World Agent",
  description: "A simple agent that says hello and demonstrates A2B payments",
  version: "1.0.0",
  url: "http://localhost:41241/", 
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false
  },
  skills: [
    {
      id: "greeting",
      name: "Hello World Greeting",
      description: "A simple greeting that demonstrates A2B payments",
      tags: ["greeting", "hello", "demo"]
    }
  ],
  // Using x-payment-config field as described in A2B spec
  "x-payment-config": [
    {
      id: "pay-per-call",
      description: "Basic hello world greeting",
      currency: "BSV",
      amount: 0.000001, // 100 satoshis in BSV units
      address: "1ExampleAddress", // This would be your actual BSV address
      skills: ["greeting"],
      interval: null // One-time payment
    }
  ]
} as schema.AgentCard & { "x-payment-config": unknown };

// Custom error for payment requirements
const PaymentError = {
  code: 402,
  message: "Payment Required: Transaction not found or insufficient funds.",
  data: {
    required: {
      currency: "BSV",
      amount: 0.000001,
      planId: "pay-per-call"
    }
  }
};

// Define our agent's business logic as a TaskHandler
const helloWorldAgent: TaskHandler = async function* (
  context: TaskContext
): AsyncGenerator<schema.TaskStatus | schema.Artifact> {
  console.log(`Handling task: ${context.task.id}`);
  
  // Parse the payment information from the message
  const paymentInfo = extractPaymentInfo(context.userMessage);
  
  // If there's no payment info or it's invalid, request payment
  if (!paymentInfo) {
    console.log("No payment information provided");
    
    // Return 402 Payment Required by throwing a custom error
    throw new A2AError(
      PaymentError.code,
      PaymentError.message,
      PaymentError.data
    );
  }
  
  // In a real implementation, verify the payment txid on-chain
  // Here we simulate payment verification
  const isPaymentValid = verifyPayment(paymentInfo);
  
  if (!isPaymentValid) {
    console.log("Invalid payment provided:", paymentInfo);
    
    // Return 402 Payment Required for invalid payment
    throw new A2AError(
      PaymentError.code,
      "Payment verification failed: transaction not found or insufficient.",
      PaymentError.data
    );
  }
  
  // Payment verified, continue with processing
  console.log("Payment verified:", paymentInfo);
  
  // When payment is received, process the request
  yield {
    state: "working",
    message: {
      role: "agent", 
      parts: [{ 
        type: "text", 
        text: "Payment received! Processing your request..." 
      }]
    }
  };

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if task was cancelled
  if (context.isCancelled()) {
    console.log("Task cancelled!");
    yield { 
      state: "canceled",
      message: {
        role: "agent",
        parts: [{ type: "text", text: "Task was cancelled." }]
      }
    };
    return;
  }

  // Extract user message to personalize the response
  const userName = extractUserName(context.userMessage);

  // Create a text artifact with the response
  yield {
    name: "greeting.txt",
    description: "A friendly greeting",
    mimeType: "text/plain",
    parts: [{ 
      type: "text", 
      text: `Hello ${userName || "there"}! Thank you for your payment of ${paymentInfo.amount} ${paymentInfo.currency}.` 
    }]
  } as schema.Artifact;

  // Send final completion message
  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [{ 
        type: "text", 
        text: `Hello ${userName || "there"}! Thanks for trying out the A2B payment system.`
      }]
    }
  };
};

/**
 * Extract payment information from the user message
 * Following the A2B spec for payment DataPart format
 */
function extractPaymentInfo(message: schema.Message): null | {
  planId: string;
  txid: string;
  vout: number;
  amount: number;
  currency: string;
} {
  if (!message || !Array.isArray(message.parts)) {
    return null;
  }

  // Find data parts in the message
  const dataPart = message.parts.find(part => 
    part && 
    typeof part === 'object' && 
    'type' in part && 
    part.type === "data" &&
    'data' in part
  ) as schema.DataPart | undefined;
  
  if (!dataPart || !dataPart.data) {
    return null;
  }

  const data = dataPart.data;
  
  // Check if this is a payment data part with required fields
  if (
    !data.planId || 
    !data.txid || 
    typeof data.vout !== 'number' || 
    !data.amount || 
    !data.currency
  ) {
    return null;
  }

  return {
    planId: data.planId as string,
    txid: data.txid as string,
    vout: data.vout as number,
    amount: data.amount as number,
    currency: data.currency as string
  };
}

/**
 * Simulate payment verification
 * In a real implementation, this would verify the transaction on the blockchain
 */
function verifyPayment(paymentInfo: {
  planId: string;
  txid: string;
  vout: number;
  amount: number;
  currency: string;
}): boolean {
  console.log("Verifying payment:", paymentInfo);
  
  // Check if payment matches expected plan
  if (paymentInfo.planId !== "pay-per-call") {
    console.log("Unknown plan ID:", paymentInfo.planId);
    return false;
  }
  
  // Check if payment amount is sufficient
  // Convert BSV amount to satoshis for comparison (1 BSV = 100,000,000 satoshis)
  const amountInSatoshis = paymentInfo.currency === "BSV" 
    ? Math.round(paymentInfo.amount * 100000000)
    : paymentInfo.amount;
    
  if (amountInSatoshis < HELLO_WORLD_PRICE) {
    console.log("Insufficient payment:", amountInSatoshis, "satoshis (required:", HELLO_WORLD_PRICE, ")");
    return false;
  }
  
  // In a real implementation, we would:
  // 1. Fetch the transaction details from the blockchain
  // 2. Verify the transaction exists and is confirmed
  // 3. Check that the output at vout pays to our address
  // 4. Verify the amount matches or exceeds the plan price
  
  // For this demo, we'll simulate a 90% success rate
  // In a real implementation, this would be deterministic based on tx verification
  return Math.random() < 0.9;
}

/**
 * Simple function to extract a name from the user message if present
 */
function extractUserName(message: schema.Message): string | null {
  if (!message || !Array.isArray(message.parts) || !message.parts.length) {
    return null;
  }

  // Look for patterns like "My name is [name]" or "I am [name]"
  const textParts = message.parts.filter(part => 
    part && 
    typeof part === 'object' && 
    'type' in part && 
    part.type === "text" && 
    'text' in part
  );
    
  if (!textParts.length) {
    return null;
  }
  
  const text = textParts
    .map(part => {
      const typedPart = part as { type: string, text: string };
      return typedPart.text || '';
    })
    .join(" ");
  
  const nameMatch = text.match(/(?:my name is|i am|i'm) (\w+)/i);
  if (!nameMatch || !nameMatch[1]) return null;
  return nameMatch[1];
}

// Create and start the server
async function startServer() {
  try {
    // Create a task store
    const taskStore = new InMemoryTaskStore();
    
    // Set up the server with our agent logic
    const server = new A2AServer(helloWorldAgent, { 
      taskStore, 
      card: agentCard,
      // Listen on all interfaces
    //   hostname: "0.0.0.0",
    //   // Enable development mode for helpful logging
    //   development: true
    });
    
    // Start the server
    server.start(41241, "0.0.0.0");
    
    console.log("A2A 'Hello World' Server with A2B payments started on port 41241");
    console.log("Agent requires payment of", HELLO_WORLD_PRICE, "satoshis");
    console.log("To test, include a DataPart with payment information in your request");
    console.log("Example payment data:");
    console.log(JSON.stringify({
      planId: "pay-per-call",
      txid: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      vout: 0,
      amount: 0.000001, // 100 satoshis in BSV
      currency: "BSV"
    }, null, 2));
  } catch (error) {
    console.error("Failed to start A2A server:", error);
  }
}

// Start the server
startServer().catch(console.error); 