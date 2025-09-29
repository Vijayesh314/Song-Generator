// Main popup script that coordinates all extension functionality
class RhymeTimePopup {
  constructor() {
    this.chrome = window.chrome
    this.audioPlayer = null
    this.currentContent = null
    this.isProcessing = false
    this.settings = {}
    this.history = []

    this.init()
  }

  async init() {
    try {
      // Load settings first
      await this.loadSettings()

      // Initialize audio player
      const AudioPlayer = window.AudioPlayer
      if (AudioPlayer) {
        this.audioPlayer = new AudioPlayer("audio-player-container")
      }

      // Bind event listeners
      this.bindEvents()

      // Check API key status
      await this.checkApiKeyStatus()

      // Load history
      await this.loadHistory()

      // Update UI state
      this.updateUI()

      console.log("RhymeTime popup initialized")
    } catch (error) {
      console.error("Failed to initialize popup:", error)
      this.showError("Failed to initialize extension")
    }
  }

  bindEvents() {
    // Main transform button
    const transformBtn = document.getElementById("transform-btn")
    transformBtn?.addEventListener("click", () => this.handleTransform())

    // Audio controls
    const playBtn = document.getElementById("play-btn")
    const copyBtn = document.getElementById("copy-btn")
    const shareBtn = document.getElementById("share-btn")
    const saveBtn = document.getElementById("save-btn")

    playBtn?.addEventListener("click", () => this.handlePlay())
    copyBtn?.addEventListener("click", () => this.handleCopy())
    shareBtn?.addEventListener("click", () => this.handleShare())
    saveBtn?.addEventListener("click", () => this.handleSave())

    // Settings controls
    const styleSelect = document.getElementById("style-select")
    const lengthSelect = document.getElementById("length-select")
    const toneSelect = document.getElementById("tone-select")

    styleSelect?.addEventListener("change", () => this.saveCurrentSettings())
    lengthSelect?.addEventListener("change", () => this.saveCurrentSettings())
    toneSelect?.addEventListener("change", () => this.saveCurrentSettings())

    const presetBtns = document.querySelectorAll(".preset-btn")
    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.applyPreset(btn.dataset.preset))
    })

    const advancedToggle = document.getElementById("advanced-toggle")
    advancedToggle?.addEventListener("click", () => this.toggleAdvancedOptions())

    const settingsBtn = document.getElementById("settings-btn")
    settingsBtn?.addEventListener("click", () => this.openSettings())

    const clearHistoryBtn = document.getElementById("clear-history-btn")
    clearHistoryBtn?.addEventListener("click", () => this.clearHistory())

    // Auto-save advanced options
    const customPrompt = document.getElementById("custom-prompt")
    const voicePreference = document.getElementById("voice-preference")

    customPrompt?.addEventListener("input", () => this.saveCurrentSettings())
    voicePreference?.addEventListener("change", () => this.saveCurrentSettings())
  }

  applyPreset(presetName) {
    const presets = {
      study: { style: "ballad", length: "medium", tone: "educational" },
      fun: { style: "pop", length: "medium", tone: "funny" },
      kids: { style: "nursery", length: "short", tone: "funny" },
      chill: { style: "ballad", length: "long", tone: "chill" },
    }

    const preset = presets[presetName]
    if (preset) {
      document.getElementById("style-select").value = preset.style
      document.getElementById("length-select").value = preset.length
      document.getElementById("tone-select").value = preset.tone

      this.saveCurrentSettings()
      this.showStatus(`Applied ${presetName} preset!`)
    }
  }

  toggleAdvancedOptions() {
    const advancedOptions = document.getElementById("advanced-options")
    const toggleBtn = document.getElementById("advanced-toggle")

    if (advancedOptions.style.display === "none") {
      advancedOptions.style.display = "block"
      toggleBtn.textContent = "Advanced Options ▲"
    } else {
      advancedOptions.style.display = "none"
      toggleBtn.textContent = "Advanced Options ▼"
    }
  }

  openSettings() {
    this.chrome.tabs.create({ url: "settings.html" })
  }

  async handleTransform() {
    if (this.isProcessing) return

    try {
      this.isProcessing = true
      this.showLoading(true)
      this.updateStatus("Extracting content from page...")

      // Step 1: Extract content from the current page
      const contentData = await this.extractPageContent()
      if (!contentData.success) {
        throw new Error(contentData.error || "Failed to extract content")
      }

      this.currentContent = contentData.data
      this.updateStatus("Generating your rhyme...")

      // Step 2: Generate rhyme using Gemini
      const startTime = Date.now()
      const rhymeData = await this.generateRhyme()
      const generationTime = Date.now() - startTime

      if (!rhymeData.success) {
        throw new Error(rhymeData.error || "Failed to generate rhyme")
      }

      // Step 3: Display the result
      this.displayRhyme(rhymeData.data, generationTime)

      // Step 4: Generate audio if possible
      this.updateStatus("Creating audio...")
      await this.generateAudio(rhymeData.data)

      // Step 5: Save to history if enabled
      if (this.settings.saveHistory) {
        await this.saveToHistory(rhymeData.data, generationTime)
      }

      this.updateStatus("Ready! Your rhyme is complete.")
    } catch (error) {
      console.error("Transform error:", error)
      this.showError(error.message)
      this.updateStatus("Transform failed. Please try again.")
    } finally {
      this.isProcessing = false
      this.showLoading(false)
    }
  }

  async extractPageContent() {
    return new Promise((resolve) => {
      this.chrome.runtime.sendMessage({ action: "extractContent" }, (response) => {
        if (this.chrome.runtime.lastError) {
          resolve({
            success: false,
            error: this.chrome.runtime.lastError.message,
          })
        } else {
          resolve(response)
        }
      })
    })
  }

  async generateRhyme() {
    const settings = this.getCurrentSettings()

    const requestData = {
      content: this.currentContent.content,
      title: this.currentContent.title,
      style: settings.style,
      length: settings.length,
      tone: settings.tone,
      customInstructions: settings.customInstructions,
    }

    return new Promise((resolve) => {
      this.chrome.runtime.sendMessage({ action: "generateRhyme", data: requestData }, (response) => {
        if (this.chrome.runtime.lastError) {
          resolve({
            success: false,
            error: this.chrome.runtime.lastError.message,
          })
        } else {
          resolve(response)
        }
      })
    })
  }

  async generateAudio(rhymeData) {
    try {
      // Initialize audio generator if not already done
      const AudioGenerator = window.AudioGenerator
      if (!AudioGenerator) {
        console.log("Audio generator not available, skipping audio generation")
        return
      }

      const audioGenerator = new AudioGenerator()
      const settings = this.getCurrentSettings()

      const audioResult = await audioGenerator.generateAudio(rhymeData.rhyme, settings.style, {
        gender: settings.voiceGender,
      })

      if (audioResult.success && this.audioPlayer) {
        // Load the audio into the player
        await this.audioPlayer.loadTrack(audioResult, {
          title: this.currentContent.title || "Generated Rhyme",
          style: settings.style,
          duration: audioResult.duration,
        })

        // Show audio controls
        this.showAudioControls(true)
      }
    } catch (error) {
      console.error("Audio generation failed:", error)
      // Don't show error to user - audio is optional
    }
  }

  displayRhyme(rhymeData, generationTime = 0) {
    const outputDiv = document.getElementById("output")
    const rhymeTextDiv = document.getElementById("rhyme-text")
    const metadataDiv = document.getElementById("rhyme-metadata")

    if (outputDiv && rhymeTextDiv) {
      rhymeTextDiv.textContent = rhymeData.rhyme
      outputDiv.style.display = "block"

      if (metadataDiv && (this.settings.showWordCount || this.settings.showGenerationTime)) {
        const wordCount = rhymeData.rhyme.split(/\s+/).length
        const metadata = []

        if (this.settings.showWordCount) {
          metadata.push(`${wordCount} words`)
        }

        if (this.settings.showGenerationTime) {
          metadata.push(`Generated in ${(generationTime / 1000).toFixed(1)}s`)
        }

        const metadataText = metadataDiv.querySelector(".metadata-text")
        if (metadataText) {
          metadataText.textContent = metadata.join(" • ")
        }
        metadataDiv.style.display = "block"
      }

      // Scroll to show the result
      outputDiv.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

  async handleCopy() {
    const rhymeText = document.getElementById("rhyme-text")?.textContent
    if (!rhymeText) return

    try {
      await navigator.clipboard.writeText(rhymeText)
      this.showSuccess("Rhyme copied to clipboard!")
    } catch (error) {
      console.error("Copy failed:", error)
      this.showError("Failed to copy rhyme")
    }
  }

  async handlePlay() {
    if (this.audioPlayer) {
      await this.audioPlayer.togglePlayback()
    } else {
      this.showError("Audio player not available")
    }
  }

  async handleShare() {
    const rhymeText = document.getElementById("rhyme-text")?.textContent
    if (!rhymeText) return

    const shareData = {
      title: "Check out this rhyme from RhymeTime!",
      text: rhymeText,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}`)
        this.showSuccess("Rhyme copied to clipboard for sharing!")
      }
    } catch (error) {
      console.error("Share failed:", error)
      this.showError("Failed to share rhyme")
    }
  }

  async handleSave() {
    const rhymeText = document.getElementById("rhyme-text")?.textContent
    if (!rhymeText) return

    const rhymeData = {
      rhyme: rhymeText,
      metadata: {
        title: this.currentContent?.title || "Saved Rhyme",
        style: this.getCurrentSettings().style,
        savedAt: new Date().toISOString(),
      },
    }

    await this.saveToHistory(rhymeData)
    this.showSuccess("Rhyme saved to history!")
  }

  async saveToHistory(rhymeData, generationTime = 0) {
    const historyItem = {
      id: Date.now(),
      rhyme: rhymeData.rhyme,
      title: this.currentContent?.title || "Generated Rhyme",
      url: this.currentContent?.url || "",
      settings: this.getCurrentSettings(),
      generationTime,
      createdAt: new Date().toISOString(),
    }

    this.history.unshift(historyItem)

    // Limit history size
    const maxHistory = this.settings.maxHistory || 25
    if (this.history.length > maxHistory) {
      this.history = this.history.slice(0, maxHistory)
    }

    // Save to storage
    await new Promise((resolve) => {
      this.chrome.storage.local.set({ rhymeHistory: this.history }, resolve)
    })

    this.updateHistoryDisplay()
  }

  async loadHistory() {
    return new Promise((resolve) => {
      this.chrome.storage.local.get(["rhymeHistory"], (result) => {
        this.history = result.rhymeHistory || []
        this.updateHistoryDisplay()
        resolve()
      })
    })
  }

  updateHistoryDisplay() {
    const historySection = document.getElementById("history-section")
    const historyList = document.getElementById("history-list")

    if (!historySection || !historyList) return

    if (this.history.length === 0) {
      historySection.style.display = "none"
      return
    }

    historySection.style.display = "block"
    historyList.innerHTML = ""

    // Show last 5 items
    const recentHistory = this.history.slice(0, 5)

    recentHistory.forEach((item) => {
      const historyItem = document.createElement("div")
      historyItem.className = "history-item"
      historyItem.innerHTML = `
        <div class="history-title">${item.title}</div>
        <div class="history-preview">${item.rhyme.substring(0, 60)}...</div>
        <div class="history-meta">${item.settings.style} • ${new Date(item.createdAt).toLocaleDateString()}</div>
      `

      historyItem.addEventListener("click", () => {
        document.getElementById("rhyme-text").textContent = item.rhyme
        document.getElementById("output").style.display = "block"
      })

      historyList.appendChild(historyItem)
    })
  }

  async clearHistory() {
    if (confirm("Clear all rhyme history?")) {
      this.history = []
      await new Promise((resolve) => {
        this.chrome.storage.local.set({ rhymeHistory: [] }, resolve)
      })
      this.updateHistoryDisplay()
      this.showSuccess("History cleared!")
    }
  }

  getCurrentSettings() {
    return {
      style: document.getElementById("style-select")?.value || "pop",
      length: document.getElementById("length-select")?.value || "medium",
      tone: document.getElementById("tone-select")?.value || "educational",
      customInstructions: document.getElementById("custom-prompt")?.value || "",
      voiceGender: document.getElementById("voice-preference")?.value || "auto",
    }
  }

  async saveCurrentSettings() {
    const settings = this.getCurrentSettings()
    this.chrome.storage.sync.set({ userSettings: settings })
  }

  async loadSettings() {
    return new Promise((resolve) => {
      this.chrome.storage.sync.get(["rhymeTimeSettings", "userSettings"], (result) => {
        this.settings = result.rhymeTimeSettings || {}

        if (result.userSettings) {
          const userSettings = result.userSettings

          const styleSelect = document.getElementById("style-select")
          const lengthSelect = document.getElementById("length-select")
          const toneSelect = document.getElementById("tone-select")
          const customPrompt = document.getElementById("custom-prompt")
          const voicePreference = document.getElementById("voice-preference")

          if (styleSelect) styleSelect.value = userSettings.style || "pop"
          if (lengthSelect) lengthSelect.value = userSettings.length || "medium"
          if (toneSelect) toneSelect.value = userSettings.tone || "educational"
          if (customPrompt) customPrompt.value = userSettings.customInstructions || ""
          if (voicePreference) voicePreference.value = userSettings.voiceGender || "auto"
        }
        resolve()
      })
    })
  }

  async checkApiKeyStatus() {
    try {
      const response = await new Promise((resolve) => {
        this.chrome.runtime.sendMessage({ action: "checkApiKey" }, resolve)
      })

      if (response.success && response.data.configured) {
        this.updateStatus("Ready to transform pages!")
      } else {
        this.showGeminiApiKeySetup()
      }
    } catch (error) {
      console.error("Failed to check API key status:", error)
      this.showGeminiApiKeySetup()
    }
  }

  showGeminiApiKeySetup() {
    const modal = document.createElement("div")
    modal.className = "api-key-modal"
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h3>Setup Gemini API Key</h3>
          <p>Enter your Google Gemini API key to start generating rhymes:</p>
          
          <div class="setup-info">
            <div class="info-item">
              <strong>✨ Free to use:</strong> 60 requests per minute
            </div>
            <div class="info-item">
              <strong>🔗 Get your key:</strong> 
              <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a>
            </div>
            <div class="info-item">
              <strong>🔒 Secure:</strong> Stored locally in your browser
            </div>
          </div>

          <div class="api-key-input">
            <input type="password" id="api-key-input" placeholder="Enter your Gemini API key">
            <button id="save-api-key" class="btn-primary">Save & Test</button>
          </div>

          <div class="modal-actions">
            <button id="setup-later" class="btn-secondary">Setup Later</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Bind events
    const input = modal.querySelector("#api-key-input")
    const saveBtn = modal.querySelector("#save-api-key")
    const setupLaterBtn = modal.querySelector("#setup-later")

    saveBtn.addEventListener("click", async () => {
      const apiKey = input.value.trim()
      if (!apiKey) {
        alert("Please enter your Gemini API key")
        return
      }

      await this.saveGeminiApiKey(apiKey)
      modal.remove()
    })

    setupLaterBtn.addEventListener("click", () => {
      modal.remove()
      this.updateStatus("Add your Gemini API key in settings to start using RhymeTime")
    })

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        saveBtn.click()
      }
    })

    // Focus the input
    setTimeout(() => input.focus(), 100)
  }

  async saveGeminiApiKey(apiKey) {
    try {
      this.showLoading(true)
      this.updateStatus("Setting up Gemini API...")

      // Save API key
      await new Promise((resolve) => {
        this.chrome.storage.sync.set({ geminiApiKey: apiKey }, resolve)
      })

      // Test the API key
      const response = await new Promise((resolve) => {
        this.chrome.runtime.sendMessage(
          {
            action: "testApiKey",
            apiKey: apiKey,
          },
          resolve,
        )
      })

      if (!response.success) {
        throw new Error(response.error || "API key test failed")
      }

      this.showSuccess("Gemini API configured successfully!")
      this.updateStatus("Ready to transform pages!")
    } catch (error) {
      this.showError(`Setup failed: ${error.message}`)
      this.showGeminiApiKeySetup() // Show setup again
    } finally {
      this.showLoading(false)
    }
  }

  // UI Helper Methods
  showLoading(show) {
    const loading = document.getElementById("loading")
    const transformBtn = document.getElementById("transform-btn")

    if (loading) {
      loading.style.display = show ? "block" : "none"
    }

    if (transformBtn) {
      transformBtn.disabled = show
      transformBtn.textContent = show ? "Processing..." : "Transform Page"
    }
  }

  showAudioControls(show) {
    const audioPlayer = document.getElementById("audio-player")
    if (audioPlayer) {
      audioPlayer.style.display = show ? "block" : "none"
    }
  }

  updateStatus(message) {
    const status = document.getElementById("status")
    if (status) {
      status.innerHTML = `<p>${message}</p>`
    }
  }

  showError(message) {
    this.updateStatus(`<span style="color: #ff4444;">❌ ${message}</span>`)
  }

  showSuccess(message) {
    this.updateStatus(`<span style="color: #44aa44;">✅ ${message}</span>`)
  }

  showStatus(message) {
    const status = document.getElementById("status")
    if (status) {
      status.innerHTML = `<p>${message}</p>`
    }
  }

  updateUI() {
    // Update transform button state
    const transformBtn = document.getElementById("transform-btn")
    if (transformBtn) {
      transformBtn.disabled = this.isProcessing
    }

    // Update output visibility
    const output = document.getElementById("output")
    if (output && !output.querySelector("#rhyme-text")?.textContent) {
      output.style.display = "none"
    }
  }
}

const enhancedStyles = `
.settings-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.quick-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.preset-btn {
  background: #f8f9fa;
  border: 2px solid #e1e5e9;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 60px;
}

.preset-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.advanced-toggle {
  margin: 12px 0;
}

.toggle-btn {
  background: none;
  border: none;
  color: #667eea;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}

.advanced-options {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.advanced-options .control-group {
  margin-bottom: 12px;
}

.advanced-options textarea {
  width: 100%;
  padding: 8px;
  border: 2px solid #e1e5e9;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.rhyme-metadata {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e1e5e9;
}

.metadata-text {
  color: #666;
  font-size: 11px;
}

.history-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e1e5e9;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-header h3 {
  font-size: 14px;
  color: #333;
  margin: 0;
}

.btn-text {
  background: none;
  border: none;
  color: #667eea;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-item:hover {
  background: #e9ecef;
}

.history-title {
  font-weight: 600;
  font-size: 12px;
  color: #333;
  margin-bottom: 2px;
}

.history-preview {
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
}

.history-meta {
  font-size: 10px;
  color: #999;
}
`

const geminiModalStyles = `
.setup-info {
  margin: 16px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.info-item {
  margin: 8px 0;
  font-size: 13px;
  color: #333;
}

.info-item strong {
  color: #667eea;
}

.info-item a {
  color: #667eea;
  text-decoration: none;
}

.info-item a:hover {
  text-decoration: underline;
}

.api-key-modal .modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.api-key-modal .modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.api-key-modal h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.api-key-input {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.api-key-input input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
}

.btn-primary, .btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5a67d8;
}

.btn-secondary {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #e1e5e9;
}

.btn-secondary:hover {
  background: #e9ecef;
}

.modal-actions {
  margin-top: 16px;
  text-align: center;
}
`

// Add the styles
const styleSheet = document.createElement("style")
styleSheet.textContent = enhancedStyles + geminiModalStyles
document.head.appendChild(styleSheet)

// Initialize the popup when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new RhymeTimePopup()
  })
} else {
  new RhymeTimePopup()
}