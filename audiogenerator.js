// Audio generation system for converting rhymes to speech
class AudioGenerator {
  constructor() {
    this.chrome = window.chrome
    this.supportedServices = ["browser", "elevenlabs", "google", "azure"]
    this.currentService = "browser" // Default to browser TTS
    this.audioCache = new Map()
    this.maxCacheSize = 50
  }

  // Main method to generate audio from text
  async generateAudio(text, style = "pop", options = {}) {
    try {
      const cacheKey = this.createCacheKey(text, style, options)

      // Check cache first
      if (this.audioCache.has(cacheKey)) {
        return this.audioCache.get(cacheKey)
      }

      let audioResult

      // Try different services based on availability
      switch (this.currentService) {
        case "elevenlabs":
          audioResult = await this.generateWithElevenLabs(text, style, options)
          break
        case "google":
          audioResult = await this.generateWithGoogle(text, style, options)
          break
        case "azure":
          audioResult = await this.generateWithAzure(text, style, options)
          break
        default:
          audioResult = await this.generateWithBrowser(text, style, options)
      }

      // Cache the result
      this.cacheAudio(cacheKey, audioResult)

      return audioResult
    } catch (error) {
      console.error("Audio generation failed:", error)
      // Fallback to browser TTS
      return await this.generateWithBrowser(text, style, options)
    }
  }

  // Browser-based Text-to-Speech (fallback)
  async generateWithBrowser(text, style, options = {}) {
    return new Promise((resolve, reject) => {
      if (!("speechSynthesis" in window)) {
        reject(new Error("Speech synthesis not supported"))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)

      // Configure voice based on style
      const voiceConfig = this.getVoiceConfig(style)
      utterance.rate = voiceConfig.rate
      utterance.pitch = voiceConfig.pitch
      utterance.volume = voiceConfig.volume

      // Try to find a suitable voice
      const voices = speechSynthesis.getVoices()
      const selectedVoice = this.selectVoice(voices, style, options.gender)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      // Create audio blob using MediaRecorder
      this.recordSpeech(utterance)
        .then((audioBlob) => {
          const audioUrl = URL.createObjectURL(audioBlob)
          resolve({
            success: true,
            audioUrl,
            audioBlob,
            service: "browser",
            voice: selectedVoice?.name || "default",
            duration: this.estimateDuration(text, utterance.rate),
          })
        })
        .catch((error) => {
          // If recording fails, just return the utterance for direct playback
          resolve({
            success: true,
            utterance,
            service: "browser",
            voice: selectedVoice?.name || "default",
            duration: this.estimateDuration(text, utterance.rate),
            playDirectly: true,
          })
        })
    })
  }

