const express = require("express")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(
  cors({
    origin: ["chrome-extension://*", "http://localhost:*"], // Allow Chrome extensions
    credentials: true,
  }),
)
app.use(express.json())

// Rate limiting - 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many requests, please try again later." },
})

app.use("/api/", limiter)

// Gemini API proxy endpoint
app.post("/api/generate-rhyme", async (req, res) => {
  try {
    const { content, style, tone, length } = req.body

    if (!content) {
      return res.status(400).json({ error: "Content is required" })
    }

    // Your Gemini API key is safely stored in environment variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "API key not configured" })
    }

    const prompt = createRhymePrompt(content, style, tone, length)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      throw new Error("No content generated")
    }

    res.json({
      success: true,
      rhyme: generatedText.trim(),
      usage: {
        requestsRemaining: limiter.resetTime - Date.now(),
      },
    })
  } catch (error) {
    console.error("Error generating rhyme:", error)
    res.status(500).json({
      error: "Failed to generate rhyme",
      details: error.message,
    })
  }
})

function createRhymePrompt(content, style = "playful", tone = "fun", length = "short") {
  const stylePrompts = {
    playful: "Create a playful, bouncy rhyme",
    educational: "Create an educational rhyme that helps remember key information",
    humorous: "Create a funny, witty rhyme",
    dramatic: "Create a dramatic, theatrical rhyme",
    nursery: "Create a simple nursery rhyme style",
    rap: "Create a rap-style rhyme with good flow",
    pop: "Create a pop song style rhyme with catchy hooks",
  }

  const lengthGuides = {
    short: "Keep it to 4-8 lines",
    medium: "Make it 8-16 lines",
    long: "Create 16-24 lines",
  }

  return `${stylePrompts[style] || stylePrompts.playful} based on this content. ${lengthGuides[length] || lengthGuides.short}. Make it ${tone} in tone and easy to remember. Focus on the main points and make it flow well.

Content to transform:
${content}

Requirements:
- Make it rhyme well and flow naturally
- Capture the key information from the content
- Keep the ${tone} tone throughout
- Make it memorable and engaging`
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`RhymeTime proxy server running on port ${PORT}`)
})
