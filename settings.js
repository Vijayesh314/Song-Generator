// Settings management for RhymeTime extension
class RhymeTimeSettings {
  constructor() {
    this.chrome = window.chrome
    this.defaultSettings = {
      geminiApiKey: "",

      // Audio Settings
      audioService: "browser",
      elevenLabsApiKey: "",
      googleApiKey: "",
      azureApiKey: "",
      azureRegion: "",
      voiceGender: "female",
      autoPlay: false,

      // Content Extraction
      contentLength: 2000,
      extractImages: false,
      skipNavigation: true,

      // Rhyme Generation
      creativityLevel: "balanced",
      rhymeScheme: "auto",
      rhymeStyle: "pop",
      rhymeLength: "medium",
      tone: "educational",
      customInstructions: "",
      includeTitle: true,

      // User Interface
      theme: "default",
      showWordCount: false,
      showGenerationTime: false,

      // History & Storage
      saveHistory: true,
      maxHistory: 25,
    }

    this.currentSettings = { ...this.defaultSettings }
    this.init()
  }

  async init() {
    try {
      await this.loadSettings()
      this.populateForm()
      this.bindEvents()
      this.applyTheme()
      console.log("Settings page initialized")
    } catch (error) {
      console.error("Failed to initialize settings:", error)
      this.showStatus("Failed to load settings", "error")
    }
  }

  bindEvents() {
    // Back button
    document.getElementById("back-btn")?.addEventListener("click", () => {
      window.close()
    })

    document.getElementById("test-api-key")?.addEventListener("click", () => {
      this.testGeminiApiKey()
    })

    // Audio service change
    document.getElementById("audio-service")?.addEventListener("change", (e) => {
      this.toggleAudioServiceSettings(e.target.value)
    })

    // Theme change
    document.getElementById("theme")?.addEventListener("change", (e) => {
      this.applyTheme(e.target.value)
    })

    // Save settings
    document.getElementById("save-settings")?.addEventListener("click", () => {
      this.saveSettings()
    })

    // Reset settings
    document.getElementById("reset-settings")?.addEventListener("click", () => {
      this.resetSettings()
    })

    // History management
    document.getElementById("clear-history")?.addEventListener("click", () => {
      this.clearHistory()
    })

    document.getElementById("export-settings")?.addEventListener("click", () => {
      this.exportSettings()
    })

    document.getElementById("import-settings")?.addEventListener("click", () => {
      this.importSettings()
    })

    // Auto-save on input changes (debounced)
    this.setupAutoSave()
  }

