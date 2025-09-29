const PROXY_SERVER_URL = "https://your-server-domain.com" // Replace with your deployed server URL
// For local development, use: "http://localhost:3000"

const chrome = window.chrome

// Initialize when extension loads
chrome.runtime.onInstalled.addListener(() => {
  console.log("RhymeTime extension installed")
})

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    // Forward the content extraction request
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "extractContent" }, (response) => {
          sendResponse(response)
        })
      } else {
        sendResponse({ success: false, error: "No active tab found" })
      }
    })
    return true
  }

  if (request.action === "generateRhyme") {
    handleRhymeGeneration(request.data)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === "checkApiKey") {
    sendResponse({
      success: true,
      data: {
        configured: true,
        valid: true,
        provider: "proxy",
      },
    })
    return true
  }
})

async function handleRhymeGeneration(data) {
  try {
    const { content, style, length, tone, title, customInstructions } = data

    // Validate input
    if (!content || content.trim().length < 10) {
      throw new Error("Content is too short to transform")
    }

    // Call proxy server instead of Gemini directly
    const response = await fetch(`${PROXY_SERVER_URL}/api/generate-rhyme`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        style,
        tone,
        length,
        title,
        customInstructions,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || "Failed to generate rhyme")
    }

    return {
      rhyme: result.rhyme,
      metadata: {
        style,
        length,
        tone,
        wordCount: countWords(result.rhyme),
        generatedAt: new Date().toISOString(),
      },
      audioUrl: await generateAudio(result.rhyme, style),
    }
  } catch (error) {
    console.error("Error generating rhyme:", error)

    return {
      rhyme: generateFallbackRhyme(data.content, data.style),
      metadata: {
        style: data.style,
        length: data.length,
        tone: data.tone,
        wordCount: 20,
        generatedAt: new Date().toISOString(),
        fallback: true,
      },
      audioUrl: null,
    }
  }
}

function generateFallbackRhyme(content, style) {
  const keyPoints = content
    .split(/[.!?]+/)
    .slice(0, 2)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const fallbacks = {
    rap: `Yo, here's the story, let me break it down,\n${keyPoints.join(",\n")}\nThat's the info, straight from the ground!`,
    pop: `🎵 Here's what happened, in a catchy way,\n${keyPoints.join(",\n")}\nThat's the story of today! 🎵`,
    nursery: `Once upon a time, here's what we learned,\n${keyPoints.join(",\n")}\nAnd that's how the story turned!`,
    default: `Here's the story in a fun way:\n${keyPoints.join(",\n")}\nThat's what happened today!`,
  }

  return fallbacks[style] || fallbacks.default
}

function countWords(text) {
  return text ? text.split(/\s+/).filter((word) => word.length > 0).length : 0
}

// Enhanced audio generation placeholder
async function generateAudio(text, style) {
  // This would integrate with a text-to-speech service
  // For now, return null - you could integrate with:
  // - Google Cloud Text-to-Speech
  // - Amazon Polly
  // - Azure Cognitive Services Speech
  // - ElevenLabs API

  try {
    // Placeholder for future audio generation
    console.log(`Would generate ${style} audio for: ${text.substring(0, 50)}...`)
    return null
  } catch (error) {
    console.error("Audio generation error:", error)
    return null
  }
}