  // ElevenLabs API integration
  async generateWithElevenLabs(text, style, options = {}) {
    const apiKey = await this.getApiKey("elevenlabs")
    if (!apiKey) {
      throw new Error("ElevenLabs API key not configured")
    }

    const voiceId = this.getElevenLabsVoice(style, options.gender)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: this.getElevenLabsSettings(style),
      }),
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    return {
      success: true,
      audioUrl,
      audioBlob,
      service: "elevenlabs",
      voice: voiceId,
      duration: this.estimateDuration(text, 1.0),
    }
  }

  // Google Cloud Text-to-Speech integration
  async generateWithGoogle(text, style, options = {}) {
    const apiKey = await this.getApiKey("google")
    if (!apiKey) {
      throw new Error("Google Cloud API key not configured")
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`
    const voiceConfig = this.getGoogleVoiceConfig(style, options.gender)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: text },
        voice: voiceConfig.voice,
        audioConfig: voiceConfig.audioConfig,
      }),
    })

    if (!response.ok) {
      throw new Error(`Google TTS API error: ${response.status}`)
    }

    const result = await response.json()
    const audioBlob = this.base64ToBlob(result.audioContent, "audio/mp3")
    const audioUrl = URL.createObjectURL(audioBlob)

    return {
      success: true,
      audioUrl,
      audioBlob,
      service: "google",
      voice: voiceConfig.voice.name,
      duration: this.estimateDuration(text, voiceConfig.audioConfig.speakingRate || 1.0),
    }
  }

  // Azure Cognitive Services integration
  async generateWithAzure(text, style, options = {}) {
    const config = await this.getAzureConfig()
    if (!config.key || !config.region) {
      throw new Error("Azure TTS configuration not complete")
    }

    const url = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`
    const voiceConfig = this.getAzureVoiceConfig(style, options.gender)

    const ssml = this.createSSML(text, voiceConfig)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    })

    if (!response.ok) {
      throw new Error(`Azure TTS API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    return {
      success: true,
      audioUrl,
      audioBlob,
      service: "azure",
      voice: voiceConfig.voice,
      duration: this.estimateDuration(text, voiceConfig.rate),
    }
  }

  // Voice configuration for different styles
  getVoiceConfig(style) {
    const configs = {
      rap: { rate: 1.3, pitch: 1.1, volume: 0.9 },
      pop: { rate: 1.0, pitch: 1.0, volume: 0.8 },
      nursery: { rate: 0.8, pitch: 1.2, volume: 0.7 },
      ballad: { rate: 0.7, pitch: 0.9, volume: 0.8 },
      country: { rate: 0.9, pitch: 0.95, volume: 0.8 },
    }
    return configs[style] || configs.pop
  }

  // Select appropriate voice from available voices
  selectVoice(voices, style, preferredGender = "female") {
    // Filter voices by language (English)
    const englishVoices = voices.filter((voice) => voice.lang.startsWith("en-") && voice.name)

    if (englishVoices.length === 0) return null

    // Style-specific voice preferences
    const stylePreferences = {
      rap: ["urban", "young", "energetic"],
      pop: ["clear", "pleasant", "modern"],
      nursery: ["child", "gentle", "soft"],
      ballad: ["emotional", "deep", "expressive"],
      country: ["warm", "folksy", "natural"],
    }

    const preferences = stylePreferences[style] || []

    // Try to find voice matching preferences
    for (const preference of preferences) {
      const matchingVoice = englishVoices.find((voice) => voice.name.toLowerCase().includes(preference))
      if (matchingVoice) return matchingVoice
    }

    // Fallback to gender preference
    const genderVoices = englishVoices.filter((voice) => {
      const name = voice.name.toLowerCase()
      return preferredGender === "male"
        ? name.includes("male") || name.includes("man")
        : name.includes("female") || name.includes("woman")
    })

    return genderVoices[0] || englishVoices[0]
  }

  // Record speech synthesis to create audio blob
  async recordSpeech(utterance) {
    return new Promise((resolve, reject) => {
      // This is a simplified version - in practice, you'd need more complex recording
      const chunks = []
      const mediaRecorder = new MediaRecorder(new MediaStream())

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" })
        resolve(audioBlob)
      }

      utterance.onend = () => {
        mediaRecorder.stop()
      }

      utterance.onerror = (error) => {
        reject(error)
      }

      // Start recording and speaking
      mediaRecorder.start()
      speechSynthesis.speak(utterance)
    })
  }

  // Get ElevenLabs voice ID based on style
  getElevenLabsVoice(style, gender = "female") {
    const voices = {
      rap: {
        male: "pNInz6obpgDQGcFmaJgB", // Adam
        female: "21m00Tcm4TlvDq8ikWAM", // Rachel
      },
      pop: {
        male: "VR6AewLTigWG4xSOukaG", // Josh
        female: "EXAVITQu4vr4xnSDxMaL", // Bella
      },
      nursery: {
        male: "CYw3kZ02Hs0563khs1Fj", // Dave
        female: "XB0fDUnXU5powFXDhCwa", // Charlotte
      },
      ballad: {
        male: "onwK4e9ZLuTAKqWW03F9", // Daniel
        female: "oWAxZDx7w5VEj9dCyTzz", // Grace
      },
      country: {
        male: "bVMeCyTHy58xNoL34h3p", // Jeremy
        female: "XrExE9yKIg1WjnnlVkGX", // Matilda
      },
    }

    return voices[style]?.[gender] || voices.pop[gender]
  }

  // Get ElevenLabs voice settings
  getElevenLabsSettings(style) {
    const settings = {
      rap: { stability: 0.75, similarity_boost: 0.8, style: 0.5 },
      pop: { stability: 0.5, similarity_boost: 0.75, style: 0.0 },
      nursery: { stability: 0.9, similarity_boost: 0.3, style: 0.0 },
      ballad: { stability: 0.3, similarity_boost: 0.9, style: 0.8 },
      country: { stability: 0.6, similarity_boost: 0.7, style: 0.3 },
    }
    return settings[style] || settings.pop
  }

  // Utility methods
  createCacheKey(text, style, options) {
    return `${style}-${options.gender || "default"}-${this.hashString(text)}`
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  cacheAudio(key, audioResult) {
    if (this.audioCache.size >= this.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value
      this.audioCache.delete(firstKey)
    }
    this.audioCache.set(key, audioResult)
  }

  estimateDuration(text, rate = 1.0) {
    // Rough estimation: average speaking rate is ~150 words per minute
    const words = text.split(/\s+/).length
    const baseMinutes = words / 150
    return (baseMinutes * 60) / rate // Return seconds
  }

  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  createSSML(text, voiceConfig) {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceConfig.voice}">
        <prosody rate="${voiceConfig.rate}" pitch="${voiceConfig.pitch}">
          ${text}
        </prosody>
      </voice>
    </speak>`
  }

  // API key management
  async getApiKey(service) {
    return new Promise((resolve) => {
      this.chrome.storage.sync.get([`${service}ApiKey`], (result) => {
        resolve(result[`${service}ApiKey`] || null)
      })
    })
  }

  async getAzureConfig() {
    return new Promise((resolve) => {
      this.chrome.storage.sync.get(["azureKey", "azureRegion"], (result) => {
        resolve({
          key: result.azureKey || null,
          region: result.azureRegion || null,
        })
      })
    })
  }

  // Service management
  setService(service) {
    if (this.supportedServices.includes(service)) {
      this.currentService = service
      this.chrome.storage.sync.set({ audioService: service })
    }
  }

  async getCurrentService() {
    return new Promise((resolve) => {
      this.chrome.storage.sync.get(["audioService"], (result) => {
        this.currentService = result.audioService || "browser"
        resolve(this.currentService)
      })
    })
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = AudioGenerator
} else if (typeof window !== "undefined") {
  window.AudioGenerator = AudioGenerator
}