  setupAutoSave() {
    const inputs = document.querySelectorAll("input, select, textarea")
    let saveTimeout

    inputs.forEach((input) => {
      input.addEventListener("change", () => {
        clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          this.saveSettings(false) // Silent save
        }, 1000)
      })
    })
  }

  toggleAudioServiceSettings(service) {
    // Hide all service-specific settings
    document.getElementById("elevenlabs-settings").style.display = "none"
    document.getElementById("google-settings").style.display = "none"
    document.getElementById("azure-settings").style.display = "none"

    // Show relevant settings
    switch (service) {
      case "elevenlabs":
        document.getElementById("elevenlabs-settings").style.display = "block"
        break
      case "google":
        document.getElementById("google-settings").style.display = "block"
        break
      case "azure":
        document.getElementById("azure-settings").style.display = "block"
        break
    }
  }

  async testGeminiApiKey() {
    const apiKeyInput = document.getElementById("gemini-api-key")
    const testBtn = document.getElementById("test-api-key")
    const apiKey = apiKeyInput.value.trim()

    if (!apiKey) {
      this.showStatus("Please enter your Gemini API key first", "error")
      return
    }

    try {
      testBtn.classList.add("btn-loading")
      testBtn.disabled = true
      testBtn.textContent = "Testing..."

      // Test the API key with a simple request
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
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
                    text: "Hello, this is a test.",
                  },
                ],
              },
            ],
          }),
        },
      )

      if (response.ok) {
        this.showStatus("Gemini API key is valid!", "success")
      } else {
        const errorData = await response.json().catch(() => ({}))
        this.showStatus(`API key test failed: ${errorData.error?.message || "Invalid key"}`, "error")
      }
    } catch (error) {
      this.showStatus(`Failed to test API key: ${error.message}`, "error")
    } finally {
      testBtn.classList.remove("btn-loading")
      testBtn.disabled = false
      testBtn.textContent = "Test"
    }
  }

  populateForm() {
    this.setFieldValue("gemini-api-key", this.currentSettings.geminiApiKey)

    // Audio Settings
    this.setFieldValue("audio-service", this.currentSettings.audioService)
    this.setFieldValue("elevenlabs-api-key", this.currentSettings.elevenLabsApiKey)
    this.setFieldValue("google-api-key", this.currentSettings.googleApiKey)
    this.setFieldValue("azure-api-key", this.currentSettings.azureApiKey)
    this.setFieldValue("azure-region", this.currentSettings.azureRegion)
    this.setFieldValue("voice-gender", this.currentSettings.voiceGender)
    this.setFieldValue("auto-play", this.currentSettings.autoPlay)

    // Content Extraction
    this.setFieldValue("content-length", this.currentSettings.contentLength)
    this.setFieldValue("extract-images", this.currentSettings.extractImages)
    this.setFieldValue("skip-navigation", this.currentSettings.skipNavigation)

    // Rhyme Generation
    this.setFieldValue("creativity-level", this.currentSettings.creativityLevel)
    this.setFieldValue("rhyme-scheme", this.currentSettings.rhymeScheme)
    this.setFieldValue("rhyme-style", this.currentSettings.rhymeStyle)
    this.setFieldValue("rhyme-length", this.currentSettings.rhymeLength)
    this.setFieldValue("tone", this.currentSettings.tone)
    this.setFieldValue("custom-instructions", this.currentSettings.customInstructions)
    this.setFieldValue("include-title", this.currentSettings.includeTitle)

    // User Interface
    this.setFieldValue("theme", this.currentSettings.theme)
    this.setFieldValue("show-word-count", this.currentSettings.showWordCount)
    this.setFieldValue("show-generation-time", this.currentSettings.showGenerationTime)

    // History & Storage
    this.setFieldValue("save-history", this.currentSettings.saveHistory)
    this.setFieldValue("max-history", this.currentSettings.maxHistory)

    // Update audio service settings visibility
    this.toggleAudioServiceSettings(this.currentSettings.audioService)
  }

  setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId)
    if (!field) return

    if (field.type === "checkbox") {
      field.checked = value
    } else {
      field.value = value
    }
  }

  getFieldValue(fieldId) {
    const field = document.getElementById(fieldId)
    if (!field) return null

    if (field.type === "checkbox") {
      return field.checked
    } else if (field.type === "number") {
      return Number.parseInt(field.value) || 0
    } else {
      return field.value
    }
  }

  collectFormData() {
    return {
      geminiApiKey: this.getFieldValue("gemini-api-key"),

      // Audio Settings
      audioService: this.getFieldValue("audio-service"),
      elevenLabsApiKey: this.getFieldValue("elevenlabs-api-key"),
      googleApiKey: this.getFieldValue("google-api-key"),
      azureApiKey: this.getFieldValue("azure-api-key"),
      azureRegion: this.getFieldValue("azure-region"),
      voiceGender: this.getFieldValue("voice-gender"),
      autoPlay: this.getFieldValue("auto-play"),

      // Content Extraction
      contentLength: Number.parseInt(this.getFieldValue("content-length")),
      extractImages: this.getFieldValue("extract-images"),
      skipNavigation: this.getFieldValue("skip-navigation"),

      // Rhyme Generation
      creativityLevel: this.getFieldValue("creativity-level"),
      rhymeScheme: this.getFieldValue("rhyme-scheme"),
      rhymeStyle: this.getFieldValue("rhyme-style"),
      rhymeLength: this.getFieldValue("rhyme-length"),
      tone: this.getFieldValue("tone"),
      customInstructions: this.getFieldValue("custom-instructions"),
      includeTitle: this.getFieldValue("include-title"),

      // User Interface
      theme: this.getFieldValue("theme"),
      showWordCount: this.getFieldValue("show-word-count"),
      showGenerationTime: this.getFieldValue("show-generation-time"),

      // History & Storage
      saveHistory: this.getFieldValue("save-history"),
      maxHistory: Number.parseInt(this.getFieldValue("max-history")),
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      this.chrome.storage.sync.get(["rhymeTimeSettings"], (result) => {
        if (result.rhymeTimeSettings) {
          this.currentSettings = { ...this.defaultSettings, ...result.rhymeTimeSettings }
        }
        resolve()
      })
    })
  }

  async saveSettings(showMessage = true) {
    try {
      const formData = this.collectFormData()
      this.currentSettings = formData

      // Save to Chrome storage
      await new Promise((resolve) => {
        this.chrome.storage.sync.set({ rhymeTimeSettings: formData }, resolve)
      })

      await new Promise((resolve) => {
        this.chrome.storage.sync.set(
          {
            geminiApiKey: formData.geminiApiKey,
            elevenLabsApiKey: formData.elevenLabsApiKey,
            googleApiKey: formData.googleApiKey,
            azureApiKey: formData.azureApiKey,
            azureRegion: formData.azureRegion,
            audioService: formData.audioService,
          },
          resolve,
        )
      })

      if (showMessage) {
        this.showStatus("Settings saved successfully!", "success")
      }

      this.applyTheme()
    } catch (error) {
      console.error("Failed to save settings:", error)
      this.showStatus("Failed to save settings", "error")
    }
  }

  resetSettings() {
    if (confirm("Are you sure you want to reset all settings to defaults? This cannot be undone.")) {
      this.currentSettings = { ...this.defaultSettings }
      this.populateForm()
      this.saveSettings()
      this.applyTheme()
    }
  }

  applyTheme(theme = null) {
    const selectedTheme = theme || this.currentSettings.theme

    // Remove existing theme classes
    document.body.classList.remove("dark-theme", "colorful-theme", "minimal-theme")

    // Apply new theme
    if (selectedTheme !== "default") {
      document.body.classList.add(`${selectedTheme}-theme`)
    }
  }

  async clearHistory() {
    if (confirm("Are you sure you want to clear all rhyme history? This cannot be undone.")) {
      try {
        await new Promise((resolve) => {
          this.chrome.storage.local.remove(["rhymeHistory"], resolve)
        })
        this.showStatus("History cleared successfully!", "success")
      } catch (error) {
        this.showStatus("Failed to clear history", "error")
      }
    }
  }

  exportSettings() {
    try {
      const exportData = {
        settings: this.currentSettings,
        exportDate: new Date().toISOString(),
        version: "1.0",
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rhymetime-settings-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.showStatus("Settings exported successfully!", "success")
    } catch (error) {
      this.showStatus("Failed to export settings", "error")
    }
  }

  importSettings() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"

    input.onchange = (event) => {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result)

          if (importData.settings) {
            this.currentSettings = { ...this.defaultSettings, ...importData.settings }
            this.populateForm()
            this.saveSettings()
            this.showStatus("Settings imported successfully!", "success")
          } else {
            throw new Error("Invalid settings file format")
          }
        } catch (error) {
          this.showStatus("Failed to import settings: Invalid file", "error")
        }
      }

      reader.readAsText(file)
    }

    input.click()
  }

  showStatus(message, type = "info") {
    const statusDiv = document.getElementById("settings-status")
    if (!statusDiv) return

    statusDiv.innerHTML = `<p style="color: ${type === "error" ? "#ff4444" : type === "success" ? "#44aa44" : "#666"}">${message}</p>`
    statusDiv.style.display = "block"

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = "none"
    }, 3000)
  }
}

// Initialize settings when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new RhymeTimeSettings()
  })
} else {
  new RhymeTimeSettings()
}