// Gemini API integration for text transformation
class GeminiAPI {
  constructor() {
    this.baseURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    this.apiKey = null
    this.maxRetries = 3
    this.retryDelay = 1000
    this.chrome = window.chrome // Declare the chrome variable
  }

  // Set API key (will be stored in Chrome storage)
  setApiKey(apiKey) {
    this.apiKey = apiKey
    // Store in Chrome storage for persistence
    this.chrome.storage.sync.set({ geminiApiKey: apiKey })
  }

  // Get API key from Chrome storage
  async getApiKey() {
    if (this.apiKey) return this.apiKey

    return new Promise((resolve) => {
      this.chrome.storage.sync.get(["geminiApiKey"], (result) => {
        this.apiKey = result.geminiApiKey || null
        resolve(this.apiKey)
      })
    })
  }

  // Main method to transform content into rhymes
  async transformToRhyme(content, options = {}) {
    const { style = "pop", length = "medium", tone = "fun", title = "", customInstructions = "" } = options

    try {
      const apiKey = await this.getApiKey()
      if (!apiKey) {
        throw new Error("Gemini API key not configured")
      }

      const prompt = this.createPrompt(content, style, length, tone, title, customInstructions)
      const response = await this.callGeminiAPI(prompt, apiKey)

      return {
        success: true,
        rhyme: this.cleanResponse(response),
        metadata: {
          style,
          length,
          tone,
          wordCount: this.countWords(response),
          generatedAt: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error("Gemini API error:", error)
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackRhyme(content, style),
      }
    }
  }

  // Create sophisticated prompts for different styles
  createPrompt(content, style, length, tone, title, customInstructions) {
    const lengthSpecs = {
      short: { lines: "4-6 lines", verses: "1 verse", duration: "brief" },
      medium: { lines: "8-12 lines", verses: "2-3 verses", duration: "moderate" },
      long: { lines: "16-24 lines", verses: "3-4 verses", duration: "extended" },
    }

    const styleGuides = {
      rap: {
        rhythm: "strong 4/4 beat with emphasis on beats 1 and 3",
        rhymeScheme: "AABB or ABAB with internal rhymes",
        language: "modern, rhythmic, with wordplay and flow",
        structure: "verses with punch lines",
        examples: "like Drake, Kendrick, or Eminem",
      },
      pop: {
        rhythm: "catchy, upbeat tempo",
        rhymeScheme: "ABAB or AABA with memorable hooks",
        language: "accessible, melodic, radio-friendly",
        structure: "verse-chorus structure with hooks",
        examples: "like Taylor Swift, Ed Sheeran, or Dua Lipa",
      },
      nursery: {
        rhythm: "simple, bouncy rhythm",
        rhymeScheme: "AABB perfect rhymes",
        language: "simple words, playful, innocent",
        structure: "repetitive patterns, easy to remember",
        examples: "like Twinkle Twinkle Little Star or Humpty Dumpty",
      },
      ballad: {
        rhythm: "slow, emotional tempo",
        rhymeScheme: "ABAB or ABCB with flowing verses",
        language: "emotional, storytelling, descriptive",
        structure: "narrative verses building emotion",
        examples: "like Adele, Sam Smith, or classic folk ballads",
      },
      country: {
        rhythm: "steady, storytelling rhythm",
        rhymeScheme: "AABA or ABAB with narrative flow",
        language: "folksy, down-to-earth, relatable",
        structure: "story-driven verses with choruses",
        examples: "like Johnny Cash, Dolly Parton, or Keith Urban",
      },
    }

    const toneAdjectives = {
      fun: "playful, energetic, and entertaining",
      educational: "informative, clear, and engaging",
      humorous: "funny, witty, and clever",
      dramatic: "intense, emotional, and powerful",
      chill: "relaxed, smooth, and laid-back",
    }

    const spec = lengthSpecs[length]
    const guide = styleGuides[style]
    const toneDesc = toneAdjectives[tone]

    const basePrompt = `Transform the following content into a ${toneDesc} ${style} song/rhyme.

CONTENT TO TRANSFORM:
Title: ${title}
Content: ${content.substring(0, 2500)}

STYLE REQUIREMENTS:
- Genre: ${style} ${guide.examples}
- Rhythm: ${guide.rhythm}
- Rhyme scheme: ${guide.rhymeScheme}
- Language style: ${guide.language}
- Structure: ${guide.structure}
- Length: ${spec.lines} (${spec.verses})
- Tone: ${toneDesc}

CREATIVE GUIDELINES:
1. Capture the main ideas and key information from the content
2. Make it memorable and catchy with strong rhythm
3. Use creative wordplay and metaphors appropriate to the style
4. Ensure smooth flow and natural pronunciation
5. Include hooks or memorable phrases that stick
6. Make it ${toneDesc} while staying true to the content
${customInstructions ? `7. Additional instructions: ${customInstructions}` : ""}

IMPORTANT: Return ONLY the song/rhyme lyrics with clear verse breaks. No explanations, titles, or additional text.`

    return basePrompt
  }

  // Call the Gemini API with retry logic
  async callGeminiAPI(prompt, apiKey, attempt = 1) {
    try {
      const response = await fetch(`${this.baseURL}?key=${apiKey}`, {
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
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || "Unknown error"}`)
      }

      const result = await response.json()

      if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
        throw new Error("Invalid response format from Gemini API")
      }

      return result.candidates[0].content.parts[0].text
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(`Retry attempt ${attempt + 1} after error:`, error.message)
        await this.delay(this.retryDelay * attempt)
        return this.callGeminiAPI(prompt, apiKey, attempt + 1)
      }
      throw error
    }
  }

  // Clean and format the API response
  cleanResponse(response) {
    if (!response) return ""

    // Remove common unwanted prefixes/suffixes
    let cleaned = response
      .replace(/^(Here's|Here is).*?:\s*/i, "")
      .replace(/^(Song|Rhyme|Lyrics):\s*/i, "")
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove markdown bold
      .replace(/\*(.*?)\*/g, "$1") // Remove markdown italic
      .trim()

    // Ensure proper line breaks for verses
    cleaned = cleaned.replace(/\n\s*\n/g, "\n\n")

    return cleaned
  }

  // Generate a simple fallback rhyme if API fails
  generateFallbackRhyme(content, style) {
    const templates = {
      rap: `Yo, check this out, let me break it down,
${this.extractKeyPoints(content, 2).join(",\n")}
That's the story, that's the sound!`,

      pop: `Here's a story that you need to know,
${this.extractKeyPoints(content, 2).join(",\n")}
Now you've heard it, now you know!`,

      nursery: `Listen close to what I say,
${this.extractKeyPoints(content, 2).join(",\n")}
That's the story for today!`,

      ballad: `Let me tell you of a tale,
${this.extractKeyPoints(content, 2).join(",\n")}
This story will never fail.`,

      country: `Gather 'round, I'll tell you true,
${this.extractKeyPoints(content, 2).join(",\n")}
That's the story, through and through.`,
    }

    return templates[style] || templates.pop
  }

  // Extract key points from content for fallback
  extractKeyPoints(content, maxPoints = 3) {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10)
    return sentences.slice(0, maxPoints).map((s) => s.trim())
  }

  // Utility methods
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  countWords(text) {
    return text ? text.split(/\s+/).filter((word) => word.length > 0).length : 0
  }

  // Validate API key format
  isValidApiKey(apiKey) {
    return apiKey && typeof apiKey === "string" && apiKey.length > 20
  }
}

// Export for use in background script
if (typeof module !== "undefined" && module.exports) {
  module.exports = GeminiAPI
} else if (typeof window !== "undefined") {
  window.GeminiAPI = GeminiAPI
}
