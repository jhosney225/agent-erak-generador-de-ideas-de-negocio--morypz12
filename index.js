
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface BusinessIdea {
  title: string;
  description: string;
  marketPotential: string;
  initialInvestment: string;
  riskLevel: string;
  validationScore: number;
}

interface ValidationResult {
  isValid: boolean;
  score: number;
  feedback: string;
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Utility function to prompt user
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Generate business ideas using Claude API with streaming
async function generateBusinessIdeas(
  industry: string,
  budget: string
): Promise<string> {
  console.log(
    "\n🚀 Generating business ideas for",
    industry,
    "with budget:",
    budget
  );
  console.log("━".repeat(60));

  let fullResponse = "";

  const stream = client.messages.stream({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Generate 3 innovative business ideas for the ${industry} industry with an initial budget of ${budget}. 
        
For each idea, provide:
1. Title
2. Description (2-3 sentences)
3. Market potential (low/medium/high)
4. Initial investment estimate
5. Risk level (low/medium/high)

Format each idea clearly with markers like "IDEA 1:", "IDEA 2:", etc.`,
      },
    ],
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      process.stdout.write(chunk.delta.text);
      fullResponse += chunk.delta.text;
    }
  }

  console.log("\n");
  return fullResponse;
}

// Validate a business idea using Claude API
async function validateBusinessIdea(
  ideaDescription: string
): Promise<ValidationResult> {
  console.log("\n✓ Validating business idea...");

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Analyze and validate this business idea:
        
"${ideaDescription}"

Provide:
1. Is it a viable idea? (yes/no)
2. Validation score (0-100)
3. Key strengths and potential weaknesses (2-3 sentences)
4. Specific recommendations for validation

Format as:
VIABLE: [yes/no]
SCORE: [number]
FEEDBACK: [your analysis]`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse the response
  const viableMatch = responseText.match(/VIABLE:\s*(yes|no)/i);
  const scoreMatch = responseText.match(/SCORE:\s*(\d+)/);
  const feedbackMatch = responseText.match(/FEEDBACK:\s*(.+?)(?=\n|$)/s);

  const isValid =
    viableMatch && viableMatch[1].toLowerCase() === "yes" ? true : false;
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  const feedback = feedbackMatch
    ? feedbackMatch[1].trim()
    : "Unable to parse feedback";

  return {
    isValid,
    score,
    feedback,
  };
}

// Parse generated ideas from Claude response
function parseIdeas(responseText: string): BusinessIdea[] {
  const ideas: BusinessIdea[] = [];
  const ideaBlocks = responseText.split(/IDEA\s+\d+:/i);

  for (let i = 1; i < ideaBlocks.length; i++) {
    const block = ideaBlocks[i];
    const lines = block.split("\n").filter((line) => line.trim());

    if (lines.length > 0) {
      const idea: BusinessIdea = {
        title: lines[0]?.trim() || `Business Idea ${i}`,
        description: lines[1]?.trim() || "No description",
        marketPotential: extractValue(block, "market potential"),
        initialInvestment: extractValue(block, "investment|budget"),
        riskLevel: extractValue(block, "risk"),
        validationScore: 0,
      };

      ideas.push(idea);
    }
  }

  return ideas;
}

// Helper function to extract values from text
function extractValue(text: string, pattern: string): string {
  const regex = new RegExp(pattern + ".*?:\\s*([^\\n]+)", "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "Not specified";
}

// Main interactive flow
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         BUSINESS IDEA GENERATOR WITH VALIDATION             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // Get user inputs
    const industry = await prompt(
      "📊 Enter industry/field (e.g., tech, agriculture, retail): "
    );
    const budget = await prompt(
      "💰 Enter initial budget available (e.g., $10,000, $100,000): "
    );

    if (!industry || !budget) {
      console.log("