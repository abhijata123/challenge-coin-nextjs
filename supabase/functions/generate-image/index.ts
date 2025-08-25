import { OpenAI } from "npm:openai@4.29.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Initialize OpenAI with the API key from environment variable
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse the request body
    const { prompt, side } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Enhance the prompt for better results
    const enhancedPrompt = `Create a professional military challenge coin ${side} side design with the following specifications:
1. Text Content: "${prompt}"
2. Design Requirements:
   - Circular shape with a diameter of 2 inches
   - Professional military-style layout
   - High contrast for text legibility
   - Clean, sans-serif font for maximum readability
   - Text size appropriate for physical coin production
3. Style Guidelines:
   - Center-aligned composition
   - Metallic finish with subtle gradients
   - Professional emblems and insignias where appropriate
   - Text properly spaced and arranged in a hierarchical manner
4. Quality Requirements:
   - Sharp, crisp text rendering
   - No blurry or distorted elements
   - Professional-grade detailing
   - Balanced negative space
5. Technical Specifications:
   - High resolution output
   - Clear distinction between text and background
   - Proper contrast ratios for text visibility
6. Text Placement:
   - Main text should be large and centered
   - Secondary text curved along the coin's edge
   - All text must be perfectly readable
   - No overlapping or distorted text`;

    // Generate the image using OpenAI's DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
      response_format: "b64_json"
    });

    // Return the generated image data
    return new Response(
      JSON.stringify({
        success: true,
        data: response.data[0].b64_json,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error generating image:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate image",